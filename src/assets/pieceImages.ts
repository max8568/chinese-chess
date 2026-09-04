import type { Piece } from '../engine/types';

const BASE = import.meta.env.BASE_URL;
export const BOARD_IMAGE_URL = `${BASE}board.webp`;
export function pieceImageUrl(piece: Piece): string {
  return `${BASE}pieces/${piece.side}/${piece.type}.png`;
}
