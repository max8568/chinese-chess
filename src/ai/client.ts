import type { Board, Move, Side } from '../engine/types';
import type { Level } from './search';
import type { AiRequest, AiResponse } from './worker';

export class AiClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, (m: Move | null) => void>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const resolve = this.pending.get(e.data.id);
      if (resolve) {
        this.pending.delete(e.data.id);
        resolve(e.data.move);
      }
    };
  }

  /** Resolves after the search finishes AND at least `minDelayMs` has elapsed. */
  think(board: Board, side: Side, level: Level, recentKeys: string[], minDelayMs = 600): Promise<Move | null> {
    const id = this.nextId++;
    const req: AiRequest = { id, board, side, level, recentKeys };
    const search = new Promise<Move | null>((resolve) => this.pending.set(id, resolve));
    const delay = new Promise<void>((r) => setTimeout(r, minDelayMs));
    this.worker.postMessage(req);
    return Promise.all([search, delay]).then(([m]) => m);
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
