import type { Board, Move, Side } from '../engine/types';
import { chooseMove, type Level } from './search';

export interface AiRequest {
  id: number;
  board: Board;
  side: Side;
  level: Level;
  recentKeys: string[];
}
export interface AiResponse {
  id: number;
  move: Move | null;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, board, side, level, recentKeys } = e.data;
  const move = chooseMove(board, side, level, recentKeys);
  const res: AiResponse = { id, move };
  (self as unknown as Worker).postMessage(res);
};
