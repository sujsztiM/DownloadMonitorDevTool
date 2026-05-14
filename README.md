# Download Monitor DevTool — Chrome Extension

> **Developer Tool** — Designed for developers integrating download event data into their own backend systems or automation workflows.

A Chrome extension that monitors browser downloads and sends WebSocket notifications to a configurable endpoint.

## Features

- **Download Monitoring**: Detects when downloads are created, completed, or interrupted
- **WebSocket Notifications**: Forwards download events to a configurable WebSocket server
- **Privacy Controls**: Opt-in data sharing — filename and source URL are **disabled by default**; user must explicitly enable each field
- **Disabled by Default**: Extension does nothing until explicitly configured with a WebSocket URL and enabled
- **Chrome Web Store Compliant**: Manifest V3, minimal permissions, no remote code execution, opt-in data sharing

## Supported Events

| Event | Trigger | Payload |
|---|---|---|
| `download.created` | Download queued/started | Download ID, URL, filename, MIME type, total size |
| `download.complete` | Download finished | Download ID, filename, total size, end time |
| `download.interrupted` | Download cancelled/failed | Download ID, error code |
| `ws.ping` | Every 20 seconds | Keepalive signal (server should respond with `ws.pong`) |

## Quick Start

### 1. Load the Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the extension's directory (the folder containing `manifest.json`)
5. Verify the extension appears in your toolbar

### 2. Configure WebSocket Endpoint

1. Click the extension icon in your toolbar
2. Enter your WebSocket URL (e.g., `ws://localhost:8080`)
   - Must use `ws://` or `wss://` scheme
   - Empty URL = disabled
3. Toggle **Enable Notifications** to ON
4. Adjust privacy settings as needed
5. Click **Save Settings**

### 3. Test with Local Server

Install the `ws` package and run the included test server:

```bash
npm install ws
node test-server.js
```

Then:

1. In the extension popup, enter `ws://localhost:8080`
2. Enable notifications
3. Download a file — you should see events in the server output

## Manifest Permissions

| Permission | Purpose |
|---|---|
| `downloads` | Monitor download creation and state changes via `chrome.downloads` API |
| `storage` | Persist user settings (WebSocket URL, toggles) in `chrome.storage.local` |
| `alarms` | 30-second heartbeat to keep service worker alive between events |

## WebSocket Message Format

All messages are JSON-encoded. Examples:

### download.created
```json
{
  "event": "download.created",
  "timestamp": "2026-05-14T12:00:00.000Z",
  "download": {
    "id": 42,
    "url": "https://example.com/file.zip",
    "filename": "/Users/user/Downloads/file.zip",
    "mime": "application/zip",
    "totalBytes": 10485760,
    "state": "in_progress"
  }
}
```

### download.complete
```json
{
  "event": "download.complete",
  "timestamp": "2026-05-14T12:00:10.000Z",
  "download": {
    "id": 42,
    "filename": "/Users/user/Downloads/file.zip",
    "totalBytes": 10485760,
    "endTime": "2026-05-14T12:00:10.000Z"
  }
}
```

### download.interrupted
```json
{
  "event": "download.interrupted",
  "timestamp": "2026-05-14T12:00:08.000Z",
  "download": {
    "id": 42,
    "error": "NETWORK_FAILED",
    "state": "interrupted"
  }
}
```

### ws.ping (keepalive)
```json
{
  "event": "ws.ping",
  "timestamp": "2026-05-14T12:00:20.000Z"
}
```

## Settings Storage

All settings are stored in `chrome.storage.local` under the key `"settings"`:

```javascript
{
  "wsUrl": "ws://localhost:8080",     // User-provided WebSocket URL
  "enabled": true,                     // Master on/off toggle
  "sendFilename": true,                // Include filename in payloads
  "sendUrl": true                      // Include source URL in payloads
}
```

## Architecture

### Service Worker (`service-worker.js`)

- **Top-level listeners**: `chrome.downloads.onCreated`, `chrome.downloads.onChanged`, `chrome.alarms.onAlarm`, `chrome.runtime.onMessage`
- **WebSocket management**: `connect()`, `disconnect()`, `ensureConnected()`
- **Keepalive**: 20-second ping loop to maintain service worker activity
- **Alarm**: 30-second heartbeat to re-establish connection after cold starts

### Popup UI (`popup/popup.html`, `popup/popup.css`, `popup/popup.js`)

- Settings form with URL input, enable/disable toggle, privacy checkboxes
- Real-time status indicator (Disabled / Connecting / Connected / Disconnected)
- Save button with validation and feedback
- Settings persist across popup close/reopen

## Data Collection & Privacy Statement

This extension **does NOT collect** the following categories of personal data:

- ❌ **Personally identifiable data** — name, email, phone number, etc.
- ❌ **Health data** — health measurements, diagnoses, medical information
- ❌ **Financial and payment data** — transaction records, bank account info, payment methods
- ❌ **Credit data** — credit scores, security codes, PIN codes
- ❌ **Personal communication** — emails, messages, SMS content
- ❌ **Location data** — GPS coordinates, IP addresses, region information
- ❌ **Website content** — page content, images, videos
- ❌ **Third-party connections** — No contact with Google, developers, or external services

This extension **MAY collect** only the following (user-controlled):

- ✓ **Internet history** — **ONLY if user explicitly enables** the "Send URL" toggle:
  - Download source URLs are optionally forwarded to the user-configured WebSocket endpoint
  - Disabled by default
  - User has full control via the "Send URL" checkbox

- ✓ **User activity** — **ONLY download events**, locally monitored:
  - When downloads are created, completed, or interrupted
  - Local monitoring only; forwarding controlled by user-enabled toggles
  - Filename forwarding is also opt-in (disabled by default)

### Data Handling Practices

- **Local-first**: All data processing happens locally on the user's device
- **User-configured endpoint only**: Data is only sent to endpoints the user explicitly configures
- **Opt-in toggles**: Sensitive fields (filename, URL) are disabled by default
- **Settings stored locally**: All configuration is stored in `chrome.storage.local` — never synced or shared
- **No external communication**: Extension never contacts Google, the developers, or any third-party service except the user-specified WebSocket endpoint
- **No tracking**: No analytics, no telemetry, no performance monitoring

## Troubleshooting

### Extension not receiving events
- Verify WebSocket URL is correct (`ws://` or `wss://` scheme)
- Check that the toggle is ON
- Verify the WebSocket server is running and accepting connections
- Check Chrome DevTools for the extension (View → Developer → Background Page) for error messages

### WebSocket disconnects frequently
- Ensure the 20-second keepalive ping is reaching your server (server should log it)
- Verify your server responds to `ws.ping` with `ws.pong` (or at least keeps the connection open)
- Check for network issues or firewall restrictions

### Status shows "Disconnected"
- Check the extension's background page console (Chrome DevTools) for errors
- Verify the WebSocket URL is reachable from your machine
- Try reloading the extension: `chrome://extensions` → find Download Monitor → reload button

## Development

### File Structure
```
.
├── manifest.json              # Extension configuration
├── service-worker.js          # Background service worker
├── popup/
│   ├── popup.html            # Popup UI template
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup controller
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── test-server.js            # Local WebSocket server for testing
└── README.md                  # This file
```

### Building Icons

The included PNG icons are minimal placeholders. To create custom icons:

```bash
# Using ImageMagick (if installed)
convert -size 16x16 xc:blue icon16.png
convert -size 32x32 xc:blue icon32.png
convert -size 48x48 xc:blue icon48.png
convert -size 128x128 xc:blue icon128.png
```

Or use any image editor to create 16×16, 32×32, 48×48, and 128×128 PNG files.

## Browser Compatibility

- Chrome 120 and later
- Chromium-based browsers (Brave, Edge, etc.) may also support this extension

## License

Provide your own license here if publishing to the Chrome Web Store.
