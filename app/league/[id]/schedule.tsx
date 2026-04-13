import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput, Button, Card, useTheme, SegmentedButtons, Portal, Dialog, Divider } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLeagueStore } from '../../../src/store/league-store';
import { useTeamStore } from '../../../src/store/team-store';
import { usePrefsStore } from '../../../src/store/prefs-store';
import type { LeagueFixture, FixtureNRRData } from '../../../src/engine/types';
import { Switch } from 'react-native-paper';

type Mode = 'add' | 'roundrobin' | 'result';

export default function ScheduleScreen() {
  const { id, fixtureId } = useLocalSearchParams<{ id: string; fixtureId?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leagues, fixtures: allFixtures, createFixture, updateFixtureResult, deleteFixture, generateRoundRobin, generateKnockout, loadFixtures } = useLeagueStore();
  const teams = useTeamStore(s => s.teams);
  const myLeagueIds = usePrefsStore(s => s.myLeagueIds);

  const league = leagues.find(l => l.id === id);
  const isOwner = league ? myLeagueIds.includes(league.id) : false;
  const fixtures = allFixtures[id ?? ''] ?? [];
  const editFixture: LeagueFixture | null = fixtureId ? (fixtures.find(f => f.id === fixtureId) ?? null) : null;

  const [mode, setMode] = useState<Mode>(editFixture ? 'result' : 'add');

  // Add fixture form
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [venue, setVenue] = useState('');
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Round robin form
  const [rrStartDate, setRrStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rrDays, setRrDays] = useState('7');
  const [rrVenue, setRrVenue] = useState('');

  // Result form
  const [result, setResult] = useState(editFixture?.result ?? '');
  const [winnerTeamId, setWinnerTeamId] = useState(editFixture?.winnerTeamId ?? '');
  const [t1Score, setT1Score] = useState(editFixture?.team1Score ?? '');
  const [t2Score, setT2Score] = useState(editFixture?.team2Score ?? '');

  // NRR form
  const existing = editFixture?.nrrData ?? null;
  const [nrrT1Runs, setNrrT1Runs] = useState(existing ? String(existing.team1Runs) : '');
  const [nrrT1Overs, setNrrT1Overs] = useState(existing ? String(existing.team1OversRaw) : '');
  const [nrrT1AllOut, setNrrT1AllOut] = useState(existing?.team1AllOut ?? false);
  const [nrrT2Runs, setNrrT2Runs] = useState(existing ? String(existing.team2Runs) : '');
  const [nrrT2Overs, setNrrT2Overs] = useState(existing ? String(existing.team2OversRaw) : '');
  const [nrrT2AllOut, setNrrT2AllOut] = useState(existing?.team2AllOut ?? false);
  const [nrrMaxOvers, setNrrMaxOvers] = useState(existing ? String(existing.maxOvers) : '20');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => { if (id) loadFixtures(id); }, [id]);

  if (!league) {
    return <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Schedule' }} />
      <Text style={{ padding: 16, color: theme.colors.onSurface }}>League not found</Text>
    </View>;
  }

  if (!isOwner && !fixtureId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Schedule' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <MaterialCommunityIcons name="lock-outline" size={40} color={theme.colors.outlineVariant} />
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
            Only the league owner can manage the schedule.
          </Text>
        </View>
      </View>
    );
  }

  const leagueTeams = teams.filter(t => league.teamIds.includes(t.id));
  const getTeamName = (tid: string) => teams.find(t => t.id === tid)?.name ?? '???';

  const handleAddFixture = async () => {
    if (!team1Id || !team2Id) { setError('Select both teams'); return; }
    if (team1Id === team2Id) { setError('Teams must be different'); return; }
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) { setError('Invalid date'); return; }
    setSaving(true);
    try {
      await createFixture(id!, team1Id, team2Id, venue.trim(), d);
      setError('');
      router.back();
    } catch { setError('Could not save fixture. Check your connection and try again.'); setSaving(false); }
  };

  const handleRoundRobin = async () => {
    if (leagueTeams.length < 2) { setError('Need at least 2 teams in the league'); return; }
    const d = new Date(rrStartDate).getTime();
    if (isNaN(d)) { setError('Invalid start date'); return; }
    const days = parseInt(rrDays, 10);
    if (!days || days < 1) { setError('Days apart must be ≥ 1'); return; }
    setSaving(true);
    try {
      await generateRoundRobin(id!, d, days, rrVenue.trim());
      router.back();
    } catch { setError('Could not generate schedule. Check your connection and try again.'); setSaving(false); }
  };

  const handleKnockout = async () => {
    if (leagueTeams.length < 2) { setError('Need at least 2 teams in the league'); return; }
    const d = new Date(rrStartDate).getTime();
    if (isNaN(d)) { setError('Invalid start date'); return; }
    const days = parseInt(rrDays, 10);
    if (!days || days < 1) { setError('Days apart must be ≥ 1'); return; }
    setSaving(true);
    try {
      await generateKnockout(id!, d, days, rrVenue.trim());
      router.back();
    } catch { setError('Could not generate bracket. Check your connection and try again.'); setSaving(false); }
  };

  const handleSaveResult = async () => {
    if (!editFixture) return;
    setSaving(true);
    try {
      // Build NRR data if all required fields are filled
      let nrrData: FixtureNRRData | null = null;
      const r1 = parseInt(nrrT1Runs, 10);
      const o1 = parseFloat(nrrT1Overs);
      const r2 = parseInt(nrrT2Runs, 10);
      const o2 = parseFloat(nrrT2Overs);
      const maxOv = parseFloat(nrrMaxOvers);
      if (!isNaN(r1) && !isNaN(o1) && !isNaN(r2) && !isNaN(o2) && !isNaN(maxOv) && maxOv > 0) {
        nrrData = {
          team1Runs: r1, team1OversRaw: o1, team1AllOut: nrrT1AllOut,
          team2Runs: r2, team2OversRaw: o2, team2AllOut: nrrT2AllOut,
          maxOvers: maxOv,
        };
      }
      await updateFixtureResult(editFixture.id, result, winnerTeamId || null, t1Score || null, t2Score || null, nrrData);
      router.back();
    } catch { setError('Could not save result. Check your connection and try again.'); setSaving(false); }
  };

  const handleDeleteFixture = async () => {
    if (!editFixture) return;
    setShowDeleteDialog(false);
    await deleteFixture(editFixture.id, id!);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: editFixture ? 'Edit Fixture' : 'Schedule' }} />

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Fixture</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Remove this fixture from the schedule?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleDeleteFixture}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        {!editFixture && (
          <SegmentedButtons
            value={mode}
            onValueChange={v => { setMode(v as Mode); setError(''); }}
            buttons={[
              { value: 'add', label: 'Add Fixture', icon: 'plus' },
              {
                value: 'roundrobin',
                label: league.format === 'knockout' ? 'Knockout' : 'Round Robin',
                icon: league.format === 'knockout' ? 'tournament' : 'autorenew',
              },
            ]}
            style={styles.segmented}
          />
        )}

        {/* ─── Add Fixture ─── */}
        {mode === 'add' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>New Fixture</Text>

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Team 1</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {leagueTeams.map(t => (
                  <Button key={t.id} mode={team1Id === t.id ? 'contained' : 'outlined'} compact
                    onPress={() => setTeam1Id(t.id)} style={styles.teamBtn} labelStyle={{ fontSize: 12 }}>
                    {t.shortName}
                  </Button>
                ))}
              </ScrollView>

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Team 2</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {leagueTeams.map(t => (
                  <Button key={t.id} mode={team2Id === t.id ? 'contained' : 'outlined'} compact
                    onPress={() => setTeam2Id(t.id)} style={styles.teamBtn} labelStyle={{ fontSize: 12 }}>
                    {t.shortName}
                  </Button>
                ))}
              </ScrollView>

              <TextInput label="Venue (optional)" value={venue} onChangeText={setVenue} mode="outlined" style={styles.input} />
              <TextInput label="Date (YYYY-MM-DD)" value={dateStr} onChangeText={setDateStr} mode="outlined" style={styles.input} keyboardType="numbers-and-punctuation" />

              {!!error && <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>}
              <Button mode="contained" onPress={handleAddFixture} loading={saving} disabled={saving} style={styles.button}>
                Add Fixture
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* ─── Round Robin / Knockout Generate ─── */}
        {mode === 'roundrobin' && (
          <Card style={styles.card}>
            <Card.Content>
              {league.format === 'knockout' ? (
                <>
                  <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Generate Knockout Bracket</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                    Creates {Math.floor(leagueTeams.length / 2)} Round 1 match{leagueTeams.length > 2 ? 'es' : ''} for {leagueTeams.length} teams.
                    Winners auto-advance each round.
                    {leagueTeams.length % 2 === 1 ? ' One team receives a bye.' : ''}
                  </Text>
                </>
              ) : (
                <>
                  <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>Generate Round Robin</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                    Creates {Math.max(0, leagueTeams.length * (leagueTeams.length - 1) / 2)} fixtures for {leagueTeams.length} teams ({leagueTeams.map(t => t.shortName).join(', ')})
                  </Text>
                </>
              )}
              <TextInput label="Start Date (YYYY-MM-DD)" value={rrStartDate} onChangeText={setRrStartDate} mode="outlined" style={styles.input} keyboardType="numbers-and-punctuation" />
              <TextInput label="Days between matches" value={rrDays} onChangeText={setRrDays} mode="outlined" style={styles.input} keyboardType="numeric" />
              <TextInput label="Default Venue (optional)" value={rrVenue} onChangeText={setRrVenue} mode="outlined" style={styles.input} />

              {!!error && <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>}
              <Button
                mode="contained"
                icon={league.format === 'knockout' ? 'tournament' : 'autorenew'}
                onPress={league.format === 'knockout' ? handleKnockout : handleRoundRobin}
                loading={saving}
                disabled={saving || leagueTeams.length < 2}
                style={styles.button}
              >
                {league.format === 'knockout' ? 'Generate Bracket' : 'Generate Schedule'}
              </Button>
              {leagueTeams.length < 2 && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' }}>
                  Add at least 2 teams to the league first
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {/* ─── Enter / Override Result ─── */}
        {mode === 'result' && editFixture && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.matchupRow}>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>{getTeamName(editFixture.team1Id)}</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>vs</Text>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>{getTeamName(editFixture.team2Id)}</Text>
              </View>
              <Divider style={{ marginVertical: 12 }} />

              {/* Read-only view for non-league-admins on a completed fixture */}
              {editFixture.status === 'completed' && !isOwner && (
                <>
                  <View style={[styles.readOnlyBanner, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="lock-outline" size={16} color={theme.colors.onSurfaceVariant} />
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
                      This result is final. Contact your League Admin to dispute or override.
                    </Text>
                  </View>
                  {editFixture.team1Score ? <Text variant="bodyMedium" style={styles.readOnlyRow}>{getTeamName(editFixture.team1Id)}: {editFixture.team1Score}</Text> : null}
                  {editFixture.team2Score ? <Text variant="bodyMedium" style={styles.readOnlyRow}>{getTeamName(editFixture.team2Id)}: {editFixture.team2Score}</Text> : null}
                  {editFixture.result ? <Text variant="bodyMedium" style={[styles.readOnlyRow, { color: theme.colors.primary, fontWeight: '700' }]}>{editFixture.result}</Text> : null}
                </>
              )}

              {/* Override warning banner for league_admin on completed fixture */}
              {editFixture.status === 'completed' && isOwner && (
                <View style={[styles.overrideBanner, { backgroundColor: '#FFF3E0', borderColor: '#E65100' }]}>
                  <MaterialCommunityIcons name="alert-outline" size={16} color="#E65100" />
                  <Text variant="bodySmall" style={{ color: '#E65100', flex: 1, fontWeight: '600' }}>
                    Dispute Override — you are modifying a completed result as League Admin.
                  </Text>
                </View>
              )}

              {/* Editable form — shown for scheduled fixtures OR for league_admin on completed */}
              {(editFixture.status !== 'completed' || isOwner) && (
                <>

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{getTeamName(editFixture.team1Id)} Score</Text>
              <TextInput value={t1Score} onChangeText={setT1Score} placeholder="e.g. 145/6 (20)" mode="outlined" style={styles.input} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{getTeamName(editFixture.team2Id)} Score</Text>
              <TextInput value={t2Score} onChangeText={setT2Score} placeholder="e.g. 140/8 (20)" mode="outlined" style={styles.input} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Result</Text>
              <TextInput value={result} onChangeText={setResult} placeholder="e.g. Team A won by 5 runs" mode="outlined" style={styles.input} />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Winner</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[editFixture.team1Id, editFixture.team2Id].map((tid, i) => (
                  <Button key={`${tid}-${i}`} mode={winnerTeamId === tid ? 'contained' : 'outlined'} compact
                    onPress={() => setWinnerTeamId(tid)} style={{ flex: 1 }}>
                    {getTeamName(tid)}
                  </Button>
                ))}
                <Button mode={!winnerTeamId ? 'contained' : 'outlined'} compact onPress={() => setWinnerTeamId('')} style={{ flex: 1 }}>
                  Tie / NR
                </Button>
              </View>

              <Divider style={{ marginVertical: 8 }} />
              <Text variant="labelLarge" style={[styles.label, { color: theme.colors.primary, marginBottom: 8 }]}>NRR Data (optional)</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 10 }}>
                Fill in to enable Net Run Rate in standings. Overs in cricket format (e.g. 18.3 = 18 overs 3 balls).
              </Text>
              <TextInput label="Max overs per side" value={nrrMaxOvers} onChangeText={setNrrMaxOvers}
                mode="outlined" style={styles.input} keyboardType="numeric" />

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{getTeamName(editFixture.team1Id)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                <TextInput label="Runs" value={nrrT1Runs} onChangeText={setNrrT1Runs}
                  mode="outlined" style={{ flex: 1 }} keyboardType="numeric" />
                <TextInput label="Overs (e.g. 18.3)" value={nrrT1Overs} onChangeText={setNrrT1Overs}
                  mode="outlined" style={{ flex: 1 }} keyboardType="decimal-pad" />
              </View>
              <View style={[styles.switchRow, { marginBottom: 12 }]}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>All out</Text>
                <Switch value={nrrT1AllOut} onValueChange={setNrrT1AllOut} />
              </View>

              <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{getTeamName(editFixture.team2Id)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                <TextInput label="Runs" value={nrrT2Runs} onChangeText={setNrrT2Runs}
                  mode="outlined" style={{ flex: 1 }} keyboardType="numeric" />
                <TextInput label="Overs (e.g. 16.2)" value={nrrT2Overs} onChangeText={setNrrT2Overs}
                  mode="outlined" style={{ flex: 1 }} keyboardType="decimal-pad" />
              </View>
              <View style={[styles.switchRow, { marginBottom: 12 }]}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>All out</Text>
                <Switch value={nrrT2AllOut} onValueChange={setNrrT2AllOut} />
              </View>

              {!!error && <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>}
              <Button mode="contained" onPress={handleSaveResult} loading={saving} disabled={saving} style={styles.button}
                buttonColor={editFixture.status === 'completed' ? '#E65100' : undefined}>
                {editFixture.status === 'completed' ? 'Override Result' : 'Save Result'}
              </Button>
              <Button mode="text" textColor={theme.colors.error} icon="delete-outline" onPress={() => setShowDeleteDialog(true)} style={{ marginTop: 4 }}>
                Delete Fixture
              </Button>
              </>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  segmented: { marginBottom: 16 },
  card: { borderRadius: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  label: { marginBottom: 4, fontWeight: '600' },
  input: { marginBottom: 12 },
  teamBtn: { marginRight: 8, borderRadius: 16 },
  button: { borderRadius: 20, marginTop: 4 },
  matchupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  readOnlyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, marginBottom: 12 },
  readOnlyRow: { marginBottom: 6, paddingHorizontal: 4 },
  overrideBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
});
