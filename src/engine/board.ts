import type { Board, Cell, Move, PieceType, Side } from './types';
import { FILES, RANKS } from './types';

export const LETTER: Record<PieceType, string> = {
  general: 'K',
  advisor: 'A',
  elephant: 'E',
  knight: 'N',
  rook: 'R',
  cannon: 'C',
  soldier: 'P',
};
const TYPE_BY_LETTER: Record<string, PieceType> = Object.fromEntries(
  Object.entries(LETTER).map(([t, l]) => [l, t as PieceType]),
);

/** Parse 10 rows of 9 chars. Uppercase = red, lowercase = black, '.' = empty. */
export function parseBoard(rows: string[]): Board {
  if (rows.length !== RANKS) throw new Error(`expected ${RANKS} rows`);
  const board: Board = [];
  for (const row of rows) {
    if (row.length !== FILES) throw new Error(`row "${row}" must have ${FILES} chars`);
    for (const ch of row) {
      if (ch === '.') {
        board.push(null);
        continue;
      }
      const type = TYPE_BY_LETTER[ch.toUpperCase()];
      if (!type) throw new Error(`unknown piece letter "${ch}"`);
      board.push({ side: ch === ch.toUpperCase() ? 'red' : 'black', type });
    }
  }
  return board;
}

export function initialBoard(): Board {
  return parseBoard([
    'rneakaenr',
    '.........',
    '.c.....c.',
    'p.p.p.p.p',
    '.........',
    '.........',
    'P.P.P.P.P',
    '.C.....C.',
    '.........',
    'RNEAKAENR',
  ]);
}

export function applyMove(board: Board, move: Move): { board: Board; captured: Cell } {
  const next = board.slice();
  const captured = next[move.to];
  next[move.to] = next[move.from];
  next[move.from] = null;
  return { board: next, captured };
}

/** Compact string identifying position + side to move (for repetition checks). */
export function boardKey(board: Board, side: Side): string {
  let s = side === 'red' ? 'r' : 'b';
  for (const c of board) {
    if (!c) s += '.';
    else s += c.side === 'red' ? LETTER[c.type] : LETTER[c.type].toLowerCase();
  }
  return s;
}
