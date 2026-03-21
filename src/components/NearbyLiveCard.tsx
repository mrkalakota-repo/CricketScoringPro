import { View, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import type { LiveMatchSummary } from '../db/repositories/cloud-match-repo';

export const LIVE_RED = '#D32F2F';

function formatOvers(overs: number, balls: number): string {
  return `${overs}.${balls}`;
}

export function NearbyLiveCard({ match, onPress }: { match: LiveMatchSummary; onPress?: () => void }) {
  const theme = useTheme();
  const isLive = match.status === 'in_progress' || match.status === 'toss';
  const stripeColor = match.status === 'completed' ? theme.colors.primary : LIVE_RED;

  return (
    <Card style={[styles.matchCard, isLive && styles.liveMatchCard]} onPress={onPress}>
      <View style={[styles.liveStripe, { backgroundColor: stripeColor }]} />
      <Card.Content style={styles.liveCardContent}>
        <View style={styles.liveTop}>
          <View style={[styles.liveBadge, { backgroundColor: isLive ? '#FFEBEE' : theme.colors.primaryContainer }]}>
            {isLive && <View style={[styles.liveDot, { backgroundColor: stripeColor }]} />}
            <Text style={[styles.liveBadgeText, { color: isLive ? LIVE_RED : theme.colors.onPrimaryContainer }]}>
              {match.status === 'toss' ? 'TOSS' : match.status === 'in_progress' ? 'LIVE' : 'RESULT'}
            </Text>
          </View>
          <Text style={[styles.formatChip, { color: theme.colors.onSurfaceVariant }]}>
            {match.format.toUpperCase()} · {match.venue || 'Unknown venue'}
          </Text>
        </View>
        <Text variant="titleMedium" style={[styles.liveTeams, { color: theme.colors.onSurface }]}>
          {match.team1Short} vs {match.team2Short}
        </Text>
        {match.status === 'completed' && match.result ? (
          <Text variant="bodyMedium" style={[styles.liveScore, { color: theme.colors.primary }]}>
            {match.result}
          </Text>
        ) : match.status === 'in_progress' && match.battingShort ? (
          <Text variant="bodyMedium" style={[styles.liveScore, { color: LIVE_RED }]}>
            {match.battingShort}: {match.score}/{match.wickets} ({formatOvers(match.overs, match.balls)} ov)
            {match.target ? `  •  Target: ${match.target}` : ''}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  matchCard: { marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  liveMatchCard: { elevation: 3, shadowColor: LIVE_RED, shadowOpacity: 0.12, shadowRadius: 6 },
  liveStripe: { height: 4 },
  liveCardContent: { paddingTop: 10 },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  formatChip: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  liveTeams: { fontWeight: '800', fontSize: 16 },
  liveScore: { fontWeight: '700', marginTop: 4, fontSize: 14 },
});
