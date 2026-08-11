import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

import {
  ensureUserScriptsAvailable,
  launchScriptVault,
  openExtensionPage,
  sendRuntimeMessage,
} from './helpers/extension-fixture.js';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function websocketFrame(payload, opcode = 0x1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (body.length >= 126) throw new Error('The E2E WebSocket frame helper only supports short payloads');
  return Buffer.concat([Buffer.from([0x80 | opcode, body.length]), body]);
}

function parseClientFrames(socket, state) {
  for (;;) {
    if (state.buffer.length < 2) return;
    const first = state.buffer[0];
    const second = state.buffer[1];
    const masked = (second & 0x80) !== 0;
    let payloadLength = second & 0x7f;
    let headerLength = 2;
    if (payloadLength === 126) {
      if (state.buffer.length < 4) return;
      payloadLength = state.buffer.readUInt16BE(2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      throw new Error('The E2E WebSocket frame helper does not support 64-bit payload lengths');
    }
    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;
    if (state.buffer.length < frameLength) return;

    let payload = state.buffer.subarray(headerLength + maskLength, frameLength);
    if (masked) {
      const mask = state.buffer.subarray(headerLength, headerLength + 4);
      payload = Buffer.from(payload);
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    }
    state.buffer = state.buffer.subarray(frameLength);

    const opcode = first & 0x0f;
    if (opcode === 0x8) {
      socket.write(websocketFrame(payload, 0x8));
      socket.end();
      return;
    }
    if (opcode === 0x9) {
      socket.write(websocketFrame(payload, 0xa));
      continue;
    }
    if (opcode === 0x1) state.onMessage?.(payload.toString('utf8'));
  }
}

async function startLocalWebSocketServer() {
  let resolveMessage;
  let rejectMessage;
  const message = new Promise((resolve, reject) => {
    resolveMessage = resolve;
    rejectMessage = reject;
  });
  const sockets = new Set();
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>ScriptVault WebSocket target</title></head><body>ready</body></html>');
  });

  server.on('upgrade', (request, socket) => {
    const key = request.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }
    const accept = createHash('sha1').update(key + WEBSOCKET_GUID).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      'Sec-WebSocket-Protocol: scriptvault',
      '',
      ''
    ].join('\r\n'));

    sockets.add(socket);
    const state = {
      buffer: Buffer.alloc(0),
      onMessage(payload) {
        resolveMessage(payload);
        socket.write(websocketFrame(`echo:${payload}`));
      },
    };
    socket.on('data', chunk => {
      state.buffer = Buffer.concat([state.buffer, chunk]);
      try {
        parseClientFrames(socket, state);
      } catch (error) {
        rejectMessage(error);
        socket.destroy();
      }
    });
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    pageUrl: `http://127.0.0.1:${port}/target`,
    socketUrl: `ws://127.0.0.1:${port}/socket`,
    message,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

function websocketUserscript(socketUrl) {
  return [
    '// ==UserScript==',
    '// @name ScriptVault GM WebSocket E2E',
    '// @namespace scriptvault-e2e',
    '// @version 1.0.0',
    '// @match http://127.0.0.1/*',
    '// @connect 127.0.0.1',
    '// @grant GM_webSocket',
    '// ==/UserScript==',
    `const socket = GM_webSocket({ url: ${JSON.stringify(socketUrl)}, protocols: ['scriptvault'],`,
    '  onopen(event) {',
    '    document.documentElement.setAttribute("data-sv-ws-open", event.type + ":" + this.protocol);',
    '    this.send("ping");',
    '  },',
    '  onmessage(event) {',
    '    document.documentElement.setAttribute("data-sv-ws-message", String(event.data));',
    '    this.close(1000, "done");',
    '  },',
    '  onclose(event) {',
    '    document.documentElement.setAttribute("data-sv-ws-close", event.code + ":" + event.reason);',
    '  },',
    '  onerror(event) {',
    '    document.documentElement.setAttribute("data-sv-ws-error", String(event.message || event.error || "error"));',
    '  },',
    '});',
    'window.__scriptVaultWebSocket = socket;',
    ''
  ].join('\n');
}

test('GM_webSocket round-trips through the shipped userscript bridge', async () => {
  test.setTimeout(150_000);
  const server = await startLocalWebSocketServer();
  const app = await launchScriptVault();
  try {
    const dashboard = await openExtensionPage(app);
    const capability = await ensureUserScriptsAvailable(app, dashboard);
    test.skip(!capability.available, capability.reason);

    await expect(sendRuntimeMessage(dashboard, {
      action: 'saveScript',
      data: { code: websocketUserscript(server.socketUrl), enabled: true },
    })).resolves.toMatchObject({ success: true });

    const target = await app.context.newPage();
    try {
      await target.goto(server.pageUrl, { waitUntil: 'domcontentloaded' });
      await expect(target.locator('html')).toHaveAttribute('data-sv-ws-open', 'open:scriptvault');
      await expect(target.locator('html')).toHaveAttribute('data-sv-ws-message', 'echo:ping');
      await expect(target.locator('html')).toHaveAttribute('data-sv-ws-close', '1000:done');
      await expect(target.locator('html')).not.toHaveAttribute('data-sv-ws-error');
      await expect(server.message).resolves.toBe('ping');
    } finally {
      await target.close().catch(() => {});
    }
  } finally {
    await app.close();
    await server.close();
  }
});
