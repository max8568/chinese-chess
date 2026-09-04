import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { idx } from './types';

describe('Game', () => {
  it('alternates turns and records history', () => {
    const g = new Game();
    expect(g.turn).toBe('red');
    g.play({ from: idx(1, 7), to: idx(4, 7) }); // cannon to centre
    expect(g.turn).toBe('black');
    expect(g.history).toHaveLength(1);
    expect(g.board[idx(4, 7)]).toEqual({ side: 'red', type: 'cannon' });
  });

  it('rejects illegal moves and moves out of turn', () => {
    const g = new Game();
    expect(() => g.play({ from: idx(0, 0), to: idx(0, 1) })).toThrow(); // black piece on red turn
    expect(() => g.play({ from: idx(0, 9), to: idx(0, 5) })).toThrow(); // rook blocked
  });

  it('undo restores the board, the turn and the captured piece', () => {
    const g = new Game();
    g.play({ from: idx(1, 7), to: idx(4, 7) });
    g.play({ from: idx(0, 3), to: idx(0, 4) });
    g.play({ from: idx(4, 7), to: idx(4, 3) }); // cannon captures black soldier at (4,3)
    expect(g.captured('red')).toEqual([{ side: 'black', type: 'soldier' }]);
    const undone = g.undo();
    expect(undone?.captured).toEqual({ side: 'black', type: 'soldier' });
    expect(g.board[idx(4, 3)]).toEqual({ side: 'black', type: 'soldier' });
    expect(g.board[idx(4, 7)]).toEqual({ side: 'red', type: 'cannon' });
    expect(g.turn).toBe('red');
    expect(g.captured('red')).toEqual([]);
    expect(g.history).toHaveLength(2);
  });

  it('undo on an empty history returns undefined', () => {
    expect(new Game().undo()).toBeUndefined();
  });

  it('recentKeys returns the last n position keys including the current one', () => {
    const g = new Game();
    g.play({ from: idx(1, 7), to: idx(4, 7) });
    g.play({ from: idx(0, 3), to: idx(0, 4) });
    const keys = g.recentKeys(4);
    expect(keys).toHaveLength(3); // start + 2 moves
    expect(new Set(keys).size).toBe(3);
  });
});
