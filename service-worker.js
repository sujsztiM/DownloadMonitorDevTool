// ============================================================================
// Download Monitor Service Worker
// Monitors downloads and forwards events via WebSocket to configured endpoint
// ============================================================================

// Module-level WebSocket state
let ws = null;
let keepAliveInterval = null;

// ============================================================================
// Storage Helpers
// ============================================================================

async function getSettings() {
  const data = await chrome.storage.local.get('settings');
  return data.settings || {
    wsUrl: '',
    enabled: false,
    sendFilename: false,
    sendUrl: false,
    pingEnabled: false,
    pingInterval: 20
  };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

// ============================================================================
// WebSocket Management
// ============================================================================

function disconnect() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

function keepAlive(intervalMs) {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }

  keepAliveInterval = setInterval(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const settings = await getSettings();
      if (settings.pingEnabled) {
        ws.send(JSON.stringify({
          event: 'ws.ping',
          timestamp: new Date().toISOString()
        }));
      }
    } else {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  }, intervalMs);
}

function connect(url) {
  if (ws) {
    disconnect();
  }

  try {
    ws = new WebSocket(url);

    ws.onopen = async () => {
      console.log('[Download Monitor] WebSocket connected:', url);
      const settings = await getSettings();
      keepAlive((settings.pingInterval || 20) * 1000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Handle incoming messages (e.g., pong responses)
        if (msg.event === 'ws.pong') {
          // Acknowledged, do nothing
        }
      } catch (e) {
        console.error('[Download Monitor] Failed to parse message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('[Download Monitor] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[Download Monitor] WebSocket closed');
      disconnect();
    };
  } catch (error) {
    console.error('[Download Monitor] Failed to create WebSocket:', error);
  }
}

async function ensureConnected() {
  const settings = await getSettings();

  // Disabled or no URL configured
  if (!settings.enabled || !settings.wsUrl) {
    disconnect();
    return;
  }

  // Already connected or connecting
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // Connect
  connect(settings.wsUrl);
}

// ============================================================================
// Download Event Handlers
// ============================================================================

async function handleCreated(item) {
  await ensureConnected();

  const settings = await getSettings();
  if (!settings.enabled || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const download = {
    id: item.id,
    state: item.state,
    totalBytes: item.totalBytes,
    mime: item.mime
  };

  if (settings.sendUrl && item.url) {
    download.url = item.url;
  }

  if (settings.sendFilename && item.filename) {
    download.filename = item.filename;
  }

  const payload = {
    event: 'download.created',
    timestamp: new Date().toISOString(),
    download
  };

  try {
    ws.send(JSON.stringify(payload));
    console.log('[Download Monitor] Sent download.created:', item.id);
  } catch (error) {
    console.error('[Download Monitor] Failed to send download.created:', error);
  }
}

async function handleChanged(delta) {
  await ensureConnected();

  const settings = await getSettings();
  if (!settings.enabled || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  let event = null;
  let download = { id: delta.id };

  // State change: completed or interrupted
  if (delta.state) {
    if (delta.state.current === 'complete') {
      event = 'download.complete';
      download.state = 'complete';

      if (settings.sendFilename && delta.filename && delta.filename.current) {
        download.filename = delta.filename.current;
      }

      if (delta.totalBytes) {
        download.totalBytes = delta.totalBytes.current || delta.totalBytes;
      }

      if (delta.endTime && delta.endTime.current) {
        download.endTime = delta.endTime.current;
      }
    } else if (delta.state.current === 'interrupted') {
      event = 'download.interrupted';
      download.state = 'interrupted';

      if (delta.error && delta.error.current) {
        download.error = delta.error.current;
      }
    }
  }

  // Only send if we determined an event type
  if (!event) {
    return;
  }

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    download
  };

  try {
    ws.send(JSON.stringify(payload));
    console.log(`[Download Monitor] Sent ${event}:`, delta.id);
  } catch (error) {
    console.error(`[Download Monitor] Failed to send ${event}:`, error);
  }
}

// ============================================================================
// Alarm Handler
// ============================================================================

async function handleAlarm(alarm) {
  if (alarm.name === 'ws-heartbeat') {
    await ensureConnected();
  }
}

// ============================================================================
// Message Handler (popup communication)
// ============================================================================

function handleMessage(request, sender, sendResponse) {
  if (request.type === 'settings-changed') {
    getSettings().then(async (settings) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        keepAlive((settings.pingInterval || 20) * 1000);
      }
      return ensureConnected();
    }).then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      console.error('[Download Monitor] Error handling settings change:', error);
      sendResponse({ ok: false, error: error.message });
    });
    return true; // Indicate we'll respond asynchronously
  }

  if (request.type === 'get-status') {
    const status = {
      connected: ws && ws.readyState === WebSocket.OPEN,
      readyState: ws ? ws.readyState : null,
      wsUrl: ws ? ws.url : null
    };
    sendResponse(status);
    return false;
  }

  return false;
}

// ============================================================================
// Top-level Event Listener Registration
// ============================================================================

chrome.downloads.onCreated.addListener(handleCreated);
chrome.downloads.onChanged.addListener(handleChanged);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.runtime.onMessage.addListener(handleMessage);

// Initialize alarm on extension install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('ws-heartbeat', { periodInMinutes: 0.5 }); // 30 seconds
});

console.log('[Download Monitor] Service worker initialized');
