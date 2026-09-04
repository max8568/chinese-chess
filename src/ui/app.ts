import { AiClient } from '../ai/client';
import type { Level } from '../ai/search';
import { Sounds } from '../audio/sounds';
import { Game } from '../engine/game';
import { findGeneral } from '../engine/rules';
import type { Board, Move, Side } from '../engine/types';
import { BoardView } from './boardView';
import { CapturedBar } from './capturedBar';
import { Controls, type Mode } from './controls';
import { Banner, confirmDialog } from './dialog';

const SIDE_NAME: Record<Side, string> = { red: '紅方', black: '黑方' };

export class App {
  private game = new Game();
  private ai = new AiClient();
  private sounds = new Sounds();
  private mode: Mode = 'pvp';
  private playerSide: Side = 'red';
  private level: Level = 1;
  private thinking = false;
  private over = false;
  private selected: number | null = null;
  /** Bumped on every state change so stale async results (AI, hint) are discarded. */
  private generation = 0;

  private view: BoardView;
  private controls: Controls;
  private topBar: CapturedBar;
  private bottomBar: CapturedBar;
  private banner: Banner;

  constructor(root: HTMLElement) {
    root.className = 'app';
    const boardCol = document.createElement('div');
    boardCol.className = 'board-col';
    const top = document.createElement('div');
    const boardWrap = document.createElement('div');
    boardWrap.className = 'board-wrap';
    const bottom = document.createElement('div');
    const panelCol = document.createElement('div');
    panelCol.className = 'panel-col';
    boardCol.append(top, boardWrap, bottom);
    root.append(boardCol, panelCol);

    this.topBar = new CapturedBar(top);
    this.bottomBar = new CapturedBar(bottom);
    this.view = new BoardView(boardWrap, {
      onPickUp: (sq) => this.onPickUp(sq),
      onDrop: (from, to) => this.onDrop(from, to),
      onTap: (sq) => this.onTap(sq),
    });
    this.banner = new Banner(boardWrap, {
      onAgain: () => void this.newGame(),
      onUndo: () => this.undo(),
    });
    this.controls = new Controls(panelCol, {
      onMode: (m) => void this.changeSetting(() => (this.mode = m), m !== this.mode),
      onPlayerSide: (s) => void this.changeSetting(() => (this.playerSide = s), s !== this.playerSide),
      onLevel: (l) => {
        this.level = l;
        this.render();
      },
      onUndo: () => this.undo(),
      onHint: () => void this.hint(),
      onRestart: () => void this.changeSetting(() => undefined, true),
    });
    document.addEventListener('pointerdown', () => this.sounds.unlock(), { once: true });
    if (import.meta.env.DEV) (window as unknown as { __app: App }).__app = this; // manual testing hook
    void this.newGame();
  }

  /** Dev/testing helper: replace the position and redraw. */
  loadPosition(board: Board, turn: Side): void {
    this.game.reset();
    this.game.board = board;
    this.game.turn = turn;
    this.generation++;
    this.over = false;
    this.banner.hide();
    this.clearSelection();
    this.view.clearLastMove();
    this.view.setPosition(this.game.board);
    this.render();
  }

  // ---- derived state ----
  private get flipped(): boolean {
    return this.mode === 'ai' && this.playerSide === 'black';
  }

  private humanCanMove(): boolean {
    return !this.thinking && !this.over && (this.mode === 'pvp' || this.game.turn === this.playerSide);
  }

  private undoSteps(): number {
    return this.mode === 'ai' ? 2 : 1;
  }

  private render(): void {
    this.controls.render({
      turn: this.game.turn,
      thinking: this.thinking,
      mode: this.mode,
      playerSide: this.playerSide,
      level: this.level,
      canUndo: !this.thinking && this.game.history.length >= this.undoSteps(),
      canHint: this.mode === 'ai' && this.humanCanMove(),
    });
    const bottomSide: Side = this.flipped ? 'black' : 'red';
    this.bottomBar.render(this.game.captured(bottomSide));
    this.topBar.render(this.game.captured(bottomSide === 'red' ? 'black' : 'red'));
  }

  private clearSelection(): void {
    this.selected = null;
    this.view.select(null);
    this.view.clearTargets();
  }

  /** Ring the move at the top of the history, or clear the rings if there is none. */
  private showLastMoveMarkers(): void {
    const last = this.game.history[this.game.history.length - 1];
    if (last) this.view.showLastMove(last.move.from, last.move.to);
    else this.view.clearLastMove();
  }

  // ---- board input ----
  private onPickUp(sq: number): boolean {
    if (!this.humanCanMove()) return false;
    const p = this.game.board[sq];
    if (!p || p.side !== this.game.turn) return false;
    this.selected = sq;
    this.view.select(sq);
    this.view.showTargets(
      this.game.legalMovesFrom(sq).map((m) => m.to),
      this.game.board,
    );
    return true;
  }

  private onDrop(from: number, to: number | null): boolean {
    if (to !== null && this.selected === from && this.game.isLegal({ from, to })) {
      void this.commit({ from, to }, false);
      return true;
    }
    return false; // piece bounces back; selection stays
  }

  private onTap(sq: number): void {
    if (this.selected !== null && this.selected !== sq && this.game.isLegal({ from: this.selected, to: sq })) {
      void this.commit({ from: this.selected, to: sq }, true);
      return;
    }
    const p = this.game.board[sq];
    if (p && p.side === this.game.turn && this.humanCanMove()) return; // onPickUp already selected it
    this.clearSelection();
  }

  // ---- game flow ----
  private async commit(move: Move, animate: boolean): Promise<void> {
    const entry = this.game.play(move);
    this.clearSelection();
    this.view.showLastMove(move.from, move.to);
    this.generation++;
    if (animate) await this.view.animateMove(move.from, move.to, this.game.board);
    else this.view.setPosition(this.game.board);
    this.sounds.play(entry.captured ? 'capture' : 'drop');
    this.afterMove();
  }

  private afterMove(): void {
    const status = this.game.status();
    if (status.kind !== 'playing') {
      this.over = true;
      const loser = SIDE_NAME[status.winner === 'red' ? 'black' : 'red'];
      this.banner.show(`${SIDE_NAME[status.winner]}獲勝！`, status.kind === 'stalemate' ? `${loser}沒有棋可走` : '');
      this.sounds.play('win');
    } else if (this.game.inCheck()) {
      this.view.flash(findGeneral(this.game.board, this.game.turn));
      this.sounds.play('check');
    }
    this.render();
    if (!this.over && this.mode === 'ai' && this.game.turn !== this.playerSide) void this.aiMove();
  }

  private async aiMove(): Promise<void> {
    const gen = this.generation;
    this.thinking = true;
    this.view.setLocked(true);
    this.render();
    const move = await this.ai.think(this.game.board, this.game.turn, this.level, this.game.recentKeys(4));
    this.thinking = false;
    this.view.setLocked(false);
    if (gen !== this.generation || this.over || !move) {
      this.render();
      return;
    }
    await this.commit(move, true);
  }

  private undo(): void {
    if (this.thinking) return;
    const steps = this.undoSteps();
    if (this.game.history.length < steps) return;
    for (let i = 0; i < steps; i++) this.game.undo();
    this.generation++;
    this.over = false;
    this.banner.hide();
    this.clearSelection();
    this.showLastMoveMarkers();
    this.view.setPosition(this.game.board);
    this.render();
  }

  private async hint(): Promise<void> {
    if (!(this.mode === 'ai' && this.humanCanMove())) return;
    const gen = this.generation;
    const move = await this.ai.think(this.game.board, this.game.turn, 3, [], 0);
    if (move && gen === this.generation) this.view.showHint(move.from, move.to);
  }

  private async changeSetting(apply: () => void, changed: boolean): Promise<void> {
    if (!changed) return;
    if (this.game.history.length > 0 && !(await confirmDialog('要重新開始嗎？'))) {
      this.render();
      return;
    }
    apply();
    await this.newGame();
  }

  private async newGame(): Promise<void> {
    this.game.reset();
    this.generation++;
    this.over = false;
    this.thinking = false;
    this.banner.hide();
    this.clearSelection();
    this.view.clearLastMove();
    this.view.setLocked(false);
    this.view.setFlipped(this.flipped);
    this.view.setPosition(this.game.board);
    this.render();
    if (this.mode === 'ai' && this.game.turn !== this.playerSide) await this.aiMove();
  }
}
