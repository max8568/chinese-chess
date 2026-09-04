import { fileOf, idx, rankOf } from '../engine/types';

/**
 * Measured on assets/board/board-empty.png (2048x2304). The grid is evenly
 * spaced at 220px, with the top-left intersection at (144, 162).
 *
 * Swap these five numbers when swapping the board image. If a future board has
 * uneven spacing, replace `files` and `ranks` with literal coordinate arrays;
 * nothing else reads CELL or ORIGIN.
 */
const CELL = 220;
const ORIGIN_X = 144;
const ORIGIN_Y = 162;

export const BOARD = {
  width: 2048,
  height: 2304,
  files: Array.from({ length: 9 }, (_, i) => ORIGIN_X + i * CELL),
  ranks: Array.from({ length: 10 }, (_, i) => ORIGIN_Y + i * CELL),
  pieceDiameter: Math.round(CELL * 0.92),
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
