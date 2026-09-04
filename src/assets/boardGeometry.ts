import { fileOf, idx, rankOf } from '../engine/types';

/**
 * Measured on assets/board/board-empty.png (2048x1952). The AI-drawn grid is
 * not evenly spaced (the rightmost file is ~30% wider), so pieces are placed on
 * the measured intersections. Swap this table when swapping the board image.
 */
export const BOARD = {
  width: 2048,
  height: 1952,
  files: [97.5, 314.5, 536.5, 763.5, 991.5, 1215.5, 1439.5, 1660, 1950.5],
  ranks: [87, 280.5, 477, 677, 874.5, 1070.5, 1264, 1457.5, 1652.5, 1853],
  pieceDiameter: 180, // 0.92 x mean rank spacing (196)
};

const MIN_SPACING = Math.min(
  ...BOARD.files.slice(1).map((v, i) => v - BOARD.files[i]),
  ...BOARD.ranks.slice(1).map((v, i) => v - BOARD.ranks[i]),
);

export function squareCenter(i: number, flipped: boolean): { x: number; y: number } {
  const f = flipped ? 8 - fileOf(i) : fileOf(i);
  const r = flipped ? 9 - rankOf(i) : rankOf(i);
  return { x: BOARD.files[f], y: BOARD.ranks[r] };
}

export function nearestSquare(x: number, y: number, flipped: boolean): number | null {
  let bestF = 0;
  let bestR = 0;
  for (let f = 1; f < 9; f++) if (Math.abs(BOARD.files[f] - x) < Math.abs(BOARD.files[bestF] - x)) bestF = f;
  for (let r = 1; r < 10; r++) if (Math.abs(BOARD.ranks[r] - y) < Math.abs(BOARD.ranks[bestR] - y)) bestR = r;
  const dx = BOARD.files[bestF] - x;
  const dy = BOARD.ranks[bestR] - y;
  if (Math.hypot(dx, dy) > MIN_SPACING / 2) return null;
  const file = flipped ? 8 - bestF : bestF;
  const rank = flipped ? 9 - bestR : bestR;
  return idx(file, rank);
}
