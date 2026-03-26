import type { BallOutcome } from '../engine/types';
import { dismissalDescription } from './formatters';

export interface CommentaryContext {
  /** Resolves a playerId → short display name */
  getName: (id: string) => string;
}

// ── Phrase pools ─────────────────────────────────────────────────────────────
// Picked deterministically via ball.id hash so cross-device output is identical.

const SIX_VERBS = ['Pulled', 'Swept', 'Launched', 'Lofted', 'Slapped', 'Dispatched'];
const FOUR_VERBS = ['Driven', 'Flicked', 'Cut', 'Glanced', 'Punched', 'Guided'];
const DOT_PHRASES = [
  'well defended',
  'beaten outside off',
  'plays and misses',
  'good length, no run',
  'watchful defence',
];
const SINGLE_PHRASES = [
  'Pushed into the gap',
  'Rotated away',
  'Nudged through the leg side',
  'Tapped down to {nonStriker}',
  'Worked away for a single',
];

function hashIndex(id: string, len: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % len;
}

function pick<T>(pool: T[], id: string): T {
  return pool[hashIndex(id, pool.length)];
}

// ── Short name helper ─────────────────────────────────────────────────────────
// Uses first name only for brevity in commentary.
function firstName(fullName: string): string {
  return fullName.split(' ')[0];
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Returns a single commentary line for one ball.
 * Pure function — no side effects, same input always produces same output.
 */
export function getBallCommentary(ball: BallOutcome, ctx: CommentaryContext): string {
  const batter = firstName(ctx.getName(ball.batsmanId));
  const bowler = firstName(ctx.getName(ball.bowlerId));
  const nonStriker = firstName(ctx.getName(ball.nonStrikerId));

  // ── Dismissal ───────────────────────────────────────────────────────────
  if (ball.dismissal) {
    const { type, fielderId } = ball.dismissal;
    const fielder = fielderId ? firstName(ctx.getName(fielderId)) : null;
    const runs = (() => {
      const batterInnings = ball.runs;
      return batterInnings; // runs off bat on this ball (may be 0)
    })();

    switch (type) {
      case 'bowled':
        return `WICKET! Bowled him! ${batter} is out — timber!`;
      case 'caught':
        return fielder
          ? `WICKET! Caught by ${fielder} off ${bowler}! ${batter} has to go.`
          : `WICKET! Caught out! ${batter} has to go.`;
      case 'lbw':
        return `WICKET! LBW! ${batter} is trapped in front and has to walk back.`;
      case 'run_out':
        return `WICKET! Run out! ${batter} is short of the crease and has to go.`;
      case 'stumped':
        return fielder
          ? `WICKET! Stumped by ${fielder}! ${batter} is out of the crease.`
          : `WICKET! Stumped! ${batter} is out of the crease.`;
      case 'hit_wicket':
        return `WICKET! Hit wicket! ${batter} dislodges the bails and has to go.`;
      case 'retired_out':
        return `${batter} retires out.`;
      case 'retired_hurt':
        return `${batter} retires hurt and heads off the field.`;
      default:
        return `WICKET! ${dismissalDescription(type)} — ${batter} is out.`;
    }
  }

  // ── Illegal deliveries ───────────────────────────────────────────────────
  if (!ball.isLegal) {
    const extra = ball.extras[0];
    if (extra?.type === 'wide') {
      const additionalRuns = extra.runs - 1;
      if (additionalRuns > 0) {
        return `Wide! ${additionalRuns} run${additionalRuns > 1 ? 's' : ''} added.`;
      }
      return `Wide down the leg side.`;
    }
    if (extra?.type === 'no_ball') {
      if (ball.runs > 0) {
        return `No ball! And ${batter} collects ${ball.runs} off the bat.`;
      }
      return `No ball called — free hit coming up.`;
    }
  }

  // ── Legal extras ─────────────────────────────────────────────────────────
  const bye = ball.extras.find(e => e.type === 'bye');
  if (bye) {
    return `${bye.runs} bye${bye.runs > 1 ? 's' : ''} — gets past the keeper.`;
  }
  const legBye = ball.extras.find(e => e.type === 'leg_bye');
  if (legBye) {
    return `${legBye.runs} leg bye${legBye.runs > 1 ? 's' : ''} — off the pad.`;
  }

  // ── Scoring deliveries ───────────────────────────────────────────────────
  if (ball.runs === 6) {
    const verb = pick(SIX_VERBS, ball.id);
    return `SIX! ${verb} by ${batter} off ${bowler}!`;
  }

  if (ball.runs === 4 && ball.isBoundary) {
    const verb = pick(FOUR_VERBS, ball.id);
    return `FOUR! ${verb} through the gap by ${batter}!`;
  }

  if (ball.runs === 4) {
    // Overthrows or four not flagged as boundary
    return `Four! Overthrows from the field.`;
  }

  if (ball.runs === 3) {
    return `${batter} and ${nonStriker} run three — good running between the wickets.`;
  }

  if (ball.runs === 2) {
    return `Good running — ${batter} and ${nonStriker} take 2.`;
  }

  if (ball.runs === 1) {
    const phrase = pick(SINGLE_PHRASES, ball.id).replace('{nonStriker}', nonStriker);
    return `${phrase} — single taken.`;
  }

  // Dot ball
  const dotPhrase = pick(DOT_PHRASES, ball.id);
  return `${bowler} bowls — ${dotPhrase} from ${batter}.`;
}

/**
 * Returns the last `limit` balls of an innings as commentary lines, newest first.
 * Used for the live feed on the scoring screen.
 */
export function getLiveFeed(
  balls: BallOutcome[],
  ctx: CommentaryContext,
  limit = 5,
): string[] {
  return [...balls]
    .reverse()
    .slice(0, limit)
    .map(b => getBallCommentary(b, ctx));
}
