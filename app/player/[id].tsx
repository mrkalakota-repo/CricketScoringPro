import { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Share, Image, TextInput, Pressable } from 'react-native';
import { Text, useTheme, Chip, Button, Card, SegmentedButtons, Switch } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../src/store/team-store';
import { useMatchStore } from '../../src/store/match-store';
import { computePlayerStats, formatBestFigures, formatBowlingOvers } from '../../src/utils/player-stats';
import { getPlayerCode } from '../../src/utils/player-code';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Match, BowlingStyle } from '../../src/engine/types';
import { bowlingIcon, battingIcon } from '../../src/utils/player-icons';

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
  const [editIsViceCaptain, setEditIsViceCaptain] = useState(false);
  const [editJerseyNumber, setEditJerseyNumber] = useState<string>('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

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
    setEditIsViceCaptain(player.isViceCaptain);
    setEditJerseyNumber(player.jerseyNumber !== null ? String(player.jerseyNumber) : '');
    setEditPhotoUri(player.photoUri ?? null);
    setSaveError('');
    setEditing(true);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setEditPhotoUri(result.assets[0].uri);
    }
  };

  const saveEdit = async () => {
    if (!player) return;
    setSaveError('');
    try {
      const jerseyNum = editJerseyNumber.trim() !== '' ? parseInt(editJerseyNumber, 10) : null;
      await updatePlayer(
        player.id, player.name, player.phoneNumber ?? null, editBatStyle,
        BOWLING_STYLES[editBowlIndex],
        editIsKeeper, editIsAllRounder, editIsCaptain, editIsViceCaptain,
        isNaN(jerseyNum as number) ? null : jerseyNum,
        editPhotoUri,
      );
      setEditing(false);
    } catch {
      setSaveError('Could not save changes. Please try again.');
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
        <MaterialCommunityIcons name="account-off-outline" size={48} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Player not found</Text>
      </View>
    );
  }

  const playerCode = getPlayerCode(player.id);
  const batIconInfo = battingIcon(player.battingStyle);
  const bowlIconInfo = bowlingIcon(player.bowlingStyle);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: player.name }} />

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 8) + 16 }}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          {player.photoUri ? (
            <Image source={{ uri: player.photoUri }} style={styles.headerPhoto} />
          ) : null}
          <Text variant="headlineSmall" style={styles.headerName}>
            {player.jerseyNumber !== null ? `#${player.jerseyNumber}  ` : ''}{player.name}
          </Text>
          <Text style={styles.headerTeam}>{team.name}</Text>
          <View style={styles.badges}>
            {player.isCaptain && (
              <Chip compact icon="crown" style={{ backgroundColor: '#FFF3E0' }} textStyle={{ color: '#E65100', fontSize: 11 }}>Captain</Chip>
            )}
            {player.isViceCaptain && (
              <Chip compact icon="crown-outline" style={{ backgroundColor: '#FFF8E1' }} textStyle={{ color: '#F9A825', fontSize: 11 }}>Vice Captain</Chip>
            )}
            {player.isWicketKeeper && (
              <Chip compact icon="shield-account" style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 0 }} textStyle={{ color: '#1B6B28', fontSize: 11, fontWeight: '700' }}>Wicket Keeper</Chip>
            )}
            {player.isAllRounder && (
              <Chip compact icon="star-four-points" style={{ backgroundColor: '#A5D6A7' }} textStyle={{ color: '#1B5E20', fontSize: 11 }}>All-Rounder</Chip>
            )}
          </View>

          {/* Skill chips */}
          <View style={styles.skillRow}>
            <View style={[styles.skillChip, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
              <MaterialCommunityIcons name={batIconInfo.icon} size={14} color="#FFFFFF" />
              <Text style={styles.skillText}>
                {player.battingStyle === 'right' ? 'Right-hand bat' : 'Left-hand bat'}
              </Text>
            </View>
            <View style={[styles.skillChip, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
              <MaterialCommunityIcons name={bowlIconInfo.icon} size={14} color="#FFFFFF" />
              <Text style={styles.skillText}>
                {player.bowlingStyle === 'none' ? 'Does not bowl' : player.bowlingStyle}
              </Text>
            </View>
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
              <Text variant="titleSmall" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Profile</Text>
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
                {/* Photo + Jersey row */}
                <View style={styles.photoJerseyRow}>
                  <Pressable onPress={pickPhoto} style={styles.photoPickerButton}>
                    {editPhotoUri ? (
                      <Image source={{ uri: editPhotoUri }} style={styles.photoPreview} />
                    ) : (
                      <View style={[styles.photoPreview, { backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }]}>
                        <MaterialCommunityIcons name="camera-plus-outline" size={24} color={theme.colors.onSurfaceVariant} />
                      </View>
                    )}
                    <Text variant="labelSmall" style={{ color: theme.colors.primary, marginTop: 4 }}>
                      {editPhotoUri ? 'Change' : 'Add Photo'}
                    </Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySmall" style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant, marginBottom: 6 }]}>Jersey #</Text>
                    <TextInput
                      value={editJerseyNumber}
                      onChangeText={t => setEditJerseyNumber(t.replace(/[^0-9]/g, '').slice(0, 3))}
                      keyboardType="number-pad"
                      placeholder="—"
                      maxLength={3}
                      style={[styles.jerseyInput, { borderColor: theme.colors.outlineVariant, color: theme.colors.onSurface }]}
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                    />
                  </View>
                </View>
                <Text variant="bodySmall" style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>Batting Style</Text>
                <SegmentedButtons
                  value={editBatStyle}
                  onValueChange={setEditBatStyle}
                  buttons={[
                    { value: 'right', label: 'Right Hand', icon: 'alpha-r-circle' },
                    { value: 'left', label: 'Left Hand', icon: 'alpha-l-circle' },
                  ]}
                  style={{ marginBottom: 12 }}
                />
                <Text variant="bodySmall" style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>Bowling Style</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {BOWLING_STYLES.map((style, idx) => {
                    const bIcon = bowlingIcon(style);
                    return (
                      <Button
                        key={style}
                        mode={idx === editBowlIndex ? 'contained' : 'outlined'}
                        compact
                        icon={bIcon.icon}
                        onPress={() => setEditBowlIndex(idx)}
                        style={{ marginRight: 8, borderRadius: 16 }}
                        labelStyle={{ fontSize: 11 }}
                      >
                        {style === 'none' ? 'None' : style.split(' ').slice(-1)[0]}
                      </Button>
                    );
                  })}
                </ScrollView>
                <View style={styles.toggleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="crown" size={16} color={theme.colors.secondary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Captain</Text>
                  </View>
                  <Switch value={editIsCaptain} onValueChange={setEditIsCaptain} />
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="crown-outline" size={16} color="#F9A825" />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Vice Captain</Text>
                  </View>
                  <Switch value={editIsViceCaptain} onValueChange={setEditIsViceCaptain} />
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="shield-account" size={16} color={theme.colors.primary} />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Wicket Keeper</Text>
                  </View>
                  <Switch value={editIsKeeper} onValueChange={setEditIsKeeper} />
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="star-four-points" size={16} color="#6A1B9A" />
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>All-Rounder</Text>
                  </View>
                  <Switch value={editIsAllRounder} onValueChange={setEditIsAllRounder} />
                </View>
                {!!saveError && (
                  <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>{saveError}</Text>
                )}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View style={styles.profileRow}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>BATTING</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name={batIconInfo.icon} size={16} color={batIconInfo.color} />
                    <Text style={[styles.fieldValue, { color: theme.colors.onSurface }]}>
                      {player.battingStyle === 'right' ? 'Right Hand' : 'Left Hand'}
                    </Text>
                  </View>
                </View>
                <View style={styles.profileRow}>
                  <Text style={[styles.fieldLabel, { color: theme.colors.onSurfaceVariant }]}>BOWLING</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name={bowlIconInfo.icon} size={16} color={bowlIconInfo.color} />
                    <Text style={[styles.fieldValue, { color: theme.colors.onSurface }]}>
                      {player.bowlingStyle === 'none' ? 'Does not bowl' : player.bowlingStyle}
                    </Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <MaterialCommunityIcons name="cricket" size={18} color={theme.colors.primary} />
                    <Text variant="titleSmall" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Batting</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <MaterialCommunityIcons name={bowlIconInfo.icon} size={18} color={bowlIconInfo.color} />
                    <Text variant="titleSmall" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Bowling</Text>
                  </View>
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
              <MaterialCommunityIcons name="chart-bar" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                No match statistics yet
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
                Stats appear once this player participates in completed matches
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
      <Text style={[statStyles.value, { color: highlight ? theme.colors.primary : theme.colors.onSurface }]}>{value}</Text>
      <Text style={[statStyles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: { alignItems: 'center', minWidth: 56, padding: 8 },
  value: { fontSize: 18, fontWeight: 'bold' },
  label: { fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
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
  headerName: { color: '#FFFFFF', fontWeight: 'bold' },
  headerTeam: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  skillRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  skillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  codeRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 16, gap: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12, paddingLeft: 16, paddingRight: 4, paddingVertical: 6,
  },
  codeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  codeValue: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', letterSpacing: 4 },
  card: { margin: 16, marginBottom: 0, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontWeight: 'bold' },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { letterSpacing: 0.8, fontSize: 11, fontWeight: '600' },
  fieldValue: { fontWeight: '500', fontSize: 14 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  // Photo & jersey edit
  headerPhoto: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  photoJerseyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  photoPickerButton: { alignItems: 'center' },
  photoPreview: { width: 64, height: 64, borderRadius: 32 },
  jerseyInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 20, fontWeight: 'bold',
    width: 80,
  },
});
