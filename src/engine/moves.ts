import type { Board, Move, Side } from './types';
import { fileOf, idx, inBoard, rankOf } from './types';

export function forward(side: Side): number {
  return side === 'red' ? -1 : 1;
}
export function inPalace(file: number, rank: number, side: Side): boolean {
  if (file < 3 || file > 5) return false;
  return side === 'red' ? rank >= 7 : rank <= 2;
}
export function ownHalf(rank: number, side: Side): boolean {
  return side === 'red' ? rank >= 5 : rank <= 4;
}
export function crossedRiver(rank: number, side: Side): boolean {
  return !ownHalf(rank, side);
}

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const KNIGHT = [
  [1, 2],
  [-1, 2],
  [1, -2],
  [-1, -2],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
] as const;

export function pseudoMovesFrom(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];
  const f = fileOf(from);
  const r = rankOf(from);
  const side = piece.side;
  const out: Move[] = [];
  const push = (tf: number, tr: number) => {
    if (!inBoard(tf, tr)) return false;
    const target = board[idx(tf, tr)];
    if (target && target.side === side) return false;
    out.push({ from, to: idx(tf, tr) });
    return true;
  };

  switch (piece.type) {
    case 'general':
      for (const [df, dr] of ORTHO) {
        if (inPalace(f + df, r + dr, side)) push(f + df, r + dr);
      }
      break;
    case 'advisor':
      for (const [df, dr] of DIAG) {
        if (inPalace(f + df, r + dr, side)) push(f + df, r + dr);
      }
      break;
    case 'elephant':
      for (const [df, dr] of DIAG) {
        const tf = f + 2 * df;
        const tr = r + 2 * dr;
        if (!inBoard(tf, tr) || !ownHalf(tr, side)) continue;
        if (board[idx(f + df, r + dr)]) continue; // eye blocked
        push(tf, tr);
      }
      break;
    case 'knight':
      for (const [df, dr] of KNIGHT) {
        const legF = f + (Math.abs(df) === 2 ? Math.sign(df) : 0);
        const legR = r + (Math.abs(dr) === 2 ? Math.sign(dr) : 0);
        if (!inBoard(legF, legR) || board[idx(legF, legR)]) continue;
        push(f + df, r + dr);
      }
      break;
    case 'rook':
      for (const [df, dr] of ORTHO) {
        let tf = f + df;
        let tr = r + dr;
        while (inBoard(tf, tr)) {
          const target = board[idx(tf, tr)];
          if (target) {
            if (target.side !== side) out.push({ from, to: idx(tf, tr) });
            break;
          }
          out.push({ from, to: idx(tf, tr) });
          tf += df;
          tr += dr;
        }
      }
      break;
    case 'cannon':
      for (const [df, dr] of ORTHO) {
        let tf = f + df;
        let tr = r + dr;
        let screened = false;
        while (inBoard(tf, tr)) {
          const target = board[idx(tf, tr)];
          if (!screened) {
            if (target) screened = true;
            else out.push({ from, to: idx(tf, tr) });
          } else if (target) {
            if (target.side !== side) out.push({ from, to: idx(tf, tr) });
            break;
          }
          tf += df;
          tr += dr;
        }
      }
      break;
    case 'soldier': {
      push(f, r + forward(side));
      if (crossedRiver(r, side)) {
        push(f - 1, r);
        push(f + 1, r);
      }
      break;
    }
  }
  return out;
}

export function pseudoMoves(board: Board, side: Side): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && p.side === side) out.push(...pseudoMovesFrom(board, i));
  }
  return out;
}
