# Chinese Chess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web page (GitHub Pages) where a 7-year-old can play Chinese chess against another person or the computer, with drag/tap moves, legal-move hints, sounds, undo and hint.

**Architecture:** Pure-function rules engine (`src/engine`) and Alpha-Beta AI (`src/ai`, run in a Web Worker) with no DOM dependencies, fully unit-tested. A thin controller (`src/ui/app.ts`) wires them to an SVG board view, a settings panel, captured-piece strips, dialogs and Web Audio sounds. Piece placement uses a measured coordinate table for the raster board image.

**Tech Stack:** Vite 7, TypeScript 5, Vitest 3, no UI framework, Web Audio API, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-04-chinese-chess-design.md`

## Global Constraints

- Node 22 in CI; local Node 24 is fine.
- No localStorage / cookies / persistence of any kind (spec §2).
- UI copy is Traditional Chinese; page `<title>` is exactly `Chinese Chess` (spec §1).
- Vite `base` is `/chinese-chess/`; `publicDir` is `assets/web` (spec §8, §9).
- Board coordinates: `file` 0–8 left→right, `rank` 0–9 top→bottom, rank 0 = black back rank, index = `rank * 9 + file` (spec §2.2).
- Piece type names: `general advisor elephant knight rook cannon soldier` (spec §2.2).
- Buttons ≥ 48px tall (spec §5.1). No `window.confirm`/`alert` (spec §5.2).
- Commit author is the repo-local `max8568 <max8568@users.noreply.github.com>`; never change global git config.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `index.html`, `vite.config.ts`, `tsconfig.json`, `.gitattributes` | Build scaffold |
| `src/main.ts` | Entry: creates `App` |
| `src/style.css` | Layout (landscape/portrait), panel, dialogs |
| `src/engine/types.ts` | `Side`, `PieceType`, `Piece`, `Board`, `Move`, index helpers |
| `src/engine/board.ts` | `initialBoard`, `applyMove`, `boardKey`, `parseBoard` (test helper) |
| `src/engine/moves.ts` | Pseudo-legal move generation per piece |
| `src/engine/rules.ts` | Check detection, generals facing, `legalMoves`, `gameStatus` |
| `src/engine/game.ts` | `Game` class: turn, history, play, undo, captured |
| `src/ai/evaluate.ts` | Static evaluation |
| `src/ai/search.ts` | `chooseMove`: levels 1–3, Alpha-Beta, quiescence, repetition avoidance |
| `src/ai/worker.ts` | Web Worker entry |
| `src/ai/client.ts` | `AiClient`: Promise API + 0.6 s minimum delay |
| `src/assets/boardGeometry.ts` | Board image size + intersection pixel coordinates |
| `src/assets/pieceImages.ts` | Piece image URLs |
| `src/ui/boardView.ts` | SVG board: pieces, markers, selection, flash, hint, animation, flip, pointer events |
| `src/ui/controls.ts` | Settings panel DOM |
| `src/ui/capturedBar.ts` | Captured-piece strip (grouped counts) |
| `src/ui/dialog.ts` | Confirm dialog + game-over banner |
| `src/ui/app.ts` | Controller |
| `src/audio/sounds.ts` | Synthesized sounds, optional file override, mute |
| `.github/workflows/deploy.yml` | Build + deploy to Pages |
| Tests live beside code as `*.test.ts` | Vitest picks them up |

---

### Task 1: Project scaffold

**Files:**
- Create: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/style.css`, `.gitattributes`
- Modify: `package.json` (already has scripts; add nothing)

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` all work; `import.meta.env.BASE_URL` is `/chinese-chess/`.

- [ ] **Step 1: Write config files**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/chinese-chess/',
  publicDir: 'assets/web',
  build: { target: 'es2020' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable", "WebWorker"],
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`.gitattributes`:
```
* text=auto eol=lf
*.png binary
*.webp binary
*.jpeg binary
```

`index.html`:
```html
<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="icon" type="image/png" href="./pieces/red/general.png" />
    <title>Chinese Chess</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts` (temporary stub, replaced in Task 11):
```ts
import './style.css';
document.getElementById('app')!.textContent = 'Chinese Chess';
```

`src/style.css` (temporary stub, replaced in Task 11):
```css
body { margin: 0; font-family: system-ui, sans-serif; }
```

Because `vite.config.ts` uses the `test` key, add the vitest type reference at the top of the file: `/// <reference types="vitest/config" />`.

- [ ] **Step 2: Verify build and test runner**

Run: `npm run build` → Expected: `dist/index.html` produced, no TS errors.
Run: `npm test` → Expected: "No test files found" exit code 0 (add `passWithNoTests: true` to `test` config if it exits 1).

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts tsconfig.json index.html src/main.ts src/style.css .gitattributes package.json package-lock.json
git commit -m "chore: vite + typescript + vitest scaffold"
```

---

### Task 2: Engine types, board setup, test helper

**Files:**
- Create: `src/engine/types.ts`, `src/engine/board.ts`, `src/engine/board.test.ts`

**Interfaces:**
- Produces:
  - `type Side = 'red' | 'black'`; `type PieceType = 'general'|'advisor'|'elephant'|'knight'|'rook'|'cannon'|'soldier'`
  - `interface Piece { side: Side; type: PieceType }`; `type Cell = Piece | null`; `type Board = Cell[]` (length 90)
  - `interface Move { from: number; to: number }`
  - `idx(file, rank)`, `fileOf(i)`, `rankOf(i)`, `opposite(side)`, `inBoard(file, rank)`
  - `initialBoard(): Board`, `applyMove(board, move): { board: Board; captured: Cell }`, `boardKey(board, side): string`
  - `parseBoard(rows: string[]): Board` — 10 rows × 9 chars; uppercase = red, lowercase = black; `K A E N R C P` = general advisor elephant knight rook cannon soldier; `.` = empty
  - `LETTER: Record<PieceType, string>` (uppercase letters above)

- [ ] **Step 1: Write the failing test**

`src/engine/board.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyMove, boardKey, initialBoard, parseBoard } from './board';
import { idx } from './types';

describe('initialBoard', () => {
  it('places 32 pieces in the standard opening', () => {
    const b = initialBoard();
    expect(b.filter(Boolean)).toHaveLength(32);
    expect(b[idx(4, 0)]).toEqual({ side: 'black', type: 'general' });
    expect(b[idx(4, 9)]).toEqual({ side: 'red', type: 'general' });
    expect(b[idx(1, 2)]).toEqual({ side: 'black', type: 'cannon' });
    expect(b[idx(0, 6)]).toEqual({ side: 'red', type: 'soldier' });
    expect(b[idx(8, 9)]).toEqual({ side: 'red', type: 'rook' });
  });
});

describe('parseBoard', () => {
  it('round-trips the initial position', () => {
    const rows = [
      'rneakaenr',
      '.........',
      '.c.....c.',
      'p.p.p.p.p',
      '.........',
      '.........',
      'P.P.P.P.P',
      '.C.....C.',
      '.........',
      'RNEAKAENR',
    ];
    expect(parseBoard(rows)).toEqual(initialBoard());
  });
});

describe('applyMove', () => {
  it('moves a piece and reports the capture without mutating the input', () => {
    const b = initialBoard();
    const from = idx(1, 7); // red cannon
    const to = idx(1, 0); // black knight
    const r = applyMove(b, { from, to });
    expect(r.captured).toEqual({ side: 'black', type: 'knight' });
    expect(r.board[to]).toEqual({ side: 'red', type: 'cannon' });
    expect(r.board[from]).toBeNull();
    expect(b[from]).toEqual({ side: 'red', type: 'cannon' });
  });
});

describe('boardKey', () => {
  it('differs by side to move and by position', () => {
    const b = initialBoard();
    expect(boardKey(b, 'red')).not.toEqual(boardKey(b, 'black'));
    const moved = applyMove(b, { from: idx(0, 6), to: idx(0, 5) }).board;
    expect(boardKey(moved, 'black')).not.toEqual(boardKey(b, 'black'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/board.test.ts`
Expected: FAIL — cannot resolve `./board` / `./types`.

- [ ] **Step 3: Write the implementation**

`src/engine/types.ts`:
```ts
export type Side = 'red' | 'black';
export type PieceType =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'knight'
  | 'rook'
  | 'cannon'
  | 'soldier';

export interface Piece {
  side: Side;
  type: PieceType;
}
export type Cell = Piece | null;
/** 90 cells, index = rank * 9 + file. rank 0 is black's back rank (top). */
export type Board = Cell[];

export interface Move {
  from: number;
  to: number;
}

export const FILES = 9;
export const RANKS = 10;

export function idx(file: number, rank: number): number {
  return rank * FILES + file;
}
export function fileOf(i: number): number {
  return i % FILES;
}
export function rankOf(i: number): number {
  return Math.floor(i / FILES);
}
export function inBoard(file: number, rank: number): boolean {
  return file >= 0 && file < FILES && rank >= 0 && rank < RANKS;
}
export function opposite(side: Side): Side {
  return side === 'red' ? 'black' : 'red';
}
```

`src/engine/board.ts`:
```ts
import type { Board, Cell, Move, PieceType, Side } from './types';
import { FILES, RANKS } from './types';

export const LETTER: Record<PieceType, string> = {
  general: 'K',
  advisor: 'A',
  elephant: 'E',
  knight: 'N',
  rook: 'R',
  cannon: 'C',
  soldier: 'P',
};
const TYPE_BY_LETTER: Record<string, PieceType> = Object.fromEntries(
  Object.entries(LETTER).map(([t, l]) => [l, t as PieceType]),
);

/** Parse 10 rows of 9 chars. Uppercase = red, lowercase = black, '.' = empty. */
export function parseBoard(rows: string[]): Board {
  if (rows.length !== RANKS) throw new Error(`expected ${RANKS} rows`);
  const board: Board = [];
  for (const row of rows) {
    if (row.length !== FILES) throw new Error(`row "${row}" must have ${FILES} chars`);
    for (const ch of row) {
      if (ch === '.') {
        board.push(null);
        continue;
      }
      const type = TYPE_BY_LETTER[ch.toUpperCase()];
      if (!type) throw new Error(`unknown piece letter "${ch}"`);
      board.push({ side: ch === ch.toUpperCase() ? 'red' : 'black', type });
    }
  }
  return board;
}

export function initialBoard(): Board {
  return parseBoard([
    'rneakaenr',
    '.........',
    '.c.....c.',
    'p.p.p.p.p',
    '.........',
    '.........',
    'P.P.P.P.P',
    '.C.....C.',
    '.........',
    'RNEAKAENR',
  ]);
}

export function applyMove(board: Board, move: Move): { board: Board; captured: Cell } {
  const next = board.slice();
  const captured = next[move.to];
  next[move.to] = next[move.from];
  next[move.from] = null;
  return { board: next, captured };
}

/** Compact string identifying position + side to move (for repetition checks). */
export function boardKey(board: Board, side: Side): string {
  let s = side === 'red' ? 'r' : 'b';
  for (const c of board) {
    if (!c) s += '.';
    else s += c.side === 'red' ? LETTER[c.type] : LETTER[c.type].toLowerCase();
  }
  return s;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/board.test.ts` → Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/board.ts src/engine/board.test.ts
git commit -m "feat(engine): board types, initial position, applyMove, parseBoard helper"
```

---

### Task 3: Pseudo-legal move generation

**Files:**
- Create: `src/engine/moves.ts`, `src/engine/moves.test.ts`

**Interfaces:**
- Consumes: `Board`, `Move`, `idx`, `fileOf`, `rankOf`, `inBoard`, `parseBoard`
- Produces:
  - `pseudoMovesFrom(board: Board, from: number): Move[]` — moves for the piece at `from` ignoring check
  - `pseudoMoves(board: Board, side: Side): Move[]` — all pieces of `side`
  - `inPalace(file, rank, side)`, `crossedRiver(rank, side)`, `forward(side)` (`-1` for red, `+1` for black)

Rules (spec §3): general 1 step orthogonal inside palace; advisor 1 diagonal inside palace; elephant 2 diagonal, eye empty, own half only; knight L with leg empty; rook slides; cannon slides to empty squares and captures by jumping exactly one screen; soldier forward 1, plus sideways once across the river.

Palace: files 3–5, ranks 0–2 (black) / 7–9 (red). Red half: ranks 5–9. Black half: ranks 0–4.

- [ ] **Step 1: Write the failing tests**

`src/engine/moves.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseBoard } from './board';
import { pseudoMovesFrom } from './moves';
import { idx } from './types';

const EMPTY = ['.........', '.........', '.........', '.........', '.........',
  '.........', '.........', '.........', '.........', '.........'];

function withPieces(placements: Array<[string, number, number]>): string[] {
  const rows = EMPTY.map((r) => r.split(''));
  for (const [ch, f, r] of placements) rows[r][f] = ch;
  return rows.map((r) => r.join(''));
}

function targets(rows: string[], f: number, r: number): number[] {
  return pseudoMovesFrom(parseBoard(rows), idx(f, r)).map((m) => m.to).sort((a, b) => a - b);
}
const T = (...pts: Array<[number, number]>) => pts.map(([f, r]) => idx(f, r)).sort((a, b) => a - b);

describe('general', () => {
  it('moves one step orthogonally inside the palace', () => {
    expect(targets(withPieces([['K', 4, 8]]), 4, 8)).toEqual(T([3, 8], [5, 8], [4, 7], [4, 9]));
    expect(targets(withPieces([['K', 3, 9]]), 3, 9)).toEqual(T([4, 9], [3, 8]));
  });
});

describe('advisor', () => {
  it('moves diagonally inside the palace only', () => {
    expect(targets(withPieces([['A', 4, 8]]), 4, 8)).toEqual(T([3, 7], [5, 7], [3, 9], [5, 9]));
    expect(targets(withPieces([['A', 3, 9]]), 3, 9)).toEqual(T([4, 8]));
  });
});

describe('elephant', () => {
  it('moves two diagonally when the eye is empty and stays on its own half', () => {
    expect(targets(withPieces([['E', 4, 7]]), 4, 7)).toEqual(T([2, 5], [6, 5], [2, 9], [6, 9]));
    expect(targets(withPieces([['E', 4, 7], ['P', 3, 6]]), 4, 7)).toEqual(T([6, 5], [2, 9], [6, 9]));
    expect(targets(withPieces([['E', 2, 5]]), 2, 5)).toEqual(T([0, 7], [4, 7]));
    expect(targets(withPieces([['e', 2, 4]]), 2, 4)).toEqual(T([0, 2], [4, 2]));
  });
});

describe('knight', () => {
  it('moves in an L unless the leg is blocked', () => {
    expect(targets(withPieces([['N', 4, 5]]), 4, 5)).toEqual(
      T([3, 3], [5, 3], [2, 4], [6, 4], [2, 6], [6, 6], [3, 7], [5, 7]),
    );
    // block the upward leg (4,4): removes (3,3) and (5,3)
    expect(targets(withPieces([['N', 4, 5], ['p', 4, 4]]), 4, 5)).toEqual(
      T([2, 4], [6, 4], [2, 6], [6, 6], [3, 7], [5, 7]),
    );
  });
});

describe('rook', () => {
  it('slides until blocked and captures the first enemy piece', () => {
    expect(targets(withPieces([['R', 0, 9], ['P', 0, 6], ['n', 3, 9]]), 0, 9)).toEqual(
      T([0, 8], [0, 7], [1, 9], [2, 9], [3, 9]),
    );
  });
});

describe('cannon', () => {
  it('slides to empty squares and captures only by jumping one screen', () => {
    // C at (1,7); P at (1,4) is a screen; n at (1,1) is capturable; second black piece behind is not
    const rows = withPieces([['C', 1, 7], ['P', 1, 4], ['n', 1, 1], ['r', 1, 0], ['N', 3, 7]]);
    expect(targets(rows, 1, 7)).toEqual(T([1, 6], [1, 5], [1, 1], [0, 7], [2, 7], [1, 8], [1, 9]));
  });
  it('cannot capture an adjacent piece without a screen', () => {
    expect(targets(withPieces([['C', 4, 5], ['n', 4, 4]]), 4, 5)).toEqual(
      T([0, 5], [1, 5], [2, 5], [3, 5], [5, 5], [6, 5], [7, 5], [8, 5], [4, 6], [4, 7], [4, 8], [4, 9]),
    );
  });
});

describe('soldier', () => {
  it('moves forward only before the river and sideways too after crossing', () => {
    expect(targets(withPieces([['P', 2, 6]]), 2, 6)).toEqual(T([2, 5]));
    expect(targets(withPieces([['P', 2, 4]]), 2, 4)).toEqual(T([2, 3], [1, 4], [3, 4]));
    expect(targets(withPieces([['p', 2, 3]]), 2, 3)).toEqual(T([2, 4]));
    expect(targets(withPieces([['p', 2, 5]]), 2, 5)).toEqual(T([2, 6], [1, 5], [3, 5]));
    expect(targets(withPieces([['P', 2, 0]]), 2, 0)).toEqual(T([1, 0], [3, 0]));
  });
  it('never captures its own piece', () => {
    expect(targets(withPieces([['P', 2, 6], ['N', 2, 5]]), 2, 6)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/moves.test.ts` → Expected: FAIL, cannot resolve `./moves`.

- [ ] **Step 3: Write the implementation**

`src/engine/moves.ts`:
```ts
import type { Board, Move, Side } from './types';
import { fileOf, idx, inBoard, rankOf } from './types';

export function forward(side: Side): number {
  return side === 'red' ? -1 : 1;
}
export function inPalace(file: number, rank: number, side: Side): boolean {
  if (file < 3 || file > 5) return false;
  return side === 'red' ? rank >= 7 : rank <= 2;
}
export function ownHalf(rank: number, side: Side): boolean {
  return side === 'red' ? rank >= 5 : rank <= 4;
}
export function crossedRiver(rank: number, side: Side): boolean {
  return !ownHalf(rank, side);
}

const ORTHO = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const DIAG = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const KNIGHT = [
  [1, 2],
  [-1, 2],
  [1, -2],
  [-1, -2],
  [2, 1],
  [2, -1],
  [-2, 1],
  [-2, -1],
] as const;

export function pseudoMovesFrom(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];
  const f = fileOf(from);
  const r = rankOf(from);
  const side = piece.side;
  const out: Move[] = [];
  const push = (tf: number, tr: number) => {
    if (!inBoard(tf, tr)) return false;
    const target = board[idx(tf, tr)];
    if (target && target.side === side) return false;
    out.push({ from, to: idx(tf, tr) });
    return true;
  };

  switch (piece.type) {
    case 'general':
      for (const [df, dr] of ORTHO) {
        if (inPalace(f + df, r + dr, side)) push(f + df, r + dr);
      }
      break;
    case 'advisor':
      for (const [df, dr] of DIAG) {
        if (inPalace(f + df, r + dr, side)) push(f + df, r + dr);
      }
      break;
    case 'elephant':
      for (const [df, dr] of DIAG) {
        const tf = f + 2 * df;
        const tr = r + 2 * dr;
        if (!inBoard(tf, tr) || !ownHalf(tr, side)) continue;
        if (board[idx(f + df, r + dr)]) continue; // eye blocked
        push(tf, tr);
      }
      break;
    case 'knight':
      for (const [df, dr] of KNIGHT) {
        const legF = f + (Math.abs(df) === 2 ? Math.sign(df) : 0);
        const legR = r + (Math.abs(dr) === 2 ? Math.sign(dr) : 0);
        if (!inBoard(legF, legR) || board[idx(legF, legR)]) continue;
        push(f + df, r + dr);
      }
      break;
    case 'rook':
      for (const [df, dr] of ORTHO) {
        let tf = f + df;
        let tr = r + dr;
        while (inBoard(tf, tr)) {
          const target = board[idx(tf, tr)];
          if (target) {
            if (target.side !== side) out.push({ from, to: idx(tf, tr) });
            break;
          }
          out.push({ from, to: idx(tf, tr) });
          tf += df;
          tr += dr;
        }
      }
      break;
    case 'cannon':
      for (const [df, dr] of ORTHO) {
        let tf = f + df;
        let tr = r + dr;
        let screened = false;
        while (inBoard(tf, tr)) {
          const target = board[idx(tf, tr)];
          if (!screened) {
            if (target) screened = true;
            else out.push({ from, to: idx(tf, tr) });
          } else if (target) {
            if (target.side !== side) out.push({ from, to: idx(tf, tr) });
            break;
          }
          tf += df;
          tr += dr;
        }
      }
      break;
    case 'soldier': {
      push(f, r + forward(side));
      if (crossedRiver(r, side)) {
        push(f - 1, r);
        push(f + 1, r);
      }
      break;
    }
  }
  return out;
}

export function pseudoMoves(board: Board, side: Side): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && p.side === side) out.push(...pseudoMovesFrom(board, i));
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/moves.test.ts` → Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/moves.ts src/engine/moves.test.ts
git commit -m "feat(engine): pseudo-legal move generation for all seven piece types"
```

---

### Task 4: Check, legality, game status

**Files:**
- Create: `src/engine/rules.ts`, `src/engine/rules.test.ts`

**Interfaces:**
- Consumes: `pseudoMoves`, `pseudoMovesFrom`, `applyMove`, `crossedRiver`, `forward`
- Produces:
  - `findGeneral(board, side): number` (−1 if absent)
  - `generalsFacing(board): boolean`
  - `inCheck(board, side): boolean` — `side`'s general is attacked by rook/cannon/knight/soldier or the generals face each other
  - `legalMoves(board, side): Move[]`, `legalMovesFrom(board, from): Move[]`
  - `type Status = { kind: 'playing' } | { kind: 'checkmate' | 'stalemate'; winner: Side }`
  - `gameStatus(board, sideToMove): Status`
  - `givesCheck(board, move): boolean` — after `move`, is the *opponent* of the mover in check

- [ ] **Step 1: Write the failing tests**

`src/engine/rules.test.ts`:
```ts
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
      '.........', '.........', '.........', '.........', '....K....']), 'black')).toBe(true);
    expect(inCheck(B([
      '....k....', '...p.....', '...N.....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']), 'black')).toBe(false);
    // red soldier directly below the black general (moves upward)
    expect(inCheck(B([
      '....k....', '....P....', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']), 'black')).toBe(true);
    // soldier beside general attacks only after crossing river (rank 1 is across for red)
    expect(inCheck(B([
      '...Pk....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']), 'black')).toBe(true);
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
    // advisor cannot move away (no diagonal keeps the file); general can step sideways
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
    // black general boxed by two red rooks
    const b = B(['...k.....', '.........', '..R.R....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']);
    // rook at (2,2) does not attack (3,0); add rook on file 3
    const mate = B(['...k.....', '.........', '...R.....', '.........', '.........',
      '.........', '.........', '.........', '.........', '....K....']);
    expect(gameStatus(b, 'black').kind).toBe('playing');
    // general at (3,0) can go to (4,0) or (3,1); (3,1) attacked by rook, (4,0) faces red general at (4,9)
    expect(gameStatus(mate, 'black')).toEqual({ kind: 'checkmate', winner: 'red' });
  });

  it('reports stalemate as a loss for the side to move', () => {
    const b = B(['...k.....', '....R....', '.........', '.........', '.........',
      '.........', '.........', '.........', '.........', '...K.....']);
    // black general at (3,0): (4,0) attacked by rook (4,1); (3,1) attacked by rook along rank 1
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rules.test.ts` → Expected: FAIL, cannot resolve `./rules`.

- [ ] **Step 3: Write the implementation**

`src/engine/rules.ts`:
```ts
import { applyMove } from './board';
import { crossedRiver, forward, pseudoMoves, pseudoMovesFrom } from './moves';
import type { Board, Move, Side } from './types';
import { fileOf, idx, inBoard, opposite, rankOf } from './types';

export type Status = { kind: 'playing' } | { kind: 'checkmate' | 'stalemate'; winner: Side };

export function findGeneral(board: Board, side: Side): number {
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (p && p.side === side && p.type === 'general') return i;
  }
  return -1;
}

export function generalsFacing(board: Board): boolean {
  const r = findGeneral(board, 'red');
  const b = findGeneral(board, 'black');
  if (r < 0 || b < 0 || fileOf(r) !== fileOf(b)) return false;
  const f = fileOf(r);
  for (let rank = rankOf(b) + 1; rank < rankOf(r); rank++) {
    if (board[idx(f, rank)]) return false;
  }
  return true;
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const KNIGHT = [[1, 2], [-1, 2], [1, -2], [-1, -2], [2, 1], [2, -1], [-2, 1], [-2, -1]] as const;

/** Is `side`'s general attacked (or facing the enemy general)? */
export function inCheck(board: Board, side: Side): boolean {
  const g = findGeneral(board, side);
  if (g < 0) return true; // no general = lost
  const enemy = opposite(side);
  const f = fileOf(g);
  const r = rankOf(g);

  // rook / cannon along four rays
  for (const [df, dr] of ORTHO) {
    let tf = f + df;
    let tr = r + dr;
    let seen = 0;
    while (inBoard(tf, tr)) {
      const p = board[idx(tf, tr)];
      if (p) {
        seen++;
        if (p.side === enemy) {
          if (seen === 1 && p.type === 'rook') return true;
          if (seen === 2 && p.type === 'cannon') return true;
        }
        if (seen === 2) break;
      }
      tf += df;
      tr += dr;
    }
  }
  // knight: enemy knight at (f+df, r+dr) attacks g if its leg square is empty
  for (const [df, dr] of KNIGHT) {
    const nf = f + df;
    const nr = r + dr;
    if (!inBoard(nf, nr)) continue;
    const p = board[idx(nf, nr)];
    if (!p || p.side !== enemy || p.type !== 'knight') continue;
    const legF = nf - (Math.abs(df) === 2 ? Math.sign(df) : 0);
    const legR = nr - (Math.abs(dr) === 2 ? Math.sign(dr) : 0);
    if (!board[idx(legF, legR)]) return true;
  }
  // soldier: enemy soldier one step "behind" (relative to its forward) or beside after crossing
  const behindR = r - forward(enemy);
  if (inBoard(f, behindR)) {
    const p = board[idx(f, behindR)];
    if (p && p.side === enemy && p.type === 'soldier') return true;
  }
  for (const sf of [f - 1, f + 1]) {
    if (!inBoard(sf, r)) continue;
    const p = board[idx(sf, r)];
    if (p && p.side === enemy && p.type === 'soldier' && crossedRiver(r, enemy)) return true;
  }
  return generalsFacing(board);
}

export function legalMovesFrom(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];
  return pseudoMovesFrom(board, from).filter((m) => !inCheck(applyMove(board, m).board, piece.side));
}

export function legalMoves(board: Board, side: Side): Move[] {
  return pseudoMoves(board, side).filter((m) => !inCheck(applyMove(board, m).board, side));
}

export function gameStatus(board: Board, sideToMove: Side): Status {
  if (legalMoves(board, sideToMove).length > 0) return { kind: 'playing' };
  return {
    kind: inCheck(board, sideToMove) ? 'checkmate' : 'stalemate',
    winner: opposite(sideToMove),
  };
}

export function givesCheck(board: Board, move: Move): boolean {
  const mover = board[move.from];
  if (!mover) return false;
  return inCheck(applyMove(board, move).board, opposite(mover.side));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/rules.test.ts` → Expected: all PASS. If the "44 legal moves" count fails, count by hand from the opening: rooks 2×2, knights 2×2, cannons 2×6, advisors 2×1, elephants 2×2, general 1... adjust only if the engine is provably wrong, not the test's expectation of standard xiangqi (the standard opening has 44 legal moves for red).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.ts src/engine/rules.test.ts
git commit -m "feat(engine): check detection, legal move filtering, checkmate and stalemate"
```

---

### Task 5: Game state with history and undo

**Files:**
- Create: `src/engine/game.ts`, `src/engine/game.test.ts`

**Interfaces:**
- Consumes: `initialBoard`, `applyMove`, `boardKey`, `legalMovesFrom`, `gameStatus`, `inCheck`
- Produces:
  - `interface HistoryEntry { move: Move; piece: Piece; captured: Cell }`
  - `class Game { board: Board; turn: Side; history: HistoryEntry[]; reset(); legalMovesFrom(from); isLegal(move); play(move): HistoryEntry; undo(): HistoryEntry | undefined; status(): Status; inCheck(): boolean; captured(by: Side): Piece[]; recentKeys(n: number): string[] }`

- [ ] **Step 1: Write the failing tests**

`src/engine/game.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/game.test.ts` → Expected: FAIL, cannot resolve `./game`.

- [ ] **Step 3: Write the implementation**

`src/engine/game.ts`:
```ts
import { applyMove, boardKey, initialBoard } from './board';
import { gameStatus, inCheck, legalMovesFrom, type Status } from './rules';
import type { Board, Cell, Move, Piece, Side } from './types';
import { opposite } from './types';

export interface HistoryEntry {
  move: Move;
  piece: Piece;
  captured: Cell;
}

export class Game {
  board: Board = initialBoard();
  turn: Side = 'red';
  history: HistoryEntry[] = [];
  private keys: string[] = [boardKey(this.board, this.turn)];

  reset(): void {
    this.board = initialBoard();
    this.turn = 'red';
    this.history = [];
    this.keys = [boardKey(this.board, this.turn)];
  }

  legalMovesFrom(from: number): Move[] {
    const p = this.board[from];
    if (!p || p.side !== this.turn) return [];
    return legalMovesFrom(this.board, from);
  }

  isLegal(move: Move): boolean {
    return this.legalMovesFrom(move.from).some((m) => m.to === move.to);
  }

  play(move: Move): HistoryEntry {
    if (!this.isLegal(move)) throw new Error(`illegal move ${move.from}->${move.to}`);
    const piece = this.board[move.from] as Piece;
    const { board, captured } = applyMove(this.board, move);
    const entry: HistoryEntry = { move, piece, captured };
    this.board = board;
    this.turn = opposite(this.turn);
    this.history.push(entry);
    this.keys.push(boardKey(this.board, this.turn));
    return entry;
  }

  undo(): HistoryEntry | undefined {
    const entry = this.history.pop();
    if (!entry) return undefined;
    const board = this.board.slice();
    board[entry.move.from] = entry.piece;
    board[entry.move.to] = entry.captured;
    this.board = board;
    this.turn = opposite(this.turn);
    this.keys.pop();
    return entry;
  }

  status(): Status {
    return gameStatus(this.board, this.turn);
  }

  inCheck(): boolean {
    return inCheck(this.board, this.turn);
  }

  /** Pieces captured by `by` (i.e. pieces of the opposite side), oldest first. */
  captured(by: Side): Piece[] {
    return this.history
      .filter((h) => h.piece.side === by && h.captured)
      .map((h) => h.captured as Piece);
  }

  recentKeys(n: number): string[] {
    return this.keys.slice(-n);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/engine/game.test.ts` → Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/game.ts src/engine/game.test.ts
git commit -m "feat(engine): Game class with turn, history, undo and captured pieces"
```

---

### Task 6: AI — evaluation, search, levels, worker client

**Files:**
- Create: `src/ai/evaluate.ts`, `src/ai/search.ts`, `src/ai/search.test.ts`, `src/ai/worker.ts`, `src/ai/client.ts`

**Interfaces:**
- Consumes: `legalMoves`, `inCheck`, `applyMove`, `boardKey`, `crossedRiver`
- Produces:
  - `evaluate(board: Board, side: Side): number` — positive is good for `side`
  - `type Level = 1 | 2 | 3`
  - `chooseMove(board, side, level, recentKeys: string[], rng?: () => number, timeLimitMs?: number): Move | null`
  - Worker protocol: request `{ id: number; board: Board; side: Side; level: Level; recentKeys: string[] }`, response `{ id: number; move: Move | null }`
  - `class AiClient { think(board, side, level, recentKeys, minDelayMs = 600): Promise<Move | null>; dispose() }`

Search design (spec §4):
- Level 1: legal moves; if any capture exists pick a random capture, else a random move.
- Level 2: fixed depth 2 negamax with alpha-beta, no quiescence.
- Level 3: iterative deepening to depth 4 with quiescence (captures only, max 4 extra plies), time cap 1500 ms.
- No legal moves: checkmate and stalemate both score `-MATE + ply` for the side to move.
- Root: score every legal move, then among moves within 10 points of the best, exclude those repeating a key in `recentKeys` unless that would drop more than 50 points below best; pick randomly among the remaining candidates.

- [ ] **Step 1: Write the failing tests**

`src/ai/search.test.ts`:
```ts
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
    expect(evaluate(b, 'red')).toBe(-evaluate(b, 'black'));
    const noBlackRook = parseBoard(['.neakaenr', '.........', '.c.....c.', 'p.p.p.p.p', '.........',
      '.........', 'P.P.P.P.P', '.C.....C.', '.........', 'RNEAKAENR']);
    expect(evaluate(noBlackRook, 'red')).toBeGreaterThan(800);
  });
});

describe('chooseMove level 1', () => {
  it('always captures when a capture exists', () => {
    // red cannon can capture black knight; every other move is quiet
    const b = parseBoard(['....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', '.n.......', 'RC.......', '....K....']);
    // cannon at (1,8) with screen? knight at (1,7) is adjacent: cannon cannot capture; rook at (0,8) captures knight via... no.
    // Use rook capture instead: rook (0,8) -> knight? not aligned. Build a clean case:
    const c = parseBoard(['....k....', '.........', '.........', '.........', '.........',
      '.........', '.........', 'n........', 'R........', '....K....']);
    for (let i = 0; i < 20; i++) {
      const m = chooseMove(c, 'red', 1, [], seeded(i));
      expect(m).toEqual({ from: idx(0, 8), to: idx(0, 7) });
    }
    expect(b).toBeTruthy();
  });

  it('returns a legal move from the opening and null with no moves', () => {
    const b = initialBoard();
    const legal = legalMoves(b, 'red');
    const m = chooseMove(b, 'red', 1, [], seeded(7));
    expect(legal.some((l) => l.from === m!.from && l.to === m!.to)).toBe(true);
  });
});

describe('chooseMove level 2', () => {
  it('does not hang a rook to a one-move capture', () => {
    // red rook at (0,5) attacked by black rook at (0,0); red should move or defend, not stay.
    const b = parseBoard(['r...k....', '.........', '.........', '.........', '.........',
      'R........', '.........', '.........', '.........', '....K....']);
    const m = chooseMove(b, 'red', 2, [], seeded(1))!;
    const after = applyMove(b, m).board;
    // black must not be able to capture the red rook for free
    const blackCaptures = legalMoves(after, 'black').filter((bm) => after[bm.to]?.type === 'rook');
    expect(blackCaptures).toHaveLength(0);
  });
});

describe('chooseMove level 3', () => {
  it('finds mate in one', () => {
    // red rook (3,5) to (3,0) mates: black general at (4,0)? Build: black k at (3,0), red R at (0,2), red R at (5,5), red K at (4,9)
    const b = parseBoard(['...k.....', '.........', 'R........', '.........', '.........',
      '.....R...', '.........', '.........', '.........', '....K....']);
    // R(0,2)->(3,2)? general escapes to (4,0)... instead use R(5,5)->(3,5) giving check on file 3 while R(0,2) covers rank 2? Simplest: verify chooseMove result leads to checkmate.
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
});
```

Note on the mate-in-one test: with black general at (3,0), red rooks at (0,2) and (5,5), red general at (4,9): the move R(5,5)→(3,5) checks along file 3; escapes (4,0) is covered by the red general on file 4 (facing) and (3,1) is on file 3 (still attacked); (2,0) is outside the palace; rank 2 escape does not exist because the general moves one step. So `legalMoves(after,'black')` is empty. If the assertion fails, print `m` and check the position by hand before touching the engine.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ai/search.test.ts` → Expected: FAIL, cannot resolve modules.

- [ ] **Step 3: Write the implementation**

`src/ai/evaluate.ts`:
```ts
import { crossedRiver } from '../engine/moves';
import type { Board, PieceType, Side } from '../engine/types';
import { fileOf, rankOf } from '../engine/types';

export const VALUE: Record<PieceType, number> = {
  general: 10000,
  rook: 900,
  cannon: 450,
  knight: 400,
  elephant: 200,
  advisor: 200,
  soldier: 100,
};

function pieceScore(type: PieceType, file: number, rank: number, side: Side): number {
  let s = VALUE[type];
  if (type === 'soldier' && crossedRiver(rank, side)) {
    s += 100;
    // deeper into enemy camp is better (rank 0 for red, rank 9 for black)
    const depth = side === 'red' ? 4 - rank : rank - 5;
    s += depth * 10;
  }
  if ((type === 'knight' || type === 'rook') && file >= 3 && file <= 5) s += 10;
  return s;
}

/** Positive = good for `side`. */
export function evaluate(board: Board, side: Side): number {
  let total = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) continue;
    const s = pieceScore(p.type, fileOf(i), rankOf(i), p.side);
    total += p.side === side ? s : -s;
  }
  return total;
}
```

`src/ai/search.ts`:
```ts
import { applyMove, boardKey } from '../engine/board';
import { inCheck, legalMoves } from '../engine/rules';
import type { Board, Move, Side } from '../engine/types';
import { opposite } from '../engine/types';
import { evaluate, VALUE } from './evaluate';

export type Level = 1 | 2 | 3;
const MATE = 100000;

interface Ctx {
  deadline: number;
  nodes: number;
  aborted: boolean;
}

function orderMoves(board: Board, moves: Move[]): Move[] {
  return moves
    .map((m) => ({ m, v: board[m.to] ? VALUE[board[m.to]!.type] : 0 }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.m);
}

function quiesce(board: Board, side: Side, alpha: number, beta: number, depth: number, ctx: Ctx): number {
  ctx.nodes++;
  const stand = evaluate(board, side);
  if (depth === 0 || stand >= beta) return stand;
  alpha = Math.max(alpha, stand);
  const captures = orderMoves(board, legalMoves(board, side).filter((m) => board[m.to]));
  for (const m of captures) {
    const score = -quiesce(applyMove(board, m).board, opposite(side), -beta, -alpha, depth - 1, ctx);
    if (score >= beta) return score;
    alpha = Math.max(alpha, score);
  }
  return alpha;
}

function negamax(
  board: Board,
  side: Side,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  useQuiesce: boolean,
  ctx: Ctx,
): number {
  ctx.nodes++;
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
  const moves = legalMoves(board, side);
  if (moves.length === 0) return -MATE + ply; // checkmate and stalemate both lose
  if (depth === 0) {
    return useQuiesce ? quiesce(board, side, alpha, beta, 4, ctx) : evaluate(board, side);
  }
  let best = -Infinity;
  for (const m of orderMoves(board, moves)) {
    const score = -negamax(applyMove(board, m).board, opposite(side), depth - 1, ply + 1, -beta, -alpha, useQuiesce, ctx);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta || ctx.aborted) break;
  }
  return best;
}

function scoreRoot(board: Board, side: Side, depth: number, useQuiesce: boolean, ctx: Ctx): Array<{ move: Move; score: number }> {
  const moves = orderMoves(board, legalMoves(board, side));
  const out: Array<{ move: Move; score: number }> = [];
  for (const m of moves) {
    const score = -negamax(applyMove(board, m).board, opposite(side), depth - 1, 1, -Infinity, Infinity, useQuiesce, ctx);
    out.push({ move: m, score });
    if (ctx.aborted) break;
  }
  return out;
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)];
}

function pickWithRepetitionAvoidance(
  board: Board,
  side: Side,
  scored: Array<{ move: Move; score: number }>,
  recentKeys: string[],
  rng: () => number,
): Move {
  const best = Math.max(...scored.map((s) => s.score));
  const recent = new Set(recentKeys);
  const fresh = scored.filter((s) => !recent.has(boardKey(applyMove(board, s.move).board, opposite(side))));
  const freshBest = fresh.length ? Math.max(...fresh.map((s) => s.score)) : -Infinity;
  const pool = freshBest >= best - 50 ? fresh : scored;
  const top = Math.max(...pool.map((s) => s.score));
  return pick(pool.filter((s) => s.score >= top - 10), rng).move;
}

export function chooseMove(
  board: Board,
  side: Side,
  level: Level,
  recentKeys: string[],
  rng: () => number = Math.random,
  timeLimitMs = 1500,
): Move | null {
  const legal = legalMoves(board, side);
  if (legal.length === 0) return null;

  if (level === 1) {
    const captures = legal.filter((m) => board[m.to]);
    return pick(captures.length ? captures : legal, rng);
  }

  const ctx: Ctx = { deadline: Date.now() + timeLimitMs, nodes: 0, aborted: false };
  if (level === 2) {
    return pickWithRepetitionAvoidance(board, side, scoreRoot(board, side, 2, false, ctx), recentKeys, rng);
  }

  // level 3: iterative deepening 1..4 with quiescence, keep the last completed depth
  let scored = scoreRoot(board, side, 1, true, ctx);
  for (let depth = 2; depth <= 4 && !ctx.aborted; depth++) {
    const next = scoreRoot(board, side, depth, true, ctx);
    if (!ctx.aborted) scored = next;
  }
  return pickWithRepetitionAvoidance(board, side, scored, recentKeys, rng);
}

export { inCheck };
```

Remove the trailing `export { inCheck }` line if unused by the worker (it is unused; delete it — it is here only so TS does not flag the import in editors that auto-remove).

`src/ai/worker.ts`:
```ts
import type { Board, Move, Side } from '../engine/types';
import { chooseMove, type Level } from './search';

export interface AiRequest {
  id: number;
  board: Board;
  side: Side;
  level: Level;
  recentKeys: string[];
}
export interface AiResponse {
  id: number;
  move: Move | null;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, board, side, level, recentKeys } = e.data;
  const move = chooseMove(board, side, level, recentKeys);
  const res: AiResponse = { id, move };
  (self as unknown as Worker).postMessage(res);
};
```

`src/ai/client.ts`:
```ts
import type { Board, Move, Side } from '../engine/types';
import type { Level } from './search';
import type { AiRequest, AiResponse } from './worker';

export class AiClient {
  private worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, (m: Move | null) => void>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const resolve = this.pending.get(e.data.id);
      if (resolve) {
        this.pending.delete(e.data.id);
        resolve(e.data.move);
      }
    };
  }

  /** Resolves after the search finishes AND at least `minDelayMs` has elapsed. */
  think(board: Board, side: Side, level: Level, recentKeys: string[], minDelayMs = 600): Promise<Move | null> {
    const id = this.nextId++;
    const req: AiRequest = { id, board, side, level, recentKeys };
    const search = new Promise<Move | null>((resolve) => this.pending.set(id, resolve));
    const delay = new Promise<void>((r) => setTimeout(r, minDelayMs));
    this.worker.postMessage(req);
    return Promise.all([search, delay]).then(([m]) => m);
  }

  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ai/search.test.ts` → Expected: all PASS. Level-3 test should finish well under 2 s; if it times out, lower `timeLimitMs` in the test call to 1000 rather than weakening the assertion.

- [ ] **Step 5: Type-check the worker/client (no DOM tests)**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ai
git commit -m "feat(ai): alpha-beta search with three levels, repetition avoidance, worker client"
```

---

### Task 7: Board geometry and piece image URLs

**Files:**
- Create: `src/assets/boardGeometry.ts`, `src/assets/pieceImages.ts`, `src/assets/boardGeometry.test.ts`

**Interfaces:**
- Produces:
  - `BOARD = { width: 2048, height: 1952, files: number[9], ranks: number[10], pieceDiameter: number }` in source-image pixels (spec §8 measured values)
  - `squareCenter(i: number, flipped: boolean): { x: number; y: number }`
  - `nearestSquare(x, y, flipped): number | null` — nearest intersection within 0.5 × min spacing, else null
  - `pieceImageUrl(piece: Piece): string` → `${import.meta.env.BASE_URL}pieces/${side}/${type}.png`
  - `BOARD_IMAGE_URL = `${import.meta.env.BASE_URL}board.webp``

- [ ] **Step 1: Write the failing test**

`src/assets/boardGeometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { idx } from '../engine/types';
import { BOARD, nearestSquare, squareCenter } from './boardGeometry';

describe('boardGeometry', () => {
  it('has 9 files and 10 ranks in ascending order', () => {
    expect(BOARD.files).toHaveLength(9);
    expect(BOARD.ranks).toHaveLength(10);
    expect([...BOARD.files].sort((a, b) => a - b)).toEqual(BOARD.files);
  });
  it('maps squares to centers and flips correctly', () => {
    expect(squareCenter(idx(0, 0), false)).toEqual({ x: BOARD.files[0], y: BOARD.ranks[0] });
    expect(squareCenter(idx(0, 0), true)).toEqual({ x: BOARD.files[8], y: BOARD.ranks[9] });
  });
  it('finds the nearest square only when close enough', () => {
    const c = squareCenter(idx(4, 5), false);
    expect(nearestSquare(c.x + 30, c.y - 30, false)).toBe(idx(4, 5));
    expect(nearestSquare(c.x + 30, c.y - 30, true)).toBe(idx(8 - 4, 9 - 5));
    expect(nearestSquare(5, 5, false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/assets` → Expected: FAIL, cannot resolve.

- [ ] **Step 3: Write the implementation**

`src/assets/boardGeometry.ts`:
```ts
import { fileOf, idx, rankOf } from '../engine/types';

/**
 * Measured on assets/board/board-empty.png (2048x1952). The AI-drawn grid is
 * not evenly spaced (rightmost file is ~30% wider), so pieces are placed on the
 * measured intersections. Swap this table when swapping the board image.
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
```

`src/assets/pieceImages.ts`:
```ts
import type { Piece } from '../engine/types';

const BASE = import.meta.env.BASE_URL;
export const BOARD_IMAGE_URL = `${BASE}board.webp`;
export function pieceImageUrl(piece: Piece): string {
  return `${BASE}pieces/${piece.side}/${piece.type}.png`;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/assets` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/assets
git commit -m "feat(assets): measured board geometry and piece image URLs"
```

---

### Task 8: Board view (SVG rendering, markers, animation, pointer input)

**Files:**
- Create: `src/ui/boardView.ts`

**Interfaces:**
- Consumes: `BOARD`, `squareCenter`, `nearestSquare`, `pieceImageUrl`, `BOARD_IMAGE_URL`, `Board`, `Piece`
- Produces:
  ```ts
  interface BoardViewHandlers {
    onPickUp(square: number): boolean;          // return true to allow drag/select
    onDrop(from: number, to: number | null): boolean; // drag ended; return true if the move was accepted
    onTap(square: number): void;                // tap (no drag) on any square
  }
  class BoardView {
    constructor(container: HTMLElement, handlers: BoardViewHandlers)
    setFlipped(flipped: boolean): void
    setPosition(board: Board): void             // full redraw, no animation
    animateMove(from: number, to: number, board: Board): Promise<void> // slide 200ms, fade capture, then setPosition(board)
    showTargets(squares: number[], board: Board): void
    clearTargets(): void
    select(square: number | null): void
    flash(square: number): void                 // 1s blink
    showHint(from: number, to: number): void    // 2s
    setLocked(locked: boolean): void            // ignore pointer input
  }
  ```

Implementation notes:
- One `<svg viewBox="0 0 2048 1952">` filling the container width; `preserveAspectRatio="xMidYMid meet"`.
- Layers in order: board `<image>`, `g.targets`, `g.pieces`, `g.overlay`.
- Each piece is `<g class="piece" style="transform: translate(Xpx, Ypx)">` containing `<image x=-90 y=-90 width=180 height=180>`. CSS `.piece { transition: transform .2s ease }` gives the slide; add class `no-anim` (transition none) during `setPosition` and drags.
- Pointer: `pointerdown` on a piece → `onPickUp(square)`; if true, `setPointerCapture`, remember start point; on `pointermove` beyond 8 px mark as dragging and move the piece group under the pointer (convert client → SVG coords with `svg.getScreenCTM()!.inverse()`); on `pointerup`: if dragging → `to = nearestSquare(...)`, call `onDrop(from, to)`; if not accepted, animate the piece back to its square; if not dragging → `onTap(square)`. `pointerdown` on empty board → `onTap(nearestSquare)` on `pointerup`.
- `touch-action: none` on the svg so the page does not scroll while dragging.
- Markers: dot `<circle r=22 class="dot">` on empty targets, ring `<circle r=100 class="ring">` on capturable ones; selection `<circle r=98 class="selected">`; hint reuses dot + selected with class `hint`.
- `flash(square)`: add class `flash` to the piece group for 1000 ms (CSS keyframes opacity).

- [ ] **Step 1: Write the implementation**

`src/ui/boardView.ts`:
```ts
import { BOARD, nearestSquare, squareCenter } from '../assets/boardGeometry';
import { BOARD_IMAGE_URL, pieceImageUrl } from '../assets/pieceImages';
import type { Board } from '../engine/types';

export interface BoardViewHandlers {
  onPickUp(square: number): boolean;
  onDrop(from: number, to: number | null): boolean;
  onTap(square: number): void;
}

const NS = 'http://www.w3.org/2000/svg';
const R = BOARD.pieceDiameter / 2;
const DRAG_THRESHOLD_PX = 8;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export class BoardView {
  private svg: SVGSVGElement;
  private targets = el('g', { class: 'targets' });
  private pieces = el('g', { class: 'pieces' });
  private overlay = el('g', { class: 'overlay' });
  private pieceEls = new Map<number, SVGGElement>();
  private flipped = false;
  private locked = false;
  private drag: { square: number; startX: number; startY: number; dragging: boolean; el: SVGGElement } | null = null;

  constructor(container: HTMLElement, private handlers: BoardViewHandlers) {
    this.svg = el('svg', { viewBox: `0 0 ${BOARD.width} ${BOARD.height}`, preserveAspectRatio: 'xMidYMid meet', class: 'board' });
    const img = el('image', { href: BOARD_IMAGE_URL, x: 0, y: 0, width: BOARD.width, height: BOARD.height });
    this.svg.append(img, this.targets, this.pieces, this.overlay);
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
    // force style flush so the next transform change animates
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
    mover.parentElement?.append(mover); // draw on top
    if (victim) victim.classList.add('captured');
    this.place(mover, to);
    return new Promise((resolve) =>
      setTimeout(() => {
        this.setPosition(board);
        resolve();
      }, 220),
    );
  }

  showTargets(squares: number[], board: Board): void {
    this.clearTargets();
    for (const s of squares) {
      const { x, y } = squareCenter(s, this.flipped);
      this.targets.append(board[s] ? el('circle', { cx: x, cy: y, r: R + 10, class: 'ring' }) : el('circle', { cx: x, cy: y, r: 22, class: 'dot' }));
    }
  }
  clearTargets(): void {
    this.targets.replaceChildren();
  }

  select(square: number | null): void {
    this.overlay.querySelectorAll('.selected').forEach((n) => n.remove());
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
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(this.svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.locked || this.drag) return;
    const { x, y } = this.toSvgPoint(e);
    const square = nearestSquare(x, y, this.flipped);
    if (square === null) return;
    const pieceEl = this.pieceEls.get(square);
    if (pieceEl && this.handlers.onPickUp(square)) {
      this.drag = { square, startX: e.clientX, startY: e.clientY, dragging: false, el: pieceEl };
      this.svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else {
      // tap on empty square or non-pickable piece: report on pointerup
      this.drag = { square, startX: e.clientX, startY: e.clientY, dragging: false, el: pieceEl ?? el('g') };
      this.svg.setPointerCapture(e.pointerId);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || !this.pieceEls.has(d.square) || d.el !== this.pieceEls.get(d.square)) return;
    if (!d.dragging && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
    if (!d.dragging) {
      d.dragging = true;
      d.el.classList.add('dragging');
      d.el.parentElement?.append(d.el);
    }
    const { x, y } = this.toSvgPoint(e);
    d.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  private onPointerUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.dragging) {
      d.el.classList.remove('dragging');
      const { x, y } = this.toSvgPoint(e);
      const to = nearestSquare(x, y, this.flipped);
      const accepted = this.handlers.onDrop(d.square, to === d.square ? null : to);
      if (!accepted) this.place(d.el, d.square); // bounce back (CSS transition)
    } else {
      this.handlers.onTap(d.square);
    }
  }

  private cancelDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (d?.dragging) {
      d.el.classList.remove('dragging');
      this.place(d.el, d.square);
    }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/boardView.ts
git commit -m "feat(ui): SVG board view with drag/tap input, markers and move animation"
```

(Visual verification happens in Task 11 with the full app.)

---

### Task 9: Controls panel, captured bars, dialogs

**Files:**
- Create: `src/ui/controls.ts`, `src/ui/capturedBar.ts`, `src/ui/dialog.ts`

**Interfaces:**
- Produces:
  ```ts
  type Mode = 'pvp' | 'ai';
  interface ControlsState { turn: Side; thinking: boolean; mode: Mode; playerSide: Side; level: Level; canUndo: boolean; canHint: boolean; soundOn: boolean; }
  interface ControlsHandlers { onMode(m: Mode): void; onPlayerSide(s: Side): void; onLevel(l: Level): void; onUndo(): void; onHint(): void; onRestart(): void; onToggleSound(): void; }
  class Controls { constructor(container: HTMLElement, h: ControlsHandlers); render(s: ControlsState): void }
  class CapturedBar { constructor(container: HTMLElement); render(pieces: Piece[]): void }
  function confirmDialog(message: string): Promise<boolean>
  class Banner { constructor(container: HTMLElement, h: { onAgain(): void; onUndo(): void }); show(title: string, subtitle: string): void; hide(): void }
  ```

- [ ] **Step 1: Write `src/ui/controls.ts`**

```ts
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
  private mode = segmented<Mode>([{ value: 'pvp', label: '雙人' }, { value: 'ai', label: '電腦' }], (m) => this.h.onMode(m));
  private side = segmented<Side>([{ value: 'red', label: '紅' }, { value: 'black', label: '黑' }], (s) => this.h.onPlayerSide(s));
  private level = segmented<Level>([{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }], (l) => this.h.onLevel(l));
  private undo = button('悔棋', () => this.h.onUndo());
  private hint = button('提示', () => this.h.onHint());
  private restart = button('重新開始', () => this.h.onRestart());
  private sound = button('🔊 音效', () => this.h.onToggleSound());
  private sideRow = this.row('顏色', this.side.root);
  private levelRow = this.row('難度', this.level.root);

  constructor(container: HTMLElement, private h: ControlsHandlers) {
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
```

- [ ] **Step 2: Write `src/ui/capturedBar.ts`**

```ts
import { pieceImageUrl } from '../assets/pieceImages';
import type { Piece, PieceType } from '../engine/types';

const ORDER: PieceType[] = ['rook', 'knight', 'cannon', 'elephant', 'advisor', 'soldier'];

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
```

- [ ] **Step 3: Write `src/ui/dialog.ts`**

```ts
function bigButton(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn big ${cls}`;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** Kid-friendly yes/no dialog. Resolves true for 是. */
export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    const box = document.createElement('div');
    box.className = 'dialog';
    const text = document.createElement('p');
    text.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const done = (v: boolean) => {
      backdrop.remove();
      resolve(v);
    };
    actions.append(bigButton('是', 'yes', () => done(true)), bigButton('否', 'no', () => done(false)));
    box.append(text, actions);
    backdrop.append(box);
    document.body.append(backdrop);
  });
}

export class Banner {
  private root = document.createElement('div');
  private title = document.createElement('div');
  private subtitle = document.createElement('div');
  constructor(container: HTMLElement, h: { onAgain(): void; onUndo(): void }) {
    this.root.className = 'banner';
    this.root.hidden = true;
    this.title.className = 'banner-title';
    this.subtitle.className = 'banner-subtitle';
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(bigButton('再來一局', 'yes', h.onAgain), bigButton('悔棋', 'no', h.onUndo));
    this.root.append(this.title, this.subtitle, actions);
    container.append(this.root);
  }
  show(title: string, subtitle: string): void {
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.root.hidden = false;
  }
  hide(): void {
    this.root.hidden = true;
  }
}
```

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit` → Expected: no errors.

```bash
git add src/ui/controls.ts src/ui/capturedBar.ts src/ui/dialog.ts
git commit -m "feat(ui): settings panel, captured-piece bar, confirm dialog and game-over banner"
```

---

### Task 10: Sounds

**Files:**
- Create: `src/audio/sounds.ts`

**Interfaces:**
- Produces: `type SoundName = 'drop' | 'capture' | 'check' | 'win'`; `class Sounds { enabled: boolean; play(name: SoundName): void; unlock(): void }`
- Behaviour (spec §6): synthesized via Web Audio; if `${BASE_URL}sounds/<name>.mp3` responds OK to a HEAD request at startup, decode and use it instead; `unlock()` is called on first user gesture to create/resume the AudioContext.

- [ ] **Step 1: Write `src/audio/sounds.ts`**

```ts
export type SoundName = 'drop' | 'capture' | 'check' | 'win';
const NAMES: SoundName[] = ['drop', 'capture', 'check', 'win'];

export class Sounds {
  enabled = true;
  private ctx: AudioContext | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private fileUrls = new Map<SoundName, string>();

  constructor() {
    const base = import.meta.env.BASE_URL;
    for (const n of NAMES) {
      const url = `${base}sounds/${n}.mp3`;
      fetch(url, { method: 'HEAD' })
        .then((r) => {
          if (r.ok && (r.headers.get('content-type') ?? '').startsWith('audio')) this.fileUrls.set(n, url);
        })
        .catch(() => undefined);
    }
  }

  /** Call on the first user gesture; browsers block audio before that. */
  unlock(): void {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SoundName): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx!;
    const url = this.fileUrls.get(name);
    if (url) {
      void this.playFile(name, url);
      return;
    }
    const t = ctx.currentTime;
    switch (name) {
      case 'drop':
        this.thump(t, 180, 0.12, 0.9);
        this.noise(t, 0.03, 0.35);
        break;
      case 'capture':
        this.noise(t, 0.04, 0.5);
        this.thump(t, 140, 0.16, 1);
        this.thump(t + 0.09, 110, 0.18, 0.8);
        break;
      case 'check':
        this.tone(t, 880, 0.12, 0.35);
        this.tone(t + 0.14, 880, 0.12, 0.35);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.13, f, 0.22, 0.35));
        break;
    }
  }

  private async playFile(name: SoundName, url: string): Promise<void> {
    const ctx = this.ctx!;
    let buf = this.buffers.get(name);
    if (!buf) {
      const data = await (await fetch(url)).arrayBuffer();
      buf = await ctx.decodeAudioData(data);
      this.buffers.set(name, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  }

  private thump(t: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  private noise(t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  }

  private tone(t: number, freq: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit` → Expected: no errors.

```bash
git add src/audio/sounds.ts
git commit -m "feat(audio): synthesized drop/capture/check/win sounds with optional file override"
```

---

### Task 11: App controller, layout CSS, manual verification

**Files:**
- Create: `src/ui/app.ts`
- Modify: `src/main.ts`, `src/style.css` (replace the stubs)

**Interfaces:**
- Consumes everything above.
- Produces: `class App { constructor(root: HTMLElement) }`.

Controller rules (spec §4, §5):
- State: `game: Game`, `mode: Mode = 'pvp'`, `playerSide: Side = 'red'`, `level: Level = 1`, `thinking = false`, `selected: number | null`, `over = false`.
- `humanCanMove()` = `!thinking && !over && (mode === 'pvp' || game.turn === playerSide)`.
- `onPickUp(sq)`: allowed iff `humanCanMove()` and the piece at `sq` belongs to `game.turn`; then `selected = sq`, show targets + selection. Return allowed.
- `onDrop(from, to)`: if `to !== null` and legal → `commit(move, animate=false)`, return true; else keep selection (piece bounces), return false.
- `onTap(sq)`: if `selected !== null` and `sq` is a legal target → `commit(move, animate=true)`; else if `sq` holds a piece of the side to move and `humanCanMove()` → select it (pick-up path already did this on pointerdown, so just return); else clear selection.
- `commit(move, animate)`: `entry = game.play(move)`; clear selection/targets; `animate ? await view.animateMove(...) : view.setPosition(board)`; play `capture` or `drop`; `afterMove(entry)`.
- `afterMove()`: refresh captured bars; `status = game.status()`; if over → banner + `win` sound; else if `game.inCheck()` → flash general + `check` sound; if `mode === 'ai'` and `game.turn !== playerSide` → `aiMove()`. Then `renderControls()`.
- `aiMove()`: `thinking = true`, lock view, render; `move = await ai.think(board, turn, level, game.recentKeys(4))`; if state changed meanwhile (generation counter) discard; else `commit(move, animate=true)`; `thinking = false`, unlock.
- Undo: steps = `mode === 'ai' ? 2 : 1`; `canUndo = !thinking && history.length >= steps`; performing undo pops `steps` entries, `over = false`, banner hide, `setPosition`, refresh bars, render.
- Hint: `canHint = mode === 'ai' && humanCanMove() && !over`; `ai.think(board, turn, 3, [], 0)` then `view.showHint(from, to)`.
- Mode/side change: if `history.length > 0` → `confirmDialog('要重新開始嗎？')`; on yes (or no history) apply and `newGame()`. Level change applies immediately.
- `newGame()`: `game.reset()`, `over=false`, `selected=null`, banner hide, `view.setFlipped(mode==='ai' && playerSide==='black')`, `setPosition`, bars, render; if AI to move (player black) → `aiMove()`.
- Restart button: same confirm rule then `newGame()`.
- Captured bars: bottom bar shows `game.captured(bottomSide)` where `bottomSide = flipped ? 'black' : 'red'`; top bar shows the other.
- Sounds: `sounds.unlock()` on first `pointerdown` anywhere (document listener, `{ once: true }`).

- [ ] **Step 1: Write `src/ui/app.ts`**

```ts
import { AiClient } from '../ai/client';
import type { Level } from '../ai/search';
import { Sounds } from '../audio/sounds';
import { Game } from '../engine/game';
import { findGeneral } from '../engine/rules';
import type { Move, Side } from '../engine/types';
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
      onToggleSound: () => {
        this.sounds.enabled = !this.sounds.enabled;
        this.render();
      },
    });
    document.addEventListener('pointerdown', () => this.sounds.unlock(), { once: true });
    void this.newGame();
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
      soundOn: this.sounds.enabled,
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

  // ---- board input ----
  private onPickUp(sq: number): boolean {
    if (!this.humanCanMove()) return false;
    const p = this.game.board[sq];
    if (!p || p.side !== this.game.turn) return false;
    this.selected = sq;
    this.view.select(sq);
    this.view.showTargets(this.game.legalMovesFrom(sq).map((m) => m.to), this.game.board);
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
    this.view.setLocked(false);
    this.view.setFlipped(this.flipped);
    this.view.setPosition(this.game.board);
    this.render();
    if (this.mode === 'ai' && this.game.turn !== this.playerSide) await this.aiMove();
  }
}
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import './style.css';
import { App } from './ui/app';

new App(document.getElementById('app')!);
```

- [ ] **Step 3: Replace `src/style.css`**

```css
:root {
  --bg: #f3e9d6;
  --panel: #fff8ea;
  --ink: #3a2a1a;
  --red: #c8261a;
  --black: #222;
  --accent: #e0a03a;
  color-scheme: light;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); font-family: "Microsoft JhengHei", "PingFang TC", system-ui, sans-serif; }
#app { height: 100%; }

.app { display: grid; gap: 12px; padding: 12px; height: 100%; }
.board-col { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; gap: 6px; }
.board-wrap { position: relative; width: 100%; max-width: 100%; flex: 0 1 auto; min-height: 0; }
.board { display: block; width: 100%; height: auto; touch-action: none; user-select: none; -webkit-user-select: none; }
.panel-col { display: flex; flex-direction: column; justify-content: center; }

/* landscape: board left, panel right */
@media (orientation: landscape) {
  .app { grid-template-columns: 1fr 240px; }
  .board-wrap { width: min(100%, calc((100vh - 24px - 120px) * 2048 / 1952)); }
}
/* portrait: board top, panel bottom */
@media (orientation: portrait) {
  .app { grid-template-rows: auto 1fr; align-content: start; }
  .panel-col { justify-content: start; }
}

/* pieces and markers */
.piece { transition: transform 0.2s ease; cursor: grab; }
.pieces.no-anim .piece { transition: none; }
.piece.dragging { transition: none; cursor: grabbing; }
.piece.captured { opacity: 0; transition: opacity 0.2s ease; }
.piece.flash { animation: flash 0.25s steps(2, end) 4; }
@keyframes flash { to { opacity: 0.2; } }
.dot { fill: rgba(40, 160, 70, 0.85); pointer-events: none; }
.ring { fill: none; stroke: rgba(210, 40, 40, 0.9); stroke-width: 10; pointer-events: none; }
.selected { fill: none; stroke: var(--accent); stroke-width: 10; pointer-events: none; }
.hint { stroke: #2b7de9; fill: rgba(43, 125, 233, 0.85); }
.selected.hint { fill: none; }

/* panel */
.panel { display: flex; flex-direction: column; gap: 10px; background: var(--panel); border-radius: 16px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.status { font-size: 24px; font-weight: 700; text-align: center; padding: 12px; border-radius: 12px; color: #fff; }
.status.red { background: var(--red); }
.status.black { background: var(--black); }
.status.thinking { background: #777; }
.row { display: flex; align-items: center; gap: 8px; }
.row[hidden] { display: none; }
.label { min-width: 40px; font-size: 16px; }
.segmented { display: flex; flex: 1; gap: 4px; }
.btn { min-height: 48px; font-size: 18px; border: 2px solid #d8c7a5; border-radius: 12px; background: #fff; color: var(--ink); cursor: pointer; padding: 0 12px; }
.btn:disabled { opacity: 0.4; cursor: default; }
.btn.seg { flex: 1; padding: 0; }
.btn.seg.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn[hidden] { display: none; }
.btn.big { min-height: 64px; font-size: 24px; min-width: 140px; }
.btn.yes { background: #3ca55c; border-color: #3ca55c; color: #fff; }
.btn.no { background: #e06c3c; border-color: #e06c3c; color: #fff; }

/* captured bars */
.captured { display: flex; gap: 10px; min-height: 44px; align-items: center; justify-content: center; flex-wrap: wrap; }
.captured-item { display: flex; align-items: center; gap: 4px; font-size: 18px; font-weight: 700; }
.captured-item img { width: 40px; height: 40px; }

/* dialogs */
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 10; }
.dialog { background: var(--panel); border-radius: 20px; padding: 24px 28px; text-align: center; font-size: 26px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
.actions { display: flex; gap: 16px; justify-content: center; margin-top: 16px; }
.banner { position: absolute; left: 0; right: 0; top: 40%; transform: translateY(-50%); background: rgba(255, 248, 234, 0.96); text-align: center; padding: 20px; box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
.banner[hidden] { display: none; }
.banner-title { font-size: 40px; font-weight: 800; }
.banner-subtitle { font-size: 20px; min-height: 24px; }
```

- [ ] **Step 4: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build` → Expected: all pass, `dist/` contains `index.html`, `assets/*.js`, a worker chunk, `board.webp`, `pieces/`.

- [ ] **Step 5: Manual verification in a browser**

Run: `npm run dev` and open the printed URL (note the `/chinese-chess/` base). Check each line; fix and re-check until all hold:
1. Board image shows with 32 pieces on the drawn intersections (including the wide rightmost file).
2. Tap a red piece → orange selection ring + green dots / red rings; tap a dot → piece slides; drop sound plays (after first click).
3. Drag a red piece onto a legal square → lands instantly; onto an illegal square → bounces back; dragging does not scroll the page on a touch device.
4. Tap a black piece on red's turn → nothing selected.
5. Capture → captured piece fades, count appears in the strip on the capturer's side (`×1`).
6. Give check → enemy general blinks, check sound.
7. Checkmate (e.g. a quick 雙車 mate against a deliberately passive opponent) → banner 「紅方獲勝！」 with 再來一局 / 悔棋; 悔棋 hides banner and restores.
8. 悔棋 in 雙人 undoes one half-move, including restoring a captured piece and its count.
9. Switch to 電腦 with moves played → confirm dialog appears; 否 keeps the game; 是 restarts. Choose 黑 → board flips, red at top, computer moves first after ≥0.6 s with 「電腦思考中…」.
10. In 電腦 mode: undo removes two half-moves; undo button greyed after only the computer's first move (player black).
11. 提示 highlights a piece and a destination for ~2 s (only visible in 電腦 mode, disabled while thinking).
12. Difficulty 3: computer answers within ~2 s; UI stays responsive during thinking.
13. 音效 toggle mutes/unmutes.
14. Resize window to portrait → board on top, panel below; landscape → side by side. Test on an iPad if available.

- [ ] **Step 6: Commit**

```bash
git add src/ui/app.ts src/main.ts src/style.css
git commit -m "feat(ui): app controller with modes, undo, hint, captured bars and responsive layout"
```

---

### Task 12: GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: Write the workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`README.md`:
```markdown
# Chinese Chess

給小朋友玩的中國象棋網頁：https://max8568.github.io/chinese-chess/

- 雙人對戰或對電腦（三級難度），可選紅或黑
- 拖曳或點選走棋，點棋子顯示可走位置
- 悔棋、提示、音效

## 開發

    npm install
    npm run dev      # 本機預覽
    npm test         # 規則引擎與電腦對手的單元測試
    npm run build    # 輸出到 dist/

素材處理：`python tools/prepare-assets.py`（需要 Pillow、numpy）。
設計文件：`docs/superpowers/specs/2026-09-04-chinese-chess-design.md`
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: build, test and deploy to GitHub Pages"
```

- [ ] **Step 3: Create the repo and push (approved in the interview: Q31)**

```bash
git branch -M main
gh auth switch --user max8568
gh repo create max8568/chinese-chess --public --source=. --remote=origin --push --description "Chinese chess for kids, playable in the browser"
gh api -X POST repos/max8568/chinese-chess/pages -f build_type=workflow   # Pages source = GitHub Actions
gh run watch --exit-status                                                  # wait for the deploy run
gh auth switch --user igs-hanhongchen
```

If `gh api ... /pages` returns 409 (already enabled) continue. If it returns 404, enable Pages in the repo settings UI (Settings → Pages → Source: GitHub Actions) and re-run the workflow with `gh workflow run deploy.yml`.

- [ ] **Step 4: Verify the live site**

Run: `curl -sI https://max8568.github.io/chinese-chess/ | head -1` → Expected: `HTTP/2 200`.
Open the URL in a browser and repeat manual checks 1, 2, 9, 12 from Task 11 (assets under the `/chinese-chess/` base load, the worker loads).

---

## Self-Review

**Spec coverage:** §1 title/URL (T1, T12) · §2 stack, worker, no persistence (T1, T6, T11 — no storage code anywhere) · §2.2 coordinates (T2) · §3 rules (T3, T4) · §4 AI levels, delay, repetition, lock during thinking, black-player flip (T6, T11) · §5.1 layout, 48px (T11 CSS) · §5.2 panel rows, confirm dialog, level no-restart (T9, T11) · §5.3 drag/tap, markers, bounce, animation, fade (T8, T11) · §5.4 flash, banner (T8, T9, T11) · §5.5 captured strips grouped, fixed order, side placement (T9, T11) · §5.6 undo steps and greying (T11) · §5.7 hint (T11) · §6 sounds (T10) · §8 geometry table, prepared assets (T7, baseline commit) · §9 repo, workflow, base, favicon (T1, T12) · §10 tests (T2–T7).

**Placeholders:** none; every code step has full content.

**Type consistency:** `Level` from `src/ai/search.ts` used in controls/app; `Mode` from controls used in app; `BoardViewHandlers` signatures match app's `onPickUp/onDrop/onTap`; `Game.captured(by)` used by app; `findGeneral` imported from rules in app; `AiClient.think(board, side, level, recentKeys, minDelayMs)` matches calls in app (`hint` passes `0`).
