import { applyMove, boardKey } from '../engine/board';
import { legalMoves } from '../engine/rules';
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

interface Scored {
  move: Move;
  score: number;
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

function scoreRoot(board: Board, side: Side, depth: number, useQuiesce: boolean, ctx: Ctx): Scored[] {
  const moves = orderMoves(board, legalMoves(board, side));
  const out: Scored[] = [];
  for (const m of moves) {
    const score = -negamax(applyMove(board, m).board, opposite(side), depth - 1, 1, -Infinity, Infinity, useQuiesce, ctx);
    out.push({ move: m, score });
    if (ctx.aborted) break;
  }
  return out;
}

function pick<T>(items: T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function pickWithRepetitionAvoidance(board: Board, side: Side, scored: Scored[], recentKeys: string[], rng: () => number): Move {
  const best = Math.max(...scored.map((s) => s.score));
  const recent = new Set(recentKeys);
  const fresh = scored.filter((s) => !recent.has(boardKey(applyMove(board, s.move).board, opposite(side))));
  const freshBest = fresh.length ? Math.max(...fresh.map((s) => s.score)) : -Infinity;
  const pool = freshBest >= best - 50 ? fresh : scored;
  const top = Math.max(...pool.map((s) => s.score));
  // near-equal moves are interchangeable, except mate scores where 2 points = one move slower
  const tolerance = Math.abs(top) > MATE / 2 ? 0 : 10;
  return pick(pool.filter((s) => s.score >= top - tolerance), rng).move;
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
