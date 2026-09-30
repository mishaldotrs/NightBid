// The indexer provider imports `{ WebSocket }` from isomorphic-ws, whose
// browser build only has a default export. Re-export the native one both ways.
const NativeWebSocket = globalThis.WebSocket;

export { NativeWebSocket as WebSocket };
export default NativeWebSocket;
