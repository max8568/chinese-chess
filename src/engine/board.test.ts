import { describe, expect, it } from 'vitest';
import { applyMove, boardKey, initialBoard, parseBoard } from './board';
import { idx } from './types';

describe('initialBoard', () => {
  it('places 32 pieces in the standard opening', () => {
    const b = initialBoard();
    expect(b.filter(Boolean)).toHaveLength(32);
    expect(b[idx(4, 0)]).toEqual({ side: 'black', type: 'general' });
    expect(b[idx(4, 9)]).toEqual({ side: 'red', type: 'general' });
    expect(b[idx(1, 2)]).toEqual({ side: 'black', type: 'cannon' });
    expect(b[idx(0, 6)]).toEqual({ side: 'red', type: 'soldier' });
    expect(b[idx(8, 9)]).toEqual({ side: 'red', type: 'rook' });
  });
});

describe('parseBoard', () => {
  it('round-trips the initial position', () => {
    const rows = [
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
    ];
    expect(parseBoard(rows)).toEqual(initialBoard());
  });
});

describe('applyMove', () => {
  it('moves a piece and reports the capture without mutating the input', () => {
    const b = initialBoard();
    const from = idx(1, 7); // red cannon
    const to = idx(1, 0); // black knight
    const r = applyMove(b, { from, to });
    expect(r.captured).toEqual({ side: 'black', type: 'knight' });
    expect(r.board[to]).toEqual({ side: 'red', type: 'cannon' });
    expect(r.board[from]).toBeNull();
    expect(b[from]).toEqual({ side: 'red', type: 'cannon' });
  });
});

describe('boardKey', () => {
  it('differs by side to move and by position', () => {
    const b = initialBoard();
    expect(boardKey(b, 'red')).not.toEqual(boardKey(b, 'black'));
    const moved = applyMove(b, { from: idx(0, 6), to: idx(0, 5) }).board;
    expect(boardKey(moved, 'black')).not.toEqual(boardKey(b, 'black'));
  });
});
