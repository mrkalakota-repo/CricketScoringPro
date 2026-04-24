import { View, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import type { LiveMatchSummary } from '../db/repositories/cloud-match-repo';
import { formatOvers } from '../utils/formatters';

export const LIVE_RED = '#D32F2F';
const TOSS_ORANGE = '#F57C00';

export function NearbyLiveCard({ match, onPress }: { match: LiveMatchSummary; onPress?: () => void }) {
  const theme = useTheme();
  const isLive = match.status === 'in_progress';
  const isToss = match.status === 'toss';
  const isCompleted = match.status === 'completed';
  const stripeColor = isCompleted ? theme.colors.primary : isToss ? TOSS_ORANGE : LIVE_RED;
  const badgeBg = isCompleted ? theme.colors.primaryContainer : isToss ? '#FFF3E0' : '#FFEBEE';
  const badgeColor = isCompleted ? theme.colors.onPrimaryContainer : isToss ? TOSS_ORANGE : LIVE_RED;

  // Derive bowling team from batting team
  const bowlingShort = match.battingShort === match.team1Short ? match.team2Short : match.team1Short;
  const has2ndInnings = match.inningsNum >= 2 && match.target != null;

  return (
    <Card style={[styles.matchCard, (isLive || isToss) && styles.liveMatchCard]} onPress={onPress}>
      <View style={[styles.liveStripe, { backgroundColor: stripeColor }]} />
      <Card.Content style={styles.liveCardContent}>
        {/* Badge + format row */}
        <View style={styles.liveTop}>
          <View style={[styles.liveBadge, { backgroundColor: badgeBg }]}>
            {(isLive || isToss) && <View style={[styles.liveDot, { backgroundColor: stripeColor }]} />}
            <Text style={[styles.liveBadgeText, { color: badgeColor }]}>
              {isToss ? 'TOSS' : isLive ? 'LIVE' : 'RESULT'}
            </Text>
          </View>
          <Text style={[styles.formatChip, { color: theme.colors.onSurfaceVariant }]}>
            {match.format.toUpperCase()}{match.venue ? ` · ${match.venue}` : ''}
          </Text>
        </View>

        {/* Teams title */}
        <Text variant="titleMedium" style={[styles.liveTeams, { color: theme.colors.onSurface }]}>
          {match.team1Short} vs {match.team2Short}
        </Text>

        {/* Team-level scores — shown for both in-progress and completed */}
        {(isLive || isCompleted) && match.battingShort ? (
          <View style={styles.scoreBlock}>
            {has2ndInnings ? (
              <>
                <View style={styles.scoreLine}>
                  <Text style={[styles.scoreTeam, { color: theme.colors.onSurfaceVariant }]}>{bowlingShort}</Text>
                  <Text style={[styles.scoreValue, { color: theme.colors.onSurfaceVariant }]}>{match.target! - 1}</Text>
                </View>
                <View style={styles.scoreLine}>
                  <Text style={[styles.scoreTeam, { color: isLive ? LIVE_RED : theme.colors.onSurface }]}>
                    {match.battingShort}{isLive ? ' *' : ''}
                  </Text>
                  <Text style={[styles.scoreValue, { color: isLive ? LIVE_RED : theme.colors.onSurface }]}>
                    {match.score}/{match.wickets} ({formatOvers(match.overs, match.balls)} ov)
                  </Text>
                </View>
                {isLive && (
                  <Text style={[styles.chaseText, { color: theme.colors.onSurfaceVariant }]}>
                    Need {match.target! - match.score} more
                  </Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.scoreLine}>
                  <Text style={[styles.scoreTeam, { color: isLive ? LIVE_RED : theme.colors.onSurface }]}>
                    {match.battingShort}{isLive ? ' *' : ''}
                  </Text>
                  <Text style={[styles.scoreValue, { color: isLive ? LIVE_RED : theme.colors.onSurface }]}>
                    {match.score}/{match.wickets} ({formatOvers(match.overs, match.balls)} ov)
                  </Text>
                </View>
                {isLive && (
                  <View style={styles.scoreLine}>
                    <Text style={[styles.scoreTeam, { color: theme.colors.onSurfaceVariant }]}>{bowlingShort}</Text>
                    <Text style={[styles.scoreValue, { color: theme.colors.onSurfaceVariant }]}>Yet to bat</Text>
                  </View>
                )}
              </>
            )}
            {isCompleted && match.result && (
              <Text style={[styles.resultText, { color: theme.colors.primary }]}>{match.result}</Text>
            )}
          </View>
        ) : isToss ? (
          <Text style={[styles.chaseText, { color: TOSS_ORANGE }]}>Toss in progress</Text>
        ) : isCompleted && match.result ? (
          <Text style={[styles.resultText, { color: theme.colors.primary }]}>{match.result}</Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  matchCard: { marginBottom: 10, borderRadius: 14 },
  liveMatchCard: { elevation: 3, shadowColor: LIVE_RED, shadowOpacity: 0.12, shadowRadius: 6 },
  liveStripe: { height: 4, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  liveCardContent: { paddingTop: 10, gap: 2 },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  formatChip: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  liveTeams: { fontWeight: '800', fontSize: 16, marginBottom: 6 },
  scoreBlock: { gap: 2 },
  scoreLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreTeam: { fontSize: 13, fontWeight: '700', minWidth: 40 },
  scoreValue: { fontSize: 13, fontWeight: '600' },
  chaseText: { fontSize: 11, marginTop: 3 },
  resultText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
