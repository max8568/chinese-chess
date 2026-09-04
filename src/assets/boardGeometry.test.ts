import { describe, expect, it } from 'vitest';
import { idx } from '../engine/types';
import { BOARD, nearestSquare, squareCenter } from './boardGeometry';

describe('boardGeometry', () => {
  it('has 9 files and 10 ranks in ascending order', () => {
    expect(BOARD.files).toHaveLength(9);
    expect(BOARD.ranks).toHaveLength(10);
    expect([...BOARD.files].sort((a, b) => a - b)).toEqual(BOARD.files);
    expect([...BOARD.ranks].sort((a, b) => a - b)).toEqual(BOARD.ranks);
  });
  it('maps squares to centers and flips correctly', () => {
    expect(squareCenter(idx(0, 0), false)).toEqual({ x: BOARD.files[0], y: BOARD.ranks[0] });
    expect(squareCenter(idx(0, 0), true)).toEqual({ x: BOARD.files[8], y: BOARD.ranks[9] });
  });
  it('finds the nearest square only when close enough', () => {
    const c = squareCenter(idx(4, 5), false);
    expect(nearestSquare(c.x + 30, c.y - 30, false)).toBe(idx(4, 5));
    expect(nearestSquare(c.x + 30, c.y - 30, true)).toBe(idx(8 - 4, 9 - 5));
    expect(nearestSquare(5, 5, false)).toBeNull();
  });
});
