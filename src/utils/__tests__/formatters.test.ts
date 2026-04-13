/**
 * Formatters utility tests — full coverage of all exported functions.
 */

import {
  formatOvers,
  formatScore,
  formatBatterScore,
  formatBowlerFigures,
  formatBallOutcome,
  dismissalDescription,
  remainingBalls,
} from '../formatters';
import type { BallOutcome, DismissalType } from '../../engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// formatOvers
// ─────────────────────────────────────────────────────────────────────────────

describe('formatOvers', () => {
  test('whole overs display without decimal', () => {
    expect(formatOvers(5, 0)).toBe('5');
    expect(formatOvers(0, 0)).toBe('0');
  });

  test('partial over displays as "overs.balls"', () => {
    expect(formatOvers(3, 2)).toBe('3.2');
    expect(formatOvers(0, 1)).toBe('0.1');
    expect(formatOvers(19, 5)).toBe('19.5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatScore
// ─────────────────────────────────────────────────────────────────────────────

describe('formatScore', () => {
  test('formats runs/wickets pair', () => {
    expect(formatScore(120, 3)).toBe('120/3');
    expect(formatScore(0, 0)).toBe('0/0');
    expect(formatScore(300, 10)).toBe('300/10');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatBatterScore
// ─────────────────────────────────────────────────────────────────────────────

describe('formatBatterScore', () => {
  test('not-out batter shows asterisk', () => {
    expect(formatBatterScore(45, 32, true)).toBe('45* (32)');
  });

  test('dismissed batter has no asterisk', () => {
    expect(formatBatterScore(75, 60, false)).toBe('75 (60)');
  });

  test('duck (0 runs, not out)', () => {
    expect(formatBatterScore(0, 1, true)).toBe('0* (1)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatBowlerFigures
// ─────────────────────────────────────────────────────────────────────────────

describe('formatBowlerFigures', () => {
  test('formats wickets/runs', () => {
    expect(formatBowlerFigures(3, 24)).toBe('3/24');
    expect(formatBowlerFigures(0, 40)).toBe('0/40');
    expect(formatBowlerFigures(5, 12)).toBe('5/12');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatBallOutcome
// ─────────────────────────────────────────────────────────────────────────────

function makeBall(overrides: Partial<BallOutcome> = {}): BallOutcome {
  return {
    id: 'b1',
    overNumber: 0,
    ballInOver: 0,
    batsmanId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'bwl1',
    runs: 0,
    extras: [],
    isLegal: true,
    isBoundary: false,
    dismissal: null,
    isFreeHit: false,
    timestamp: 0,
    ...overrides,
  };
}

describe('formatBallOutcome', () => {
  test('dot ball → "."', () => {
    expect(formatBallOutcome(makeBall())).toBe('.');
  });

  test('runs → number string', () => {
    expect(formatBallOutcome(makeBall({ runs: 4, isBoundary: true }))).toBe('4');
    expect(formatBallOutcome(makeBall({ runs: 6, isBoundary: true }))).toBe('6');
    expect(formatBallOutcome(makeBall({ runs: 2 }))).toBe('2');
  });

  test('wicket → "W"', () => {
    const ball = makeBall({ dismissal: { type: 'bowled', batsmanId: 'p1', bowlerId: 'bwl1', fielderId: null } });
    expect(formatBallOutcome(ball)).toBe('W');
  });

  test('wide (no additional runs) → "Wd"', () => {
    const ball = makeBall({ isLegal: false, extras: [{ type: 'wide', runs: 1 }] });
    expect(formatBallOutcome(ball)).toBe('Wd');
  });

  test('wide with additional overthrow runs → "Wd+N"', () => {
    const ball = makeBall({ isLegal: false, extras: [{ type: 'wide', runs: 5 }] }); // 1 penalty + 4 overthrow
    expect(formatBallOutcome(ball)).toBe('Wd+4');
  });

  test('no-ball (no bat runs) → "Nb"', () => {
    const ball = makeBall({ isLegal: false, extras: [{ type: 'no_ball', runs: 1 }], runs: 0 });
    expect(formatBallOutcome(ball)).toBe('Nb');
  });

  test('no-ball with bat runs → "Nb+N"', () => {
    const ball = makeBall({ isLegal: false, extras: [{ type: 'no_ball', runs: 1 }], runs: 4 });
    expect(formatBallOutcome(ball)).toBe('Nb+4');
  });

  test('bye → "Nb" format for byes (runs)', () => {
    const ball = makeBall({ extras: [{ type: 'bye', runs: 2 }] });
    expect(formatBallOutcome(ball)).toBe('2b');
  });

  test('leg-bye → "Nlb" format', () => {
    const ball = makeBall({ extras: [{ type: 'leg_bye', runs: 1 }] });
    expect(formatBallOutcome(ball)).toBe('1lb');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// dismissalDescription
// ─────────────────────────────────────────────────────────────────────────────

describe('dismissalDescription', () => {
  const cases: [DismissalType, string][] = [
    ['bowled',            'Bowled'],
    ['caught',            'Caught'],
    ['lbw',               'LBW'],
    ['run_out',           'Run Out'],
    ['stumped',           'Stumped'],
    ['hit_wicket',        'Hit Wicket'],
    ['handled_ball',      'Handled Ball'],
    ['obstructing_field', 'Obstructing the Field'],
    ['timed_out',         'Timed Out'],
    ['hit_twice',         'Hit the Ball Twice'],
    ['retired_hurt',      'Retired Hurt'],
    ['retired_out',       'Retired Out'],
  ];

  test.each(cases)('%s → "%s"', (type, expected) => {
    expect(dismissalDescription(type)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// remainingBalls
// ─────────────────────────────────────────────────────────────────────────────

describe('remainingBalls', () => {
  test('returns null for Test matches (totalOvers = null)', () => {
    expect(remainingBalls(null, 10, 3)).toBeNull();
  });

  test('full overs remaining at start', () => {
    expect(remainingBalls(20, 0, 0)).toBe(120); // 20 overs * 6 balls
  });

  test('partial over in progress', () => {
    expect(remainingBalls(20, 3, 2)).toBe(100); // 120 - 18 - 2 = 100
  });

  test('final over, 1 ball remaining', () => {
    expect(remainingBalls(20, 19, 5)).toBe(1);
  });

  test('last ball of match', () => {
    expect(remainingBalls(20, 20, 0)).toBe(0);
  });
});
