export class MeetingWsClient {
  constructor({ url, onOpen = () => {}, onMessage = () => {}, onClose = () => {}, onError = () => {} }) {
    this.url = url;
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.onError = onError;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = () => this.onOpen();
    this.ws.onclose = (event) => this.onClose(event);
    this.ws.onerror = (event) => this.onError(event);
    this.ws.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(event.data));
      } catch {
        this.onMessage({ raw: event.data });
      }
    };
  }

  get isOpen() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  sendJson(payload) {
    if (!this.isOpen) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  sendBytes(buffer) {
    if (!this.isOpen) return false;
    this.ws.send(buffer);
    return true;
  }

  close() {
    if (this.ws) this.ws.close();
    this.ws = null;
  }
}
