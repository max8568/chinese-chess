import { crossedRiver } from '../engine/moves';
import type { Board, PieceType, Side } from '../engine/types';
import { fileOf, rankOf } from '../engine/types';

export const VALUE: Record<PieceType, number> = {
  general: 10000,
  rook: 900,
  cannon: 450,
  knight: 400,
  elephant: 200,
  advisor: 200,
  soldier: 100,
};

function pieceScore(type: PieceType, file: number, rank: number, side: Side): number {
  let s = VALUE[type];
  if (type === 'soldier' && crossedRiver(rank, side)) {
    s += 100;
    // deeper into the enemy camp is better (rank 0 for red, rank 9 for black)
    const depth = side === 'red' ? 4 - rank : rank - 5;
    s += depth * 10;
  }
  if ((type === 'knight' || type === 'rook') && file >= 3 && file <= 5) s += 10;
  return s;
}

/** Positive = good for `side`. */
export function evaluate(board: Board, side: Side): number {
  let total = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) continue;
    const s = pieceScore(p.type, fileOf(i), rankOf(i), p.side);
    total += p.side === side ? s : -s;
  }
  return total;
}
