import { applyMove } from './board';
import { crossedRiver, forward, pseudoMoves, pseudoMovesFrom } from './moves';
import type { Board, Move, Side } from './types';
import { fileOf, idx, inBoard, opposite, rankOf } from './types';

export type Status = { kind: 'playing' } | { kind: 'checkmate' | 'stalemate'; winner: Side };

export function findGeneral(board: Board, side: Side): number {
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && p.side === side && p.type === 'general') return i;
  }
  return -1;
}

export function generalsFacing(board: Board): boolean {
  const r = findGeneral(board, 'red');
  const b = findGeneral(board, 'black');
  if (r < 0 || b < 0 || fileOf(r) !== fileOf(b)) return false;
  const f = fileOf(r);
  for (let rank = rankOf(b) + 1; rank < rankOf(r); rank++) {
    if (board[idx(f, rank)]) return false;
  }
  return true;
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const KNIGHT = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]] as const;

/** Is `side`'s general attacked (or facing the enemy general)? */
export function inCheck(board: Board, side: Side): boolean {
  const g = findGeneral(board, side);
  if (g < 0) return true; // no general = lost
  const enemy = opposite(side);
  const f = fileOf(g);
  const r = rankOf(g);

  // rook / cannon along four rays
  for (const [df, dr] of ORTHO) {
    let tf = f + df;
    let tr = r + dr;
    let seen = 0;
    while (inBoard(tf, tr)) {
      const p = board[idx(tf, tr)];
      if (p) {
        seen++;
        if (p.side === enemy) {
          if (seen === 1 && p.type === 'rook') return true;
          if (seen === 2 && p.type === 'cannon') return true;
        }
        if (seen === 2) break;
      }
      tf += df;
      tr += dr;
    }
  }
  // knight: enemy knight at (f+df, r+dr) attacks g if its leg square is empty
  for (const [df, dr] of KNIGHT) {
    const nf = f + df;
    const nr = r + dr;
    if (!inBoard(nf, nr)) continue;
    const p = board[idx(nf, nr)];
    if (!p || p.side !== enemy || p.type !== 'knight') continue;
    const legF = nf - (Math.abs(df) === 2 ? Math.sign(df) : 0);
    const legR = nr - (Math.abs(dr) === 2 ? Math.sign(dr) : 0);
    if (!board[idx(legF, legR)]) return true;
  }
  // soldier: enemy soldier one step "behind" (relative to its forward) or beside after crossing
  const behindR = r - forward(enemy);
  if (inBoard(f, behindR)) {
    const p = board[idx(f, behindR)];
    if (p && p.side === enemy && p.type === 'soldier') return true;
  }
  for (const sf of [f - 1, f + 1]) {
    if (!inBoard(sf, r)) continue;
    const p = board[idx(sf, r)];
    if (p && p.side === enemy && p.type === 'soldier' && crossedRiver(r, enemy)) return true;
  }
  return generalsFacing(board);
}

export function legalMovesFrom(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];
  return pseudoMovesFrom(board, from).filter((m) => !inCheck(applyMove(board, m).board, piece.side));
}

export function legalMoves(board: Board, side: Side): Move[] {
  return pseudoMoves(board, side).filter((m) => !inCheck(applyMove(board, m).board, side));
}

export function gameStatus(board: Board, sideToMove: Side): Status {
  if (legalMoves(board, sideToMove).length > 0) return { kind: 'playing' };
  return {
    kind: inCheck(board, sideToMove) ? 'checkmate' : 'stalemate',
    winner: opposite(sideToMove),
  };
}

export function givesCheck(board: Board, move: Move): boolean {
  const mover = board[move.from];
  if (!mover) return false;
  return inCheck(applyMove(board, move).board, opposite(mover.side));
}
