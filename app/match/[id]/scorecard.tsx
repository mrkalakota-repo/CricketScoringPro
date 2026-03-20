import { useState } from 'react';
import { View, StyleSheet, ScrollView, Share } from 'react-native';
import { Text, useTheme, SegmentedButtons, Divider, Surface, IconButton } from 'react-native-paper';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMatchStore } from '../../../src/store/match-store';
import { formatOvers, formatBatterScore, formatBowlerFigures, dismissalDescription } from '../../../src/utils/formatters';
import { strikeRate, economyRate } from '../../../src/utils/cricket-math';
import { buildScorecardText } from '../../../src/utils/scorecard-export';

export default function ScorecardScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const engine = useMatchStore(s => s.engine);

  const match = engine?.getMatch();
  const [selectedInningsIndex, setSelectedInningsIndex] = useState('0');

  const handleShare = async () => {
    if (!match) return;
    try {
      await Share.share({ message: buildScorecardText(match) });
    } catch { /* user cancelled */ }
  };

  if (!match || match.innings.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleMedium" style={{ color: '#999' }}>No scorecard available</Text>
      </View>
    );
  }

  const innings = match.innings[parseInt(selectedInningsIndex)] ?? match.innings[0];
  const battingTeamName = innings.battingTeamId === match.team1.id ? match.team1.name : match.team2.name;
  const bowlingTeamName = innings.bowlingTeamId === match.team1.id ? match.team1.name : match.team2.name;

  const getPlayerName = (playerId: string): string => {
    const allPlayers = [...match.team1.players, ...match.team2.players];
    return allPlayers.find(p => p.id === playerId)?.name ?? '?';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{
        title: 'Scorecard',
        headerRight: () => (
          <IconButton icon="share-variant" iconColor="#FFFFFF" size={22} onPress={handleShare} />
        ),
      }} />
      {/* Result */}
      {match.result && (
        <Surface style={[styles.resultBanner, { backgroundColor: theme.colors.primary }]} elevation={2}>
          <Text style={styles.resultText}>{match.result}</Text>
        </Surface>
      )}

      {/* Innings Selector */}
      {match.innings.length > 1 && (
        <SegmentedButtons
          value={selectedInningsIndex}
          onValueChange={setSelectedInningsIndex}
          buttons={match.innings.map((inn, i) => ({
            value: String(i),
            label: `${inn.battingTeamId === match.team1.id ? match.team1.shortName : match.team2.shortName} - ${inn.totalRuns}/${inn.totalWickets}`,
          }))}
          style={styles.inningsSelector}
        />
      )}

      {/* Score Summary */}
      <Surface style={styles.summaryCard} elevation={1}>
        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{battingTeamName} Innings</Text>
        <View style={styles.summaryRow}>
          <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
            {innings.totalRuns}/{innings.totalWickets}
          </Text>
          <Text variant="bodyMedium" style={{ color: '#666' }}>
            ({formatOvers(innings.totalOvers, innings.totalBalls)} ov)
          </Text>
        </View>
      </Surface>

      {/* Batting Card */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>Batting</Text>
        <View style={styles.headerRow}>
          <Text style={[styles.headerText, { flex: 3 }]}>Batter</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>R</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>B</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>4s</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>6s</Text>
          <Text style={[styles.headerText, { flex: 1.2, textAlign: 'center' }]}>SR</Text>
        </View>
        <Divider />
        {innings.batters.map((batter, i) => (
          <View key={batter.playerId}>
            <View style={styles.dataRow}>
              <View style={{ flex: 3 }}>
                <Text style={styles.playerNameText}>
                  {getPlayerName(batter.playerId)}
                  {!batter.dismissal ? '*' : ''}
                </Text>
                <Text style={styles.dismissalText}>
                  {batter.dismissal
                    ? `${dismissalDescription(batter.dismissal.type)}${batter.dismissal.fielderId ? ` (${getPlayerName(batter.dismissal.fielderId)})` : ''} b ${getPlayerName(batter.dismissal.bowlerId)}`
                    : 'not out'}
                </Text>
              </View>
              <Text style={[styles.dataText, { flex: 1, fontWeight: 'bold' }]}>{batter.runs}</Text>
              <Text style={[styles.dataText, { flex: 1 }]}>{batter.ballsFaced}</Text>
              <Text style={[styles.dataText, { flex: 1 }]}>{batter.fours}</Text>
              <Text style={[styles.dataText, { flex: 1 }]}>{batter.sixes}</Text>
              <Text style={[styles.dataText, { flex: 1.2 }]}>
                {strikeRate(batter.runs, batter.ballsFaced).toFixed(1)}
              </Text>
            </View>
            {i < innings.batters.length - 1 && <Divider />}
          </View>
        ))}
        <Divider style={{ marginTop: 4 }} />
        <View style={styles.extrasRow}>
          <Text style={styles.extrasLabel}>Extras</Text>
          <Text style={styles.extrasValue}>
            {innings.extras.wides + innings.extras.noBalls + innings.extras.byes + innings.extras.legByes + innings.extras.penalties}
            {' '}(w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb {innings.extras.legByes})
          </Text>
        </View>
      </Surface>

      {/* Bowling Card */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.cardTitle}>Bowling</Text>
        <View style={styles.headerRow}>
          <Text style={[styles.headerText, { flex: 3 }]}>Bowler</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>O</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>M</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>R</Text>
          <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>W</Text>
          <Text style={[styles.headerText, { flex: 1.2, textAlign: 'center' }]}>Econ</Text>
        </View>
        <Divider />
        {innings.bowlers.map((bowlerSpell, i) => (
          <View key={bowlerSpell.playerId}>
            <View style={styles.dataRow}>
              <Text style={[styles.playerNameText, { flex: 3 }]}>
                {getPlayerName(bowlerSpell.playerId)}
              </Text>
              <Text style={[styles.dataText, { flex: 1 }]}>
                {formatOvers(bowlerSpell.overs, bowlerSpell.ballsBowled)}
              </Text>
              <Text style={[styles.dataText, { flex: 1 }]}>{bowlerSpell.maidens}</Text>
              <Text style={[styles.dataText, { flex: 1 }]}>{bowlerSpell.runsConceded}</Text>
              <Text style={[styles.dataText, { flex: 1, fontWeight: 'bold' }]}>{bowlerSpell.wickets}</Text>
              <Text style={[styles.dataText, { flex: 1.2 }]}>
                {economyRate(bowlerSpell.runsConceded, bowlerSpell.overs, bowlerSpell.ballsBowled).toFixed(1)}
              </Text>
            </View>
            {i < innings.bowlers.length - 1 && <Divider />}
          </View>
        ))}
      </Surface>

      {/* Fall of Wickets */}
      {innings.fallOfWickets.length > 0 && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Fall of Wickets</Text>
          <View style={styles.fowRow}>
            {innings.fallOfWickets.map((fow, i) => (
              <Text key={i} style={styles.fowText}>
                {fow.runs}/{fow.wicketNumber} ({getPlayerName(fow.playerId)}, {formatOvers(fow.overs, fow.ballsInOver)})
                {i < innings.fallOfWickets.length - 1 ? '  ' : ''}
              </Text>
            ))}
          </View>
        </Surface>
      )}

      {/* Partnerships */}
      {innings.partnerships.length > 0 && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.cardTitle}>Partnerships</Text>
          {innings.partnerships.map((p, i) => (
            <View key={i} style={styles.partnershipRow}>
              <Text style={styles.partnershipLabel}>
                {getPlayerName(p.batter1Id)} & {getPlayerName(p.batter2Id)}
              </Text>
              <View style={styles.partnershipBarContainer}>
                <View style={[styles.partnershipBar, {
                  width: `${Math.min(100, (p.runs / Math.max(innings.totalRuns, 1)) * 100)}%`,
                  backgroundColor: theme.colors.primary,
                }]} />
              </View>
              <Text style={styles.partnershipValue}>{p.runs} ({p.balls})</Text>
            </View>
          ))}
        </Surface>
      )}
      {/* Share Button */}
      <View style={{ padding: 16, paddingBottom: 32 }}>
        <Surface style={{ borderRadius: 20, overflow: 'hidden' }} elevation={1}>
          <Text
            onPress={handleShare}
            style={{
              textAlign: 'center',
              padding: 14,
              fontWeight: '700',
              fontSize: 14,
              color: theme.colors.primary,
              letterSpacing: 0.3,
            }}
          >
            ↑  Share Scorecard
          </Text>
        </Surface>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  resultBanner: { padding: 12, alignItems: 'center' },
  resultText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  inningsSelector: { margin: 12 },
  summaryCard: { margin: 12, padding: 16, borderRadius: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  card: { margin: 12, marginTop: 0, borderRadius: 12, overflow: 'hidden' },
  cardTitle: { fontWeight: 'bold', padding: 12, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F5F5F5' },
  headerText: { fontSize: 11, color: '#666', fontWeight: '600' },
  dataRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  playerNameText: { fontSize: 13, fontWeight: '600' },
  dismissalText: { fontSize: 10, color: '#999', marginTop: 2 },
  dataText: { fontSize: 13, textAlign: 'center' },
  extrasRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  extrasLabel: { fontSize: 12, color: '#666' },
  extrasValue: { fontSize: 12, fontWeight: '600' },
  fowRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, paddingTop: 0 },
  fowText: { fontSize: 11, color: '#666' },
  partnershipRow: { paddingHorizontal: 12, paddingVertical: 6 },
  partnershipLabel: { fontSize: 11, color: '#666' },
  partnershipBarContainer: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, marginVertical: 4 },
  partnershipBar: { height: 8, borderRadius: 4 },
  partnershipValue: { fontSize: 12, fontWeight: '600' },
});
