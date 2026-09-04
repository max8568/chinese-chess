import { pieceImageUrl } from '../assets/pieceImages';
import type { Piece, PieceType } from '../engine/types';

const ORDER: PieceType[] = ['rook', 'knight', 'cannon', 'elephant', 'advisor', 'soldier'];

/** One strip of captured pieces, grouped by type with a count. */
export class CapturedBar {
  private root = document.createElement('div');

  constructor(container: HTMLElement) {
    this.root.className = 'captured';
    container.append(this.root);
  }

  render(pieces: Piece[]): void {
    this.root.replaceChildren();
    for (const type of ORDER) {
      const group = pieces.filter((p) => p.type === type);
      if (group.length === 0) continue;
      const item = document.createElement('div');
      item.className = 'captured-item';
      const img = document.createElement('img');
      img.src = pieceImageUrl(group[0]);
      img.alt = type;
      const count = document.createElement('span');
      count.textContent = `×${group.length}`;
      item.append(img, count);
      this.root.append(item);
    }
  }
}
