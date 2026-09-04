import type { Level } from '../ai/search';
import type { Side } from '../engine/types';

export type Mode = 'pvp' | 'ai';

export interface ControlsState {
  turn: Side;
  thinking: boolean;
  mode: Mode;
  playerSide: Side;
  level: Level;
  canUndo: boolean;
  canHint: boolean;
  soundOn: boolean;
}

export interface ControlsHandlers {
  onMode(m: Mode): void;
  onPlayerSide(s: Side): void;
  onLevel(l: Level): void;
  onUndo(): void;
  onHint(): void;
  onRestart(): void;
  onToggleSound(): void;
}

const SIDE_NAME: Record<Side, string> = { red: '紅方', black: '黑方' };

function button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = `btn ${cls}`.trim();
  b.addEventListener('click', onClick);
  return b;
}

function segmented<T extends string | number>(
  options: Array<{ value: T; label: string }>,
  onPick: (v: T) => void,
): { root: HTMLDivElement; set(v: T): void } {
  const root = document.createElement('div');
  root.className = 'segmented';
  const buttons = options.map((o) => {
    const b = button(o.label, () => onPick(o.value), 'seg');
    b.dataset.value = String(o.value);
    root.append(b);
    return b;
  });
  return {
    root,
    set(v) {
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.value === String(v)));
    },
  };
}

export class Controls {
  private status = document.createElement('div');
  private mode = segmented<Mode>(
    [
      { value: 'pvp', label: '雙人' },
      { value: 'ai', label: '電腦' },
    ],
    (m) => this.h.onMode(m),
  );
  private side = segmented<Side>(
    [
      { value: 'red', label: '紅' },
      { value: 'black', label: '黑' },
    ],
    (s) => this.h.onPlayerSide(s),
  );
  private level = segmented<Level>(
    [
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
    ],
    (l) => this.h.onLevel(l),
  );
  private undo = button('悔棋', () => this.h.onUndo());
  private hint = button('提示', () => this.h.onHint());
  private restart = button('重新開始', () => this.h.onRestart());
  private sound = button('音效開', () => this.h.onToggleSound());
  private sideRow = this.row('顏色', this.side.root);
  private levelRow = this.row('難度', this.level.root);

  constructor(
    container: HTMLElement,
    private h: ControlsHandlers,
  ) {
    this.status.className = 'status';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.append(
      this.status,
      this.row('模式', this.mode.root),
      this.sideRow,
      this.levelRow,
      this.undo,
      this.hint,
      this.restart,
      this.sound,
    );
    container.append(panel);
  }

  private row(label: string, control: HTMLElement): HTMLDivElement {
    const r = document.createElement('div');
    r.className = 'row';
    const l = document.createElement('span');
    l.className = 'label';
    l.textContent = label;
    r.append(l, control);
    return r;
  }

  render(s: ControlsState): void {
    this.status.textContent = s.thinking ? '電腦思考中…' : `輪到${SIDE_NAME[s.turn]}`;
    this.status.className = `status ${s.thinking ? 'thinking' : s.turn}`;
    this.mode.set(s.mode);
    this.side.set(s.playerSide);
    this.level.set(s.level);
    this.sideRow.hidden = s.mode !== 'ai';
    this.levelRow.hidden = s.mode !== 'ai';
    this.hint.hidden = s.mode !== 'ai';
    this.undo.disabled = !s.canUndo;
    this.hint.disabled = !s.canHint;
    this.sound.textContent = s.soundOn ? '🔊 音效開' : '🔇 音效關';
  }
}
