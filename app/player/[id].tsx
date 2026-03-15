import { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Share, Alert } from 'react-native';
import { Text, useTheme, Chip, Button, Card, SegmentedButtons, Switch } from 'react-native-paper';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../src/store/team-store';
import { useMatchStore } from '../../src/store/match-store';
import { computePlayerStats, formatBestFigures, formatBowlingOvers } from '../../src/utils/player-stats';
import { getPlayerCode } from '../../src/utils/player-code';
import type { Match, BowlingStyle } from '../../src/engine/types';

const BOWLING_STYLES: BowlingStyle[] = [
  'none', 'Right-arm fast', 'Right-arm medium', 'Right-arm off-break',
  'Right-arm leg-break', 'Left-arm fast', 'Left-arm medium',
  'Left-arm orthodox', 'Left-arm chinaman',
];

export default function PlayerProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const updatePlayer = useTeamStore(s => s.updatePlayer);
  const matchRows = useMatchStore(s => s.matches);

  const [editing, setEditing] = useState(false);
  const [editBatStyle, setEditBatStyle] = useState('right');
  const [editBowlIndex, setEditBowlIndex] = useState(0);
  const [editIsKeeper, setEditIsKeeper] = useState(false);
  const [editIsAllRounder, setEditIsAllRounder] = useState(false);
  const [editIsCaptain, setEditIsCaptain] = useState(false);

  let player = null as (typeof teams)[0]['players'][0] | null;
  let team = null as (typeof teams)[0] | null;
  for (const t of teams) {
    const p = t.players.find(pl => pl.id === id);
    if (p) { player = p; team = t; break; }
  }

  const startEdit = () => {
    if (!player) return;
    setEditBatStyle(player.battingStyle);
    setEditBowlIndex(BOWLING_STYLES.indexOf(player.bowlingStyle) >= 0 ? BOWLING_STYLES.indexOf(player.bowlingStyle) : 0);
    setEditIsKeeper(player.isWicketKeeper);
    setEditIsAllRounder(player.isAllRounder);
    setEditIsCaptain(player.isCaptain);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!player) return;
    try {
      await updatePlayer(
        player.id, player.name, editBatStyle,
        BOWLING_STYLES[editBowlIndex],
        editIsKeeper, editIsAllRounder, editIsCaptain
      );
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    }
  };

  const stats = useMemo(() => {
    if (!player) return null;
    const completedMatches: Match[] = matchRows
      .filter(m => m.match_state_json)
      .map(m => { try { return JSON.parse(m.match_state_json!); } catch { return null; } })
      .filter((m): m is Match => m !== null && m.status === 'completed');
    return computePlayerStats(player.id, completedMatches);
  }, [player?.id, matchRows]);

  if (!player || !team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: '#1A1A1A' }}>Player not found</Text>
      </View>
    );
  }

  const playerCode = getPlayerCode(player.id);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: player.name }} />

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 16 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <Text variant="headlineSmall" style={styles.headerName}>{player.name}</Text>
          <Text style={styles.headerTeam}>{team.name}</Text>
          <View style={styles.badges}>
            {player.isCaptain && (
              <Chip compact style={{ backgroundColor: '#FFF3E0' }} textStyle={{ color: '#E65100', fontSize: 11 }}>Captain</Chip>
            )}
            {player.isWicketKeeper && (
              <Chip compact style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} textStyle={{ color: '#FFF', fontSize: 11 }}>Wicket Keeper</Chip>
            )}
            {player.isAllRounder && (
              <Chip compact style={{ backgroundColor: '#A5D6A7' }} textStyle={{ color: '#1B5E20', fontSize: 11 }}>All-Rounder</Chip>
            )}
          </View>

          {/* Player Code */}
          <View style={styles.codeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeLabel}>PLAYER CODE</Text>
              <Text style={styles.codeValue}>{playerCode}</Text>
            </View>
            <Button
              compact mode="text"
              onPress={() => Share.share({
                message: `${player!.name} — ${team!.name}\nPlayer Code: ${playerCode}\nOpen in Gully Cricket Scorer to view stats`,
              })}
              textColor="rgba(255,255,255,0.9)"
              icon="share-variant"
            >
              Share
            </Button>
          </View>
        </View>

        {/* Profile Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <Text variant="titleSmall" style={styles.cardTitle}>Profile</Text>
              {!editing ? (
                <Button compact mode="text" onPress={startEdit} icon="pencil">Edit</Button>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button compact mode="text" onPress={() => setEditing(false)}>Cancel</Button>
                  <Button compact mode="contained" onPress={saveEdit}>Save</Button>
                </View>
              )}
            </View>

            {editing ? (
              <View>
                <Text variant="bodySmall" style={styles.fieldLabel}>Batting Style</Text>
                <SegmentedButtons
                  value={editBatStyle}
                  onValueChange={setEditBatStyle}
                  buttons={[
                    { value: 'right', label: 'Right Hand' },
                    { value: 'left', label: 'Left Hand' },
                  ]}
                  style={{ marginBottom: 12 }}
                />
                <Text variant="bodySmall" style={styles.fieldLabel}>Bowling Style</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {BOWLING_STYLES.map((style, idx) => (
                    <Button
                      key={style}
                      mode={idx === editBowlIndex ? 'contained' : 'outlined'}
                      compact
                      onPress={() => setEditBowlIndex(idx)}
                      style={{ marginRight: 8, borderRadius: 16 }}
                      labelStyle={{ fontSize: 11 }}
                    >
                      {style === 'none' ? 'None' : style}
                    </Button>
                  ))}
                </ScrollView>
                <View style={styles.toggleRow}>
                  <Text variant="bodyMedium" style={{ color: '#1A1A1A' }}>Captain</Text>
                  <Switch value={editIsCaptain} onValueChange={setEditIsCaptain} />
                </View>
                <View style={styles.toggleRow}>
                  <Text variant="bodyMedium" style={{ color: '#1A1A1A' }}>Wicket Keeper</Text>
                  <Switch value={editIsKeeper} onValueChange={setEditIsKeeper} />
                </View>
                <View style={styles.toggleRow}>
                  <Text variant="bodyMedium" style={{ color: '#1A1A1A' }}>All-Rounder</Text>
                  <Switch value={editIsAllRounder} onValueChange={setEditIsAllRounder} />
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View style={styles.profileRow}>
                  <Text style={styles.fieldLabel}>BATTING</Text>
                  <Text style={styles.fieldValue}>{player.battingStyle === 'right' ? 'Right Hand' : 'Left Hand'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.fieldLabel}>BOWLING</Text>
                  <Text style={styles.fieldValue}>{player.bowlingStyle === 'none' ? 'Does not bowl' : player.bowlingStyle}</Text>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Career Stats */}
        {stats && stats.matchesPlayed > 0 ? (
          <>
            {stats.batting.innings > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleSmall" style={[styles.cardTitle, { marginBottom: 12 }]}>Batting</Text>
                  <View style={styles.statsGrid}>
                    <StatBox label="Mat" value={String(stats.matchesPlayed)} />
                    <StatBox label="Inn" value={String(stats.batting.innings)} />
                    <StatBox label="NO" value={String(stats.batting.notOuts)} />
                    <StatBox label="Runs" value={String(stats.batting.runs)} highlight />
                    <StatBox label="HS" value={String(stats.batting.highest)} />
                    <StatBox label="Avg" value={stats.batting.average.toFixed(1)} />
                    <StatBox label="SR" value={stats.batting.strikeRate.toFixed(1)} />
                    <StatBox label="50s" value={String(stats.batting.fifties)} />
                    <StatBox label="100s" value={String(stats.batting.hundreds)} />
                    <StatBox label="4s" value={String(stats.batting.fours)} />
                    <StatBox label="6s" value={String(stats.batting.sixes)} />
                  </View>
                </Card.Content>
              </Card>
            )}

            {stats.bowling.innings > 0 && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleSmall" style={[styles.cardTitle, { marginBottom: 12 }]}>Bowling</Text>
                  <View style={styles.statsGrid}>
                    <StatBox label="Mat" value={String(stats.matchesPlayed)} />
                    <StatBox label="Inn" value={String(stats.bowling.innings)} />
                    <StatBox label="Overs" value={formatBowlingOvers(stats.bowling.balls)} />
                    <StatBox label="Wkts" value={String(stats.bowling.wickets)} highlight />
                    <StatBox label="Runs" value={String(stats.bowling.runsConceded)} />
                    <StatBox label="Econ" value={stats.bowling.economy.toFixed(2)} />
                    <StatBox label="Avg" value={stats.bowling.average > 0 ? stats.bowling.average.toFixed(1) : '-'} />
                    <StatBox label="Best" value={formatBestFigures(stats.bowling)} />
                    <StatBox label="Maidens" value={String(stats.bowling.maidens)} />
                  </View>
                </Card.Content>
              </Card>
            )}
          </>
        ) : (
          <Card style={styles.card}>
            <Card.Content style={{ alignItems: 'center', padding: 24 }}>
              <Text variant="bodyMedium" style={{ color: '#888' }}>No match statistics yet</Text>
              <Text variant="bodySmall" style={{ color: '#BBB', marginTop: 4, textAlign: 'center' }}>
                Stats appear once this player has participated in completed matches
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const theme = useTheme();
  return (
    <View style={statStyles.box}>
      <Text style={[statStyles.value, highlight && { color: theme.colors.primary }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: { alignItems: 'center', minWidth: 56, padding: 8 },
  value: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  label: { fontSize: 10, color: '#888', marginTop: 2, letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 24, paddingBottom: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerName: { color: '#FFF', fontWeight: 'bold' },
  headerTeam: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  codeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, gap: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12, paddingLeft: 16, paddingRight: 4, paddingVertical: 6,
  },
  codeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  codeValue: { fontSize: 22, fontWeight: 'bold', color: '#FFF', letterSpacing: 4 },
  card: { margin: 16, marginBottom: 0, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontWeight: 'bold', color: '#1A1A1A' },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { color: '#888', letterSpacing: 0.8, fontSize: 11 },
  fieldValue: { color: '#1A1A1A', fontWeight: '500', fontSize: 14 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
});
