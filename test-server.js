#!/usr/bin/env node

// ============================================================================
// Simple WebSocket Server for Testing Download Monitor Extension
// Usage: node test-server.js
// ============================================================================

const WebSocket = require('ws');
const http = require('http');

const PORT = 8080;

// Create an HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running on ws://localhost:8080\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log(`[${new Date().toISOString()}] Client connected`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[${new Date().toISOString()}] Received:`, JSON.stringify(message, null, 2));

      // Respond to pings
      if (message.event === 'ws.ping') {
        ws.send(JSON.stringify({
          event: 'ws.pong',
          timestamp: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Failed to parse message:`, error.message);
    }
  });

  ws.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client disconnected`);
  });

  ws.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error:`, error.message);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket test server listening on ws://localhost:${PORT}`);
  console.log('\nTo use with the extension:');
  console.log('1. Open chrome://extensions');
  console.log('2. Click "Load unpacked" and select this directory');
  console.log('3. Click the extension icon and configure:');
  console.log(`   - WebSocket URL: ws://localhost:${PORT}`);
  console.log('   - Enable toggle: ON');
  console.log('4. Download a file to test\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down WebSocket server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
