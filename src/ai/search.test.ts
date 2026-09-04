import { describe, expect, it } from 'vitest';
import { applyMove, boardKey, initialBoard, parseBoard } from '../engine/board';
import { legalMoves } from '../engine/rules';
import { idx } from '../engine/types';
import { evaluate } from './evaluate';
import { chooseMove } from './search';

const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

describe('evaluate', () => {
  it('is symmetric in the opening and favours material', () => {
    const b = initialBoard();
    expect(evaluate(b, 'red') + evaluate(b, 'black')).toBe(0);
    const noBlackRook = parseBoard(['.neakaenr', '.........', '.c.....c.', 'p.p.p.p.p', '.........',
      '.........', 'P.P.P.P.P', '.C.....C.', '.........', 'RNEAKAENR']);
    expect(evaluate(noBlackRook, 'red')).toBeGreaterThan(800);
  });
});

describe('chooseMove level 1', () => {
  it('always captures when a capture exists', () => {
    // red rook at (0,8) can capture the black knight at (0,7); everything else is quiet
    const c = parseBoard(['....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', 'n........', 'R........', '...K.....']);
    for (let i = 0; i < 20; i++) {
      const m = chooseMove(c, 'red', 1, [], seeded(i));
      expect(m).toEqual({ from: idx(0, 8), to: idx(0, 7) });
    }
  });

  it('returns a legal move from the opening', () => {
    const b = initialBoard();
    const legal = legalMoves(b, 'red');
    const m = chooseMove(b, 'red', 1, [], seeded(7));
    expect(legal.some((l) => l.from === m!.from && l.to === m!.to)).toBe(true);
  });

  it('returns null when there are no legal moves', () => {
    const mated = parseBoard(['...k.....', '.........', '...R.....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']);
    expect(chooseMove(mated, 'black', 1, [])).toBeNull();
    expect(chooseMove(mated, 'black', 3, [])).toBeNull();
  });
});

describe('chooseMove level 2', () => {
  it('does not hang a rook to a one-move capture', () => {
    // red rook at (0,5) attacked by black rook at (0,0); red must move or defend it
    const b = parseBoard(['r...k....', '.........', '.........', '.........', '.........',
      'R........', '.........', '.........', '.........', '...K.....']);
    const m = chooseMove(b, 'red', 2, [], seeded(1))!;
    const after = applyMove(b, m).board;
    const blackCaptures = legalMoves(after, 'black').filter((bm) => after[bm.to]?.type === 'rook');
    expect(blackCaptures).toHaveLength(0);
  });
});

describe('chooseMove level 3', () => {
  it('finds mate in one', () => {
    // R(5,5)->(3,5) checks along file 3; (4,0) faces the red general, (3,1) stays on the file
    const b = parseBoard(['...k.....', '.........', 'R........', '.........', '.........',
      '.....R...', '.........', '.........', '.........', '....K....']);
    const m = chooseMove(b, 'red', 3, [], seeded(3))!;
    const after = applyMove(b, m).board;
    expect(legalMoves(after, 'black')).toHaveLength(0);
  });

  it('avoids repeating a recent position when an equal alternative exists', () => {
    const b = initialBoard();
    const first = chooseMove(b, 'red', 2, [], seeded(5))!;
    const repeatKey = boardKey(applyMove(b, first).board, 'black');
    const second = chooseMove(b, 'red', 2, [repeatKey], seeded(5))!;
    expect(boardKey(applyMove(b, second).board, 'black')).not.toBe(repeatKey);
  });

  it('answers within the time limit from the opening', () => {
    const start = Date.now();
    const m = chooseMove(initialBoard(), 'red', 3, [], seeded(9), 1500);
    expect(m).not.toBeNull();
    expect(Date.now() - start).toBeLessThan(2500);
  });
});
