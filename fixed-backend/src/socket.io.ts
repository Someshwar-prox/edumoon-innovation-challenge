/**
 * Socket.IO wrapper.
 *
 * socket.io does not ship its own TypeScript types in this project, so we
 * re-export the `Server` class lazily via `require`. This file compiles
 * even if `@types/socket.io` is not installed.
 */
type SocketIoServer = unknown;

let SocketIoServerClass: SocketIoServer = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SocketIoServerClass = require('socket.io').Server;
} catch {
  SocketIoServerClass = class {};
}

export const SocketIo = SocketIoServerClass;
export const socketIo = SocketIoServerClass;

export default SocketIoServerClass;
