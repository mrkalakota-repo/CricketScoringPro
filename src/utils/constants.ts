export const MAX_WICKETS_PER_INNINGS = (playersPerSide: number) => playersPerSide - 1;

export const BALLS_PER_OVER = 6;

export const DISMISSALS_NOT_CREDITED_TO_BOWLER = new Set([
  'run_out',
  'retired_hurt',
  'retired_out',
  'obstructing_field',
  'timed_out',
  'handled_ball',
]);

export const DISMISSALS_INVALID_ON_FREE_HIT = new Set([
  'bowled',
  'caught',
  'lbw',
  'stumped',
  'hit_wicket',
]);
