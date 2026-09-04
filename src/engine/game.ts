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
