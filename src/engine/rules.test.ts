import { describe, expect, it } from 'vitest';
import { parseBoard } from './board';
import { gameStatus, generalsFacing, givesCheck, inCheck, legalMoves, legalMovesFrom } from './rules';
import { idx } from './types';

const B = (rows: string[]) => parseBoard(rows);

describe('inCheck', () => {
  it('detects rook, cannon, knight and soldier attacks on the general', () => {
    expect(inCheck(B([
      '....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '....R....']), 'black')).toBe(true);
    // cannon needs exactly one screen
    expect(inCheck(B([
      '....k....', '.........', '....p....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....C....']), 'black')).toBe(true);
    expect(inCheck(B([
      '....k....', '.........', '....p....', '....p....', '.........',
      '.........', '.........', '.........', '.........', '....C....']), 'black')).toBe(false);
    // knight at (3,2) attacks (4,0) if leg (3,1) is empty
    expect(inCheck(B([
      '....k....', '.........', '...N.....', '.........', '.........',
      '.........', '.........', '.........', '.........', '...K.....']), 'black')).toBe(true);
    expect(inCheck(B([
      '....k....', '...p.....', '...N.....', '.........', '.........',
      '.........', '.........', '.........', '.........', '...K.....']), 'black')).toBe(false);
    // red soldier directly below the black general (moves upward)
    expect(inCheck(B([
      '....k....', '....P....', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '...K.....']), 'black')).toBe(true);
    // soldier beside general attacks after crossing the river (rank 0 is across for red)
    expect(inCheck(B([
      '...Pk....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '...K.....']), 'black')).toBe(true);
  });

  it('treats facing generals as check', () => {
    const rows = ['....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....'];
    expect(generalsFacing(B(rows))).toBe(true);
    expect(inCheck(B(rows), 'red')).toBe(true);
    const blocked = rows.slice();
    blocked[5] = '....p....';
    expect(generalsFacing(B(blocked))).toBe(false);
  });
});

describe('legalMoves', () => {
  it('forbids moves that leave own general in check', () => {
    // red general at (4,9), black rook at (4,0), red advisor at (4,8) pinned
    const b = B(['....r....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '....A....', '....K....']);
    const advisorTargets = legalMovesFrom(b, idx(4, 8)).map((m) => m.to);
    expect(advisorTargets).toEqual([]);
    const generalTargets = legalMovesFrom(b, idx(4, 9)).map((m) => m.to).sort((a, c) => a - c);
    expect(generalTargets).toEqual([idx(3, 9), idx(5, 9)].sort((a, c) => a - c));
  });

  it('forbids the general from stepping into the facing file', () => {
    const b = B(['....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '...K.....']);
    const t = legalMovesFrom(b, idx(3, 9)).map((m) => m.to);
    expect(t).not.toContain(idx(4, 9));
    expect(t).toContain(idx(3, 8));
  });

  it('returns 44 legal moves for red in the opening', () => {
    expect(legalMoves(parseBoard(['rneakaenr', '.........', '.c.....c.', 'p.p.p.p.p', '.........',
      '.........', 'P.P.P.P.P', '.C.....C.', '.........', 'RNEAKAENR']), 'red')).toHaveLength(44);
  });
});

describe('gameStatus', () => {
  it('reports checkmate', () => {
    const b = B(['...k.....', '.........', '..R.R....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']);
    const mate = B(['...k.....', '.........', '...R.....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']);
    expect(gameStatus(b, 'black').kind).toBe('playing');
    // general at (3,0) can go to (4,0) or (3,1); (3,1) attacked by rook, (4,0) faces red general at (4,9)
    expect(gameStatus(mate, 'black')).toEqual({ kind: 'checkmate', winner: 'red' });
  });

  it('reports stalemate as a loss for the side to move', () => {
    const b = B(['...k.....', '....R....', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '.....K...']);
    // black general at (3,0): (4,0) attacked by rook (4,1); (3,1) attacked by rook along rank 1;
    // red general on file 5 so the generals do not face each other
    expect(inCheck(b, 'black')).toBe(false);
    expect(gameStatus(b, 'black')).toEqual({ kind: 'stalemate', winner: 'red' });
  });
});

describe('givesCheck', () => {
  it('is true when the move attacks the enemy general', () => {
    const b = B(['....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', 'R..K.....']);
    expect(givesCheck(b, { from: idx(0, 9), to: idx(0, 0) })).toBe(true);
    expect(givesCheck(b, { from: idx(0, 9), to: idx(0, 8) })).toBe(false);
  });
});
