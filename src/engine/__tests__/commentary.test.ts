import { getBallCommentary, getLiveFeed } from '../../utils/commentary';
import type { BallOutcome } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBall(overrides: Partial<BallOutcome> = {}): BallOutcome {
  return {
    id: 'ball-001',
    overNumber: 0,
    ballInOver: 0,
    batsmanId: 'b1',
    nonStrikerId: 'b2',
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

const ctx = {
  getName: (id: string) => {
    const names: Record<string, string> = {
      b1: 'Rohit Sharma',
      b2: 'Virat Kohli',
      bwl1: 'Jasprit Bumrah',
      f1: 'Ravindra Jadeja',
    };
    return names[id] ?? id;
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getBallCommentary', () => {
  describe('dot ball', () => {
    it('mentions bowler and batter', () => {
      const line = getBallCommentary(makeBall({ runs: 0 }), ctx);
      expect(line).toMatch(/Jasprit/); // firstName of "Jasprit Bumrah"
      expect(line).toMatch(/Rohit/);
    });

    it('is deterministic — same ball.id always produces same string', () => {
      const ball = makeBall({ runs: 0 });
      expect(getBallCommentary(ball, ctx)).toBe(getBallCommentary(ball, ctx));
    });
  });

  describe('single', () => {
    it('contains "single"', () => {
      const line = getBallCommentary(makeBall({ runs: 1 }), ctx);
      expect(line.toLowerCase()).toContain('single');
    });
  });

  describe('two runs', () => {
    it('mentions both batters and "2"', () => {
      const line = getBallCommentary(makeBall({ runs: 2 }), ctx);
      expect(line).toMatch(/Rohit|Kohli/);
      expect(line).toContain('2');
    });
  });

  describe('boundary four', () => {
    it('starts with FOUR', () => {
      const line = getBallCommentary(makeBall({ runs: 4, isBoundary: true }), ctx);
      expect(line).toMatch(/^FOUR!/);
    });

    it('mentions batter name', () => {
      const line = getBallCommentary(makeBall({ runs: 4, isBoundary: true }), ctx);
      expect(line).toContain('Rohit');
    });

    it('is deterministic', () => {
      const ball = makeBall({ runs: 4, isBoundary: true });
      expect(getBallCommentary(ball, ctx)).toBe(getBallCommentary(ball, ctx));
    });
  });

  describe('six', () => {
    it('starts with SIX', () => {
      const line = getBallCommentary(makeBall({ runs: 6 }), ctx);
      expect(line).toMatch(/^SIX!/);
    });

    it('mentions batter and bowler', () => {
      const line = getBallCommentary(makeBall({ runs: 6 }), ctx);
      expect(line).toContain('Rohit');
      expect(line).toContain('Jasprit'); // firstName of "Jasprit Bumrah"
    });

    it('is deterministic', () => {
      const ball = makeBall({ runs: 6 });
      expect(getBallCommentary(ball, ctx)).toBe(getBallCommentary(ball, ctx));
    });

    it('different ball ids produce potentially different phrases', () => {
      const lines = new Set(
        ['a1', 'b2', 'c3', 'd4', 'e5', 'f6'].map(id =>
          getBallCommentary(makeBall({ runs: 6, id }), ctx)
        )
      );
      // At least 2 distinct phrases from 6 different ids
      expect(lines.size).toBeGreaterThan(1);
    });
  });

  describe('wide', () => {
    it('no additional runs → "Wide down the leg side"', () => {
      const ball = makeBall({
        isLegal: false,
        extras: [{ type: 'wide', runs: 1 }],
        runs: 0,
      });
      expect(getBallCommentary(ball, ctx)).toContain('Wide down the leg side');
    });

    it('2 additional runs → mentions run count', () => {
      const ball = makeBall({
        isLegal: false,
        extras: [{ type: 'wide', runs: 3 }],
        runs: 0,
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toMatch(/Wide!/);
      expect(line).toContain('2');
    });
  });

  describe('no ball', () => {
    it('mentions "No ball" when no runs', () => {
      const ball = makeBall({
        isLegal: false,
        extras: [{ type: 'no_ball', runs: 1 }],
        runs: 0,
      });
      expect(getBallCommentary(ball, ctx)).toMatch(/No ball/);
    });

    it('mentions runs when batter scores off a no ball', () => {
      const ball = makeBall({
        isLegal: false,
        extras: [{ type: 'no_ball', runs: 1 }],
        runs: 3,
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toContain('3');
    });
  });

  describe('byes', () => {
    it('mentions "bye"', () => {
      const ball = makeBall({ extras: [{ type: 'bye', runs: 2 }], runs: 0 });
      expect(getBallCommentary(ball, ctx).toLowerCase()).toContain('bye');
    });
  });

  describe('leg byes', () => {
    it('mentions "leg bye"', () => {
      const ball = makeBall({ extras: [{ type: 'leg_bye', runs: 1 }], runs: 0 });
      expect(getBallCommentary(ball, ctx).toLowerCase()).toContain('leg bye');
    });
  });

  describe('dismissals', () => {
    it('bowled → WICKET + batter name', () => {
      const ball = makeBall({
        dismissal: { type: 'bowled', batsmanId: 'b1', bowlerId: 'bwl1', fielderId: null },
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toMatch(/^WICKET!/);
      expect(line).toContain('Rohit');
    });

    it('caught → WICKET + fielder first name', () => {
      const ball = makeBall({
        dismissal: { type: 'caught', batsmanId: 'b1', bowlerId: 'bwl1', fielderId: 'f1' },
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toMatch(/^WICKET!/);
      expect(line).toContain('Ravindra'); // firstName of "Ravindra Jadeja"
    });

    it('lbw → WICKET + LBW mention', () => {
      const ball = makeBall({
        dismissal: { type: 'lbw', batsmanId: 'b1', bowlerId: 'bwl1', fielderId: null },
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toMatch(/^WICKET!/);
      expect(line).toContain('LBW');
    });

    it('run out → WICKET + run out mention', () => {
      const ball = makeBall({
        dismissal: { type: 'run_out', batsmanId: 'b1', bowlerId: 'bwl1', fielderId: null },
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toMatch(/^WICKET!/);
      expect(line).toMatch(/[Rr]un out/);
    });

    it('stumped → WICKET + stumped mention', () => {
      const ball = makeBall({
        dismissal: { type: 'stumped', batsmanId: 'b1', bowlerId: 'bwl1', fielderId: 'f1' },
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).toMatch(/^WICKET!/);
      expect(line).toMatch(/[Ss]tumped/);
    });

    it('retired_hurt → does NOT start with WICKET', () => {
      const ball = makeBall({
        dismissal: { type: 'retired_hurt', batsmanId: 'b1', bowlerId: 'bwl1', fielderId: null },
      });
      const line = getBallCommentary(ball, ctx);
      expect(line).not.toMatch(/^WICKET!/);
      expect(line).toMatch(/retires hurt/i);
    });
  });
});

describe('getLiveFeed', () => {
  it('returns at most `limit` items', () => {
    const balls = Array.from({ length: 10 }, (_, i) =>
      makeBall({ id: `ball-${i}`, overNumber: 0, ballInOver: i })
    );
    expect(getLiveFeed(balls, ctx, 5)).toHaveLength(5);
  });

  it('returns fewer than limit if fewer balls exist', () => {
    const balls = [makeBall(), makeBall({ id: 'ball-002' })];
    expect(getLiveFeed(balls, ctx, 5)).toHaveLength(2);
  });

  it('returns newest ball first', () => {
    const balls = [
      makeBall({ id: 'old', runs: 0 }),
      makeBall({ id: 'new', runs: 6 }),
    ];
    const feed = getLiveFeed(balls, ctx);
    expect(feed[0]).toMatch(/^SIX!/);
  });

  it('handles empty innings gracefully', () => {
    expect(getLiveFeed([], ctx)).toEqual([]);
  });
});
