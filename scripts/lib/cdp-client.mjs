function createSocketMessage(raw) {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString("utf8");
  }
  return String(raw ?? "");
}

export class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;

    socket.addEventListener("message", (event) => {
      this.#handleMessage(createSocketMessage(event.data));
    });
    socket.addEventListener("close", () => {
      this.closed = true;
      this.#rejectPending(new Error("CDP socket closed"));
    });
    socket.addEventListener("error", () => {
      this.#rejectPending(new Error("CDP socket error"));
    });
  }

  static async connect(wsUrl, options = {}) {
    const timeoutMs = options.timeoutMs ?? 10000;

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const timer = setTimeout(() => {
        socket.close();
        reject(new Error("Timed out connecting to the browser CDP endpoint"));
      }, timeoutMs);

      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve(new CdpClient(socket));
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("Failed to connect to the browser CDP endpoint"));
        },
        { once: true },
      );
    });
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  #handleMessage(raw) {
    const message = JSON.parse(raw);
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message ?? "CDP request failed"));
        return;
      }
      pending.resolve(message.result ?? {});
      return;
    }

    if (!message.method) {
      return;
    }

    const handlers = this.listeners.get(message.method);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(message.params ?? {});
    }
  }

  async send(method, params = {}) {
    if (this.closed) {
      throw new Error("CDP socket is closed");
    }

    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) ?? new Set();
    handlers.add(handler);
    this.listeners.set(method, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(method);
      }
    };
  }

  waitForEvent(method, options = {}) {
    const timeoutMs = options.timeoutMs ?? 10000;
    const predicate = options.predicate ?? (() => true);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);

      const unsubscribe = this.on(method, (params) => {
        if (!predicate(params)) {
          return;
        }
        clearTimeout(timer);
        unsubscribe();
        resolve(params);
      });
    });
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.socket.close();
  }
}
