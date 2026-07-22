type MessageHandler = (data: any) => void;

interface WsConfig {
  url: string;
  token: string;
  onMessage: (msg: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private config: WsConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: WsConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 50,
      ...config,
    };
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    const fullUrl = `${this.config.url}?token=${this.config.token}`;
    this.ws = new WebSocket(fullUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.config.onConnect?.();
      this.pingInterval = setInterval(() => {
        this.send({ type: "ping" });
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "pong") return;
        this.config.onMessage(msg);
      } catch {
        // ignore invalid JSON
      }
    };

    this.ws.onclose = () => {
      this.config.onDisconnect?.();
      this.cleanupPing();
      this.tryReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  disconnect() {
    this.reconnectAttempts = this.config.maxReconnectAttempts!;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupPing();
    this.ws?.close();
    this.ws = null;
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) return;
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval);
  }

  private cleanupPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
