import {
  applyLspContentChanges,
  getGmSignatureHelp,
  getMetadataCompletions,
  getUserscriptDiagnostics,
  type LspPosition,
} from './userscript-language-service';

interface JsonRpcMessage {
  id?: string | number;
  method?: string;
  params?: Record<string, any>;
}

const documents = new Map<string, string>();
const workerScope = self as unknown as {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<JsonRpcMessage>) => void): void;
  close(): void;
};

function send(message: unknown): void {
  workerScope.postMessage(message);
}

function respond(id: string | number | undefined, result: unknown): void {
  if (id !== undefined) send({ jsonrpc: '2.0', id, result });
}

function publishDiagnostics(uri: string): void {
  send({
    jsonrpc: '2.0',
    method: 'textDocument/publishDiagnostics',
    params: { uri, diagnostics: getUserscriptDiagnostics(documents.get(uri) || '') },
  });
}

workerScope.addEventListener('message', (event: MessageEvent<JsonRpcMessage>) => {
  const message = event.data || {};
  const params = message.params || {};
  const textDocument = params.textDocument || {};
  const uri = String(textDocument.uri || '');

  switch (message.method) {
    case 'initialize':
      respond(message.id, {
        capabilities: {
          textDocumentSync: { openClose: true, change: 2 },
          completionProvider: { triggerCharacters: ['@'] },
          signatureHelpProvider: { triggerCharacters: ['(', ','] },
        },
        serverInfo: { name: 'ScriptVault userscript language service', version: '1' },
      });
      break;
    case 'initialized':
      break;
    case 'textDocument/didOpen':
      if (uri) {
        documents.set(uri, String(textDocument.text || ''));
        publishDiagnostics(uri);
      }
      break;
    case 'textDocument/didChange':
      if (uri) {
        documents.set(uri, applyLspContentChanges(documents.get(uri) || '', params.contentChanges));
        publishDiagnostics(uri);
      }
      break;
    case 'textDocument/didClose':
      if (uri) {
        documents.delete(uri);
        send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri, diagnostics: [] } });
      }
      break;
    case 'textDocument/completion':
      respond(message.id, { items: getMetadataCompletions(documents.get(uri) || '', params.position as LspPosition), isIncomplete: false });
      break;
    case 'textDocument/signatureHelp':
      respond(message.id, getGmSignatureHelp(documents.get(uri) || '', params.position as LspPosition));
      break;
    case 'shutdown':
      respond(message.id, null);
      break;
    case 'exit':
      workerScope.close();
      break;
    default:
      if (message.id !== undefined) {
        send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method || ''}` } });
      }
  }
});
