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
