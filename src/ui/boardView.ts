import { BOARD, nearestSquare, squareCenter } from '../assets/boardGeometry';
import { BOARD_IMAGE_URL, pieceImageUrl } from '../assets/pieceImages';
import type { Board } from '../engine/types';

export interface BoardViewHandlers {
  /** Pointer went down on a piece. Return true to allow selecting / dragging it. */
  onPickUp(square: number): boolean;
  /** Drag ended. `to` is null when released off-board or on the origin. Return true if the move was accepted. */
  onDrop(from: number, to: number | null): boolean;
  /** Tap (pointer down + up without dragging) on any square. */
  onTap(square: number): void;
}

const NS = 'http://www.w3.org/2000/svg';
const R = BOARD.pieceDiameter / 2;
const DRAG_THRESHOLD_PX = 8;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

interface DragState {
  square: number;
  startX: number;
  startY: number;
  dragging: boolean;
  el: SVGGElement | null;
}

export class BoardView {
  private svg: SVGSVGElement;
  private lastMove = el('g', { class: 'last-move' });
  private targets = el('g', { class: 'targets' });
  private pieces = el('g', { class: 'pieces' });
  private overlay = el('g', { class: 'overlay' });
  private pieceEls = new Map<number, SVGGElement>();
  private flipped = false;
  private locked = false;
  private drag: DragState | null = null;

  constructor(
    container: HTMLElement,
    private handlers: BoardViewHandlers,
  ) {
    this.svg = el('svg', {
      viewBox: `0 0 ${BOARD.width} ${BOARD.height}`,
      preserveAspectRatio: 'xMidYMid meet',
      class: 'board',
    });
    const img = el('image', { href: BOARD_IMAGE_URL, x: 0, y: 0, width: BOARD.width, height: BOARD.height });
    this.svg.append(img, this.lastMove, this.targets, this.pieces, this.overlay);
    container.append(this.svg);
    this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.svg.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.svg.addEventListener('pointercancel', () => this.cancelDrag());
  }

  setFlipped(flipped: boolean): void {
    this.flipped = flipped;
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) this.cancelDrag();
  }

  private place(g: SVGGElement, square: number): void {
    const { x, y } = squareCenter(square, this.flipped);
    g.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Full redraw without animation. */
  setPosition(board: Board): void {
    this.pieces.classList.add('no-anim');
    this.pieces.replaceChildren();
    this.pieceEls.clear();
    board.forEach((p, i) => {
      if (!p) return;
      const g = el('g', { class: `piece ${p.side}` });
      g.dataset.square = String(i);
      g.append(el('image', { href: pieceImageUrl(p), x: -R, y: -R, width: R * 2, height: R * 2 }));
      this.place(g, i);
      this.pieces.append(g);
      this.pieceEls.set(i, g);
    });
    // flush styles so the next transform change animates
    void this.pieces.getBoundingClientRect();
    this.pieces.classList.remove('no-anim');
  }

  /** Slide `from` to `to` (200 ms), fade a captured piece, then sync to `board`. */
  animateMove(from: number, to: number, board: Board): Promise<void> {
    const mover = this.pieceEls.get(from);
    const victim = this.pieceEls.get(to);
    if (!mover) {
      this.setPosition(board);
      return Promise.resolve();
    }
    this.pieces.append(mover); // draw on top of the others
    if (victim) victim.classList.add('captured');
    this.place(mover, to);
    return new Promise((resolve) =>
      setTimeout(() => {
        this.setPosition(board);
        resolve();
      }, 220),
    );
  }

  /** Ring the origin and destination of the most recent move. */
  showLastMove(from: number, to: number): void {
    this.lastMove.replaceChildren();
    for (const square of [from, to]) {
      const { x, y } = squareCenter(square, this.flipped);
      this.lastMove.append(el('circle', { cx: x, cy: y, r: R + 8, class: 'last-move-ring' }));
    }
  }

  clearLastMove(): void {
    this.lastMove.replaceChildren();
  }

  showTargets(squares: number[], board: Board): void {
    this.clearTargets();
    for (const s of squares) {
      const { x, y } = squareCenter(s, this.flipped);
      this.targets.append(
        board[s]
          ? el('circle', { cx: x, cy: y, r: R + 10, class: 'ring' })
          : el('circle', { cx: x, cy: y, r: 34, class: 'dot' }),
      );
    }
  }

  clearTargets(): void {
    this.targets.replaceChildren();
  }

  select(square: number | null): void {
    this.overlay.querySelectorAll('.selected:not(.hint)').forEach((n) => n.remove());
    if (square === null) return;
    const { x, y } = squareCenter(square, this.flipped);
    this.overlay.append(el('circle', { cx: x, cy: y, r: R + 8, class: 'selected' }));
  }

  flash(square: number): void {
    const g = this.pieceEls.get(square);
    if (!g) return;
    g.classList.add('flash');
    setTimeout(() => g.classList.remove('flash'), 1000);
  }

  showHint(from: number, to: number): void {
    const a = squareCenter(from, this.flipped);
    const b = squareCenter(to, this.flipped);
    const ring = el('circle', { cx: a.x, cy: a.y, r: R + 8, class: 'selected hint' });
    const dot = el('circle', { cx: b.x, cy: b.y, r: 30, class: 'dot hint' });
    this.overlay.append(ring, dot);
    setTimeout(() => {
      ring.remove();
      dot.remove();
    }, 2000);
  }

  // ---- pointer handling ----
  private toSvgPoint(e: PointerEvent): { x: number; y: number } {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: -1, y: -1 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.locked || this.drag) return;
    const { x, y } = this.toSvgPoint(e);
    const square = nearestSquare(x, y, this.flipped);
    if (square === null) return;
    const pieceEl = this.pieceEls.get(square);
    const canDrag = !!pieceEl && this.handlers.onPickUp(square);
    this.drag = { square, startX: e.clientX, startY: e.clientY, dragging: false, el: canDrag ? pieceEl! : null };
    try {
      this.svg.setPointerCapture(e.pointerId);
    } catch {
      // synthetic or already-released pointer: fall back to plain event bubbling
    }
    e.preventDefault();
  }

  private onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || !d.el) return;
    if (!d.dragging) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      d.dragging = true;
      d.el.classList.add('dragging');
      this.pieces.append(d.el);
    }
    const { x, y } = this.toSvgPoint(e);
    d.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  private onPointerUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.dragging && d.el) {
      d.el.classList.remove('dragging');
      const { x, y } = this.toSvgPoint(e);
      const to = nearestSquare(x, y, this.flipped);
      const accepted = this.handlers.onDrop(d.square, to === d.square ? null : to);
      if (!accepted) this.place(d.el, d.square); // bounce back via CSS transition
    } else {
      this.handlers.onTap(d.square);
    }
  }

  private cancelDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (d?.dragging && d.el) {
      d.el.classList.remove('dragging');
      this.place(d.el, d.square);
    }
  }
}
