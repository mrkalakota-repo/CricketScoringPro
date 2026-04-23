// Types for the external ball-by-ball payload (reverse-chronological input format)

export type RawDelivery = {
  ball_id: string; // "over.ball", e.g. "0.6", "1.2"
  type: 'delivery';
  commentary: string;
  runs: number;
  is_wicket: boolean;
};

export type RawOverSummary = {
  event_type: 'over_summary';
  over_number: number;
  total_runs: number;
  total_wickets: number;
  details: string;
};

export type RawFeedItem = RawDelivery | RawOverSummary;

// Structured output types (chronological)

export type ParsedDelivery = {
  type: 'delivery';
  overNumber: number; // 0-indexed, matches engine convention
  ballInOver: number; // 1-indexed as supplied in ball_id
  ballId: string;     // original "over.ball" string, e.g. "0.6"
  runs: number;
  isWicket: boolean;
  commentary: string;
};

export type ParsedOverSummary = {
  type: 'over_summary';
  overNumber: number;
  totalRuns: number;
  totalWickets: number;
  details: string;
};

export type ParsedFeedItem = ParsedDelivery | ParsedOverSummary;

/**
 * Normalises a reverse-chronological external ball-by-ball payload into typed
 * feed items while preserving the reverse-chronological sequence.
 *
 * Input:  newest item first (e.g. ball 1.2, 1.1, over_summary 0, ball 0.6 … 0.1)
 * Output: same order — ball 1.2 first, over_summary 0 as milestone, ball 0.1 last
 */
export function parseBallFeedPayload(raw: RawFeedItem[]): ParsedFeedItem[] {
  return raw.map(item => {
    if ('event_type' in item) {
      return {
        type: 'over_summary' as const,
        overNumber: item.over_number,
        totalRuns: item.total_runs,
        totalWickets: item.total_wickets,
        details: item.details,
      };
    }

    const [overStr, ballStr] = item.ball_id.split('.');
    return {
      type: 'delivery' as const,
      overNumber: parseInt(overStr, 10),
      ballInOver: parseInt(ballStr, 10),
      ballId: item.ball_id,
      runs: item.runs,
      isWicket: item.is_wicket,
      commentary: item.commentary,
    };
  });
}
