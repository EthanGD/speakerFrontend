export class AudioCapture {
  constructor({ targetSampleRate = 16000, onPcmFrame = () => {}, onVolume = () => {} } = {}) {
    this.targetSampleRate = targetSampleRate;
    this.onPcmFrame = onPcmFrame;
    this.onVolume = onVolume;
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processor = null;
    this.buffer = new Int16Array(0);
  }

  async start() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: this.targetSampleRate,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    });
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => this.handleAudioProcess(event);
    this.sourceNode.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  async stop() {
    if (this.processor) this.processor.disconnect();
    if (this.sourceNode) this.sourceNode.disconnect();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.audioContext) await this.audioContext.close();
    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processor = null;
    this.buffer = new Int16Array(0);
  }

  handleAudioProcess(event) {
    const input = event.inputBuffer.getChannelData(0);
    let sumSq = 0;
    for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i];
    const rms = Math.sqrt(sumSq / Math.max(1, input.length));
    this.onVolume(rms);

    const downsampled = this.downsampleTo16k(input, this.audioContext.sampleRate);
    const pcm16 = this.floatTo16BitPCM(downsampled);
    this.buffer = this.concatInt16(this.buffer, pcm16);
    const frameSamples = this.targetSampleRate / 10;
    while (this.buffer.length >= frameSamples) {
      const frame = this.buffer.slice(0, frameSamples);
      this.buffer = this.buffer.slice(frameSamples);
      this.onPcmFrame(new Uint8Array(frame.buffer));
    }
  }

  downsampleTo16k(float32Array, inSampleRate) {
    if (inSampleRate === this.targetSampleRate) return float32Array;
    const ratio = inSampleRate / this.targetSampleRate;
    const newLen = Math.floor(float32Array.length / ratio);
    const out = new Float32Array(newLen);
    let offset = 0;
    for (let i = 0; i < newLen; i++) {
      const next = Math.floor((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = offset; j < next && j < float32Array.length; j++) {
        sum += float32Array[j];
        count += 1;
      }
      out[i] = count ? sum / count : 0;
      offset = next;
    }
    return out;
  }

  floatTo16BitPCM(float32Array) {
    const out = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let sample = float32Array[i];
      if (sample > 1) sample = 1;
      if (sample < -1) sample = -1;
      out[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
    }
    return out;
  }

  concatInt16(a, b) {
    const out = new Int16Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
}
