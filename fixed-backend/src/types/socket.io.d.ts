declare module 'socket.io' {
  import { Server as HttpServer } from 'http';

  interface ServerOptions {
    path?: string;
    serveClient?: boolean;
    adapter?: unknown;
    parser?: unknown;
    pingInterval?: number;
    pingTimeout?: number;
    cors?: {
      origin?: string | string[] | boolean;
      methods?: string | string[];
      allowedHeaders?: string | string[];
      credentials?: boolean;
    };
  }

  export class Server {
    constructor(server?: HttpServer, opts?: ServerOptions);
    on(event: 'connection', listener: (socket: unknown) => void): this;
    emit(event: string, ...args: unknown[]): boolean;
  }

  export class Socket {
    id: string;
    on(event: string, listener: (...args: unknown[]) => void): this;
    emit(event: string, ...args: unknown[]): boolean;
    disconnect(close?: boolean): this;
  }
}
