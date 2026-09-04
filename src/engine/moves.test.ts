import { describe, expect, it } from 'vitest';
import { parseBoard } from './board';
import { pseudoMovesFrom } from './moves';
import { idx } from './types';

const EMPTY = ['.........', '.........', '.........', '.........', '.........',
  '.........', '.........', '.........', '.........', '.........'];

function withPieces(placements: Array<[string, number, number]>): string[] {
  const rows = EMPTY.map((r) => r.split(''));
  for (const [ch, f, r] of placements) rows[r][f] = ch;
  return rows.map((r) => r.join(''));
}

function targets(rows: string[], f: number, r: number): number[] {
  return pseudoMovesFrom(parseBoard(rows), idx(f, r)).map((m) => m.to).sort((a, b) => a - b);
}
const T = (...pts: Array<[number, number]>) => pts.map(([f, r]) => idx(f, r)).sort((a, b) => a - b);

describe('general', () => {
  it('moves one step orthogonally inside the palace', () => {
    expect(targets(withPieces([['K', 4, 8]]), 4, 8)).toEqual(T([3, 8], [5, 8], [4, 7], [4, 9]));
    expect(targets(withPieces([['K', 3, 9]]), 3, 9)).toEqual(T([4, 9], [3, 8]));
  });
});

describe('advisor', () => {
  it('moves diagonally inside the palace only', () => {
    expect(targets(withPieces([['A', 4, 8]]), 4, 8)).toEqual(T([3, 7], [5, 7], [3, 9], [5, 9]));
    expect(targets(withPieces([['A', 3, 9]]), 3, 9)).toEqual(T([4, 8]));
  });
});

describe('elephant', () => {
  it('moves two diagonally when the eye is empty and stays on its own half', () => {
    expect(targets(withPieces([['E', 4, 7]]), 4, 7)).toEqual(T([2, 5], [6, 5], [2, 9], [6, 9]));
    expect(targets(withPieces([['E', 4, 7], ['P', 3, 6]]), 4, 7)).toEqual(T([6, 5], [2, 9], [6, 9]));
    expect(targets(withPieces([['E', 2, 5]]), 2, 5)).toEqual(T([0, 7], [4, 7]));
    expect(targets(withPieces([['e', 2, 4]]), 2, 4)).toEqual(T([0, 2], [4, 2]));
  });
});

describe('knight', () => {
  it('moves in an L unless the leg is blocked', () => {
    expect(targets(withPieces([['N', 4, 5]]), 4, 5)).toEqual(
      T([3, 3], [5, 3], [2, 4], [6, 4], [2, 6], [6, 6], [3, 7], [5, 7]),
    );
    // block the upward leg (4,4): removes (3,3) and (5,3)
    expect(targets(withPieces([['N', 4, 5], ['p', 4, 4]]), 4, 5)).toEqual(
      T([2, 4], [6, 4], [2, 6], [6, 6], [3, 7], [5, 7]),
    );
  });
});

describe('rook', () => {
  it('slides until blocked and captures the first enemy piece', () => {
    expect(targets(withPieces([['R', 0, 9], ['P', 0, 6], ['n', 3, 9]]), 0, 9)).toEqual(
      T([0, 8], [0, 7], [1, 9], [2, 9], [3, 9]),
    );
  });
});

describe('cannon', () => {
  it('slides to empty squares and captures only by jumping one screen', () => {
    // C at (1,7); P at (1,4) is a screen; n at (1,1) is capturable; r behind it is not
    const rows = withPieces([['C', 1, 7], ['P', 1, 4], ['n', 1, 1], ['r', 1, 0], ['N', 3, 7]]);
    expect(targets(rows, 1, 7)).toEqual(T([1, 6], [1, 5], [1, 1], [0, 7], [2, 7], [1, 8], [1, 9]));
  });
  it('cannot capture an adjacent piece without a screen', () => {
    expect(targets(withPieces([['C', 4, 5], ['n', 4, 4]]), 4, 5)).toEqual(
      T([0, 5], [1, 5], [2, 5], [3, 5], [5, 5], [6, 5], [7, 5], [8, 5], [4, 6], [4, 7], [4, 8], [4, 9]),
    );
  });
});

describe('soldier', () => {
  it('moves forward only before the river and sideways too after crossing', () => {
    expect(targets(withPieces([['P', 2, 6]]), 2, 6)).toEqual(T([2, 5]));
    expect(targets(withPieces([['P', 2, 4]]), 2, 4)).toEqual(T([2, 3], [1, 4], [3, 4]));
    expect(targets(withPieces([['p', 2, 3]]), 2, 3)).toEqual(T([2, 4]));
    expect(targets(withPieces([['p', 2, 5]]), 2, 5)).toEqual(T([2, 6], [1, 5], [3, 5]));
    expect(targets(withPieces([['P', 2, 0]]), 2, 0)).toEqual(T([1, 0], [3, 0]));
  });
  it('never captures its own piece', () => {
    expect(targets(withPieces([['P', 2, 6], ['N', 2, 5]]), 2, 6)).toEqual([]);
  });
});
