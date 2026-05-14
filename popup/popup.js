// ============================================================================
// Download Monitor Popup UI Controller
// ============================================================================

// DOM Elements
const wsUrlInput = document.getElementById('wsUrl');
const enableToggle = document.getElementById('enableToggle');
const sendFilenameCheckbox = document.getElementById('sendFilename');
const sendUrlCheckbox = document.getElementById('sendUrl');
const pingEnabledCheckbox = document.getElementById('pingEnabled');
const pingIntervalInput = document.getElementById('pingInterval');
const pingIntervalGroup = document.getElementById('pingIntervalGroup');
const saveBtn = document.getElementById('saveBtn');
const saveMessage = document.getElementById('saveMessage');
const urlError = document.getElementById('urlError');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// ============================================================================
// URL Validation
// ============================================================================

function isValidWebSocketUrl(url) {
  if (!url) {
    return true; // Empty URL is valid (disabled state)
  }

  try {
    const urlObj = new URL(url);
    // Only allow ws:// and wss:// schemes
    return urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:';
  } catch (e) {
    return false;
  }
}

function validateAndShowError() {
  const url = wsUrlInput.value.trim();
  const isValid = isValidWebSocketUrl(url);

  if (!isValid && url) {
    wsUrlInput.classList.add('error');
    urlError.textContent = 'URL must start with ws:// or wss://';
    return false;
  } else {
    wsUrlInput.classList.remove('error');
    urlError.textContent = '';
    return true;
  }
}

// Validate on input
wsUrlInput.addEventListener('input', validateAndShowError);

// ============================================================================
// Toggle Behavior
// ============================================================================

function updateInputStates() {
  const isEnabled = enableToggle.checked;

  // When disabled, gray out the URL input
  wsUrlInput.disabled = !isEnabled;

  // Show/hide validation error based on enabled state
  if (!isEnabled) {
    urlError.textContent = '';
    wsUrlInput.classList.remove('error');
  }
}

enableToggle.addEventListener('change', updateInputStates);

// ============================================================================
// Ping Interval Visibility
// ============================================================================

function updatePingIntervalVisibility() {
  pingIntervalGroup.style.display = pingEnabledCheckbox.checked ? '' : 'none';
}

pingEnabledCheckbox.addEventListener('change', updatePingIntervalVisibility);

// ============================================================================
// Status Indicator
// ============================================================================

async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get-status' });
    const isEnabled = enableToggle.checked;

    statusDot.className = 'status-dot';

    if (!isEnabled || !wsUrlInput.value.trim()) {
      statusDot.classList.add('status-disabled');
      statusText.textContent = 'Disabled';
    } else if (response.connected) {
      statusDot.classList.add('status-connected');
      statusText.textContent = 'Connected';
    } else if (response.readyState === WebSocket.CONNECTING) {
      statusDot.classList.add('status-connecting');
      statusText.textContent = 'Connecting...';
    } else {
      statusDot.classList.add('status-disconnected');
      statusText.textContent = 'Disconnected';
    }
  } catch (error) {
    console.error('Failed to get status:', error);
    statusDot.className = 'status-dot status-disconnected';
    statusText.textContent = 'Error';
  }
}

// Update status periodically
setInterval(updateStatus, 1000);

// ============================================================================
// Settings Persistence
// ============================================================================

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    const settings = data.settings || {
      wsUrl: '',
      enabled: false,
      sendFilename: false,
      sendUrl: false,
      pingEnabled: false,
      pingInterval: 20
    };

    wsUrlInput.value = settings.wsUrl || '';
    enableToggle.checked = settings.enabled || false;
    sendFilenameCheckbox.checked = settings.sendFilename !== false;
    sendUrlCheckbox.checked = settings.sendUrl !== false;
    pingEnabledCheckbox.checked = !!settings.pingEnabled;
    pingIntervalInput.value = settings.pingInterval || 20;

    updateInputStates();
    updatePingIntervalVisibility();
    updateStatus();
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

async function saveSettings() {
  // Validate URL first
  if (!validateAndShowError()) {
    return;
  }

  // Check if enabled but URL is empty
  if (enableToggle.checked && !wsUrlInput.value.trim()) {
    urlError.textContent = 'URL is required when enabled';
    wsUrlInput.classList.add('error');
    return;
  }

  const settings = {
    wsUrl: wsUrlInput.value.trim(),
    enabled: enableToggle.checked,
    sendFilename: sendFilenameCheckbox.checked,
    sendUrl: sendUrlCheckbox.checked,
    pingEnabled: pingEnabledCheckbox.checked,
    pingInterval: parseInt(pingIntervalInput.value, 10) || 20
  };

  try {
    await chrome.storage.local.set({ settings });

    // Notify service worker that settings changed
    await chrome.runtime.sendMessage({ type: 'settings-changed' });

    // Show success message
    saveMessage.textContent = '✓ Saved';
    setTimeout(() => {
      saveMessage.textContent = '';
    }, 2000);

    // Update status after save
    updateStatus();
  } catch (error) {
    console.error('Failed to save settings:', error);
    saveMessage.textContent = '✗ Error saving';
  }
}

saveBtn.addEventListener('click', saveSettings);

// Allow Enter key to save
wsUrlInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    saveSettings();
  }
});

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', loadSettings);
