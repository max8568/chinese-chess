export type SoundName = 'drop' | 'capture' | 'check' | 'win';
const NAMES: SoundName[] = ['drop', 'capture', 'check', 'win'];

/**
 * Synthesized sounds via Web Audio. If `<base>/sounds/<name>.mp3` exists it is
 * used instead, so real recordings can be dropped in later without code changes.
 */
export class Sounds {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private fileUrls = new Map<SoundName, string>();

  constructor() {
    const base = import.meta.env.BASE_URL;
    for (const n of NAMES) {
      const url = `${base}sounds/${n}.mp3`;
      fetch(url, { method: 'HEAD' })
        .then((r) => {
          if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')) this.fileUrls.set(n, url);
        })
        .catch(() => undefined);
    }
  }

  /** Call on the first user gesture; browsers block audio before that. */
  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SoundName): void {
    this.unlock();
    const ctx = this.ctx!;
    const url = this.fileUrls.get(name);
    if (url) {
      void this.playFile(name, url);
      return;
    }
    const t = ctx.currentTime;
    switch (name) {
      case 'drop':
        this.thump(t, 180, 0.12, 0.9);
        this.noise(t, 0.03, 0.35);
        break;
      case 'capture':
        this.noise(t, 0.04, 0.5);
        this.thump(t, 140, 0.16, 1);
        this.thump(t + 0.09, 110, 0.18, 0.8);
        break;
      case 'check':
        this.tone(t, 880, 0.12, 0.35);
        this.tone(t + 0.14, 880, 0.12, 0.35);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.13, f, 0.22, 0.35));
        break;
    }
  }

  private async playFile(name: SoundName, url: string): Promise<void> {
    const ctx = this.ctx!;
    let buf = this.buffers.get(name);
    if (!buf) {
      const data = await (await fetch(url)).arrayBuffer();
      buf = await ctx.decodeAudioData(data);
      this.buffers.set(name, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  }

  private thump(t: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  private noise(t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  }

  private tone(t: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }
}
