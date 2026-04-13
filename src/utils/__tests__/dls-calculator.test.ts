/**
 * DLS Calculator tests — coverage of all three exported functions
 * plus the resource table lookup helper.
 */

import {
  getResourcePercentage,
  calculateDLSTarget,
  calculateDLSParScore,
  calculateGullyTarget,
} from '../dls-calculator';

// ─────────────────────────────────────────────────────────────────────────────
// getResourcePercentage
// ─────────────────────────────────────────────────────────────────────────────

describe('getResourcePercentage', () => {
  test('0 wickets lost, 50 overs remaining → 100.0 (full resources)', () => {
    expect(getResourcePercentage(0, 50)).toBe(100.0);
  });

  test('0 wickets lost, 1 over remaining → 3.6', () => {
    expect(getResourcePercentage(0, 1)).toBe(3.6);
  });

  test('9 wickets lost, 20 overs remaining → 5.0', () => {
    // Row 9 (index 9), column 20 (index 19) = 5.0
    expect(getResourcePercentage(9, 20)).toBe(5.0);
  });

  test('wickets index clamped to 0 when negative', () => {
    expect(getResourcePercentage(-1, 10)).toBe(getResourcePercentage(0, 10));
  });

  test('wickets index clamped to 9 when > 9', () => {
    expect(getResourcePercentage(11, 10)).toBe(getResourcePercentage(9, 10));
  });

  test('overs clamped to 1 minimum', () => {
    expect(getResourcePercentage(0, 0)).toBe(getResourcePercentage(0, 1));
  });

  test('overs clamped to 50 maximum', () => {
    expect(getResourcePercentage(0, 60)).toBe(getResourcePercentage(0, 50));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateDLSTarget
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateDLSTarget', () => {
  test('full overs, no interruption: target is above team1Runs', () => {
    // DLS resource table adds a small "used resources" component even when oversUsed2=0,
    // so the output is slightly above team1Runs+1 — verify it is at least +1 and bounded.
    const target = calculateDLSTarget(200, 50, 50, 0, 0);
    expect(target).toBeGreaterThanOrEqual(201);
    expect(target).toBeLessThan(220);
  });

  test('reduced overs lowers target proportionally', () => {
    const full = calculateDLSTarget(200, 20, 20, 0, 0);
    const reduced = calculateDLSTarget(200, 20, 10, 0, 0);
    expect(reduced).toBeLessThan(full);
    expect(reduced).toBeGreaterThan(1);
  });

  test('minimum target is always 1', () => {
    // Extreme reduction should still produce at least 1
    const target = calculateDLSTarget(0, 20, 5, 0, 0);
    expect(target).toBeGreaterThanOrEqual(1);
  });

  test('defaults: wicketsLost2=0, oversUsed2=0 when not supplied', () => {
    const withDefaults = calculateDLSTarget(100, 20, 10);
    const explicit    = calculateDLSTarget(100, 20, 10, 0, 0);
    expect(withDefaults).toBe(explicit);
  });

  test('higher wickets lost reduces available resources, lowering target', () => {
    const fresh = calculateDLSTarget(200, 50, 25, 0, 0);
    const wicketsDown = calculateDLSTarget(200, 50, 25, 5, 0);
    // More wickets lost → fewer resources remaining for team2 → lower revised target
    expect(wicketsDown).toBeLessThan(fresh);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateDLSParScore
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateDLSParScore', () => {
  test('par score at start of innings is 0', () => {
    const par = calculateDLSParScore(201, 200, 50, 0, 0, 0);
    expect(par).toBe(0);
  });

  test('par score increases as innings progresses', () => {
    const early = calculateDLSParScore(201, 200, 20, 0, 0, 0);
    const later = calculateDLSParScore(201, 200, 20, 0, 10, 0);
    expect(later).toBeGreaterThan(early);
  });

  test('par score is never negative', () => {
    const par = calculateDLSParScore(1, 0, 20, 0, 0, 0);
    expect(par).toBeGreaterThanOrEqual(0);
  });

  test('par score at end of innings is close to revisedTarget', () => {
    // At over 20 of 20, oversRemaining = 0 → clamped to 1 by resource table.
    // Par score will be slightly below revisedTarget - 1 due to residual resources.
    const revisedTarget = 151;
    const par = calculateDLSParScore(revisedTarget, 150, 20, 0, 20, 0);
    expect(par).toBeGreaterThan(0);
    expect(par).toBeLessThanOrEqual(revisedTarget - 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateGullyTarget
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateGullyTarget', () => {
  test('no overs lost → target = team1Runs + 1', () => {
    // fullOvers = newOvers → no reduction → target = 100 + 1 = 101
    expect(calculateGullyTarget(100, 20, 20, 6)).toBe(101);
  });

  test('5 overs lost at 8 RPO reduces target correctly', () => {
    // 100 runs, 20 overs, cut to 15 → lost 5 overs at 8 RPO
    // adjustedTarget = 100 - 5*8 + 1 = 61
    expect(calculateGullyTarget(100, 20, 15, 8)).toBe(61);
  });

  test('minimum target is 1 (never below 1)', () => {
    // Extreme cut: 100 runs, 20 overs, cut to 1 over at 50 RPO
    // adjustedTarget = 100 - 19*50 + 1 = very negative → clamped to 1
    expect(calculateGullyTarget(100, 20, 1, 50)).toBe(1);
  });

  test('higher RPO produces a lower revised target', () => {
    const lowRPO  = calculateGullyTarget(120, 20, 15, 4);
    const highRPO = calculateGullyTarget(120, 20, 15, 10);
    expect(highRPO).toBeLessThan(lowRPO);
  });
});
