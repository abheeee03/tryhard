// shims/ws-shim.js
// rpc-websockets (used by @solana/web3.js) tries to import the 'ws' package
// in Node.js environments. In React Native we use the native WebSocket global,
// so we just re-export that here.
module.exports = WebSocket;
module.exports.default = WebSocket;
