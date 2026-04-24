import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, TextInput, RadioButton, Checkbox, Divider, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTeamStore } from '../../src/store/team-store';
import { useMatchStore } from '../../src/store/match-store';
import { useRole } from '../../src/hooks/useRole';
import { FORMAT_CONFIGS } from '../../src/engine/types';
import type { MatchFormat, MatchConfig } from '../../src/engine/types';
import { createNewMatch } from '../../src/engine/match-engine';
import * as matchRepo from '../../src/db/repositories/match-repo';
import * as Crypto from 'expo-crypto';
const uuidv4 = () => Crypto.randomUUID();

type Step = 'format' | 'teams' | 'playing_xi' | 'venue' | 'confirm';

const MIN_PLAYERS = 6;

export default function CreateMatchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const teams = useTeamStore(s => s.teams);
  const { createAndStartMatch, loadMatches } = useMatchStore();
  const { canCreateMatch } = useRole();

  if (!canCreateMatch) {
    return (
      <View style={styles.unauthorized}>
        <MaterialCommunityIcons name="lock-outline" size={48} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={[styles.unauthorizedTitle, { color: theme.colors.onSurface }]}>
          Not Authorised
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          Only Team Admins and League Admins can create matches.
        </Text>
        <Button mode="outlined" icon="arrow-left" onPress={() => router.back()} style={{ marginTop: 20 }}>
          Go Back
        </Button>
      </View>
    );
  }

  const [step, setStep] = useState<Step>('format');
  const [format, setFormat] = useState<MatchFormat>('t20');
  const [customOvers, setCustomOvers] = useState('20');
  const [team1Id, setTeam1Id] = useState<string | null>(null);
  const [team2Id, setTeam2Id] = useState<string | null>(null);
  const [team1XI, setTeam1XI] = useState<Set<string>>(new Set());
  const [team2XI, setTeam2XI] = useState<Set<string>>(new Set());
  const [venue, setVenue] = useState('');

  const team1 = teams.find(t => t.id === team1Id);
  const team2 = teams.find(t => t.id === team2Id);

  const togglePlayer = (playerId: string, teamSet: Set<string>, setTeamSet: (s: Set<string>) => void) => {
    const newSet = new Set(teamSet);
    if (newSet.has(playerId)) {
      newSet.delete(playerId);
    } else {
      newSet.add(playerId);
    }
    setTeamSet(newSet);
  };

  const handleCreate = async () => {
    if (!team1 || !team2) return;

    const playersPerSide = format === 'custom'
      ? Math.max(team1XI.size, team2XI.size)
      : FORMAT_CONFIGS[format].playersPerSide;
    const config: MatchConfig = format === 'custom'
      ? {
          format: 'custom',
          oversPerInnings: parseInt(customOvers) || 20,
          maxInnings: 2,
          playersPerSide,
          powerplays: [],
          followOnMinimum: null,
          wideRuns: 1,
          noBallRuns: 1,
        }
      : { format, ...FORMAT_CONFIGS[format], playersPerSide };

    const matchId = uuidv4();
    const now = Date.now();
    const match = createNewMatch(
      matchId,
      config,
      team1,
      team2,
      Array.from(team1XI),
      Array.from(team2XI),
      venue.trim() || 'Unknown Venue',
      now
    );

    await matchRepo.createMatch(
      matchId, config, team1.id, team2.id,
      Array.from(team1XI), Array.from(team2XI),
      venue.trim() || 'Unknown Venue', now
    );
    await matchRepo.saveMatchState(matchId, match);

    createAndStartMatch(match);
    await loadMatches();
    router.replace(`/match/${matchId}/toss`);
  };

  const team1HasEnough = (team1?.players.length ?? 0) >= MIN_PLAYERS;
  const team2HasEnough = (team2?.players.length ?? 0) >= MIN_PLAYERS;
  const canProceedTeams = team1Id && team2Id && team1Id !== team2Id && team1HasEnough && team2HasEnough;
  // Standard formats require exactly 11 players per side; custom format requires at least MIN_PLAYERS
  const requiredXI = format === 'custom' ? null : 11;
  const canProceedXI = requiredXI === null
    ? (team1XI.size >= MIN_PLAYERS && team2XI.size >= MIN_PLAYERS)
    : (team1XI.size === requiredXI && team2XI.size === requiredXI);

  const STEP_ORDER: Step[] = ['format', 'teams', 'playing_xi', 'venue', 'confirm'];
  const STEP_TITLES: Record<Step, string> = {
    format: 'Select Format',
    teams: 'Select Teams',
    playing_xi: 'Playing XI',
    venue: 'Match Details',
    confirm: 'Confirm Match',
  };
  const stepBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) {
      setStep(STEP_ORDER[idx - 1]);
    } else {
      router.back();
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
      <Stack.Screen
        options={{
          title: STEP_TITLES[step],
          headerLeft: () => (
            <IconButton
              icon="arrow-left"
              iconColor="#FFFFFF"
              size={24}
              onPress={stepBack}
              style={{ marginLeft: -4 }}
            />
          ),
        }}
      />
      {/* Progress Indicator */}
      <View style={styles.progress}>
        {(['format', 'teams', 'playing_xi', 'venue', 'confirm'] as Step[]).map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View style={[
              styles.progressDot,
              { backgroundColor: step === s ? theme.colors.primary : '#DDD' }
            ]} />
            <Text variant="labelSmall" style={{ color: step === s ? theme.colors.primary : '#999', fontSize: 9 }}>
              {['Format', 'Teams', 'XI', 'Venue', 'Confirm'][i]}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.content}>
        {/* Step 1: Format */}
        {step === 'format' && (
          <>
            <Text variant="titleLarge" style={styles.stepTitle}>Select Format</Text>
            {(['t20', 'odi', 'test', 'custom'] as MatchFormat[]).map(f => (
              <Card
                key={f}
                testID={`match-format-${f}`}
                style={[styles.optionCard, format === f && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                onPress={() => setFormat(f)}
              >
                <Card.Content>
                  <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                    {f === 't20' ? 'T20' : f === 'odi' ? 'ODI (50 overs)' : f === 'test' ? 'Test Match' : 'Custom'}
                  </Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>
                    {f === 't20' ? '20 overs per side' : f === 'odi' ? '50 overs per side' : f === 'test' ? 'Unlimited overs, 4 innings' : 'Set your own rules'}
                  </Text>
                </Card.Content>
              </Card>
            ))}
            {format === 'custom' && (
              <TextInput
                label="Overs per innings"
                value={customOvers}
                onChangeText={setCustomOvers}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginTop: 8 }}
                testID="match-format-custom-overs-input"
              />
            )}
            <Button mode="contained" onPress={() => setStep('teams')} style={styles.nextButton} testID="match-format-next-btn">
              Next
            </Button>
          </>
        )}

        {/* Step 2: Teams */}
        {step === 'teams' && (
          <>
            <Text variant="titleLarge" style={styles.stepTitle}>Select Teams</Text>
            {teams.length < 2 ? (
              <View style={styles.emptyState}>
                <Text variant="bodyMedium" style={{ color: '#999' }}>
                  You need at least 2 teams to create a match
                </Text>
                <Button mode="contained" onPress={() => router.push('/team/create')} style={{ marginTop: 12 }}>
                  Create Team
                </Button>
              </View>
            ) : (
              <>
                <Text variant="titleSmall" style={{ marginBottom: 8 }}>Team 1</Text>
                {teams.map(t => {
                  const tooFew = t.players.length < MIN_PLAYERS;
                  return (
                    <Card
                      key={`t1-${t.id}`}
                      style={[
                        styles.optionCard,
                        team1Id === t.id && { borderColor: tooFew ? theme.colors.error : theme.colors.primary, borderWidth: 2 },
                      ]}
                      onPress={() => { setTeam1Id(t.id); if (t.id === team2Id) setTeam2Id(null); }}
                    >
                      <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <RadioButton
                          value={t.id}
                          status={team1Id === t.id ? 'checked' : 'unchecked'}
                          onPress={() => { setTeam1Id(t.id); if (t.id === team2Id) setTeam2Id(null); }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text variant="titleSmall">{t.name} ({t.shortName})</Text>
                          <Text variant="bodySmall" style={{ color: tooFew ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                            {t.players.length} players{tooFew ? ` — needs at least ${MIN_PLAYERS}` : ''}
                          </Text>
                        </View>
                        {tooFew && <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.error} />}
                      </Card.Content>
                    </Card>
                  );
                })}

                <Divider style={{ marginVertical: 16 }} />

                <Text variant="titleSmall" style={{ marginBottom: 8 }}>Team 2</Text>
                {teams.filter(t => t.id !== team1Id).map(t => {
                  const tooFew = t.players.length < MIN_PLAYERS;
                  return (
                    <Card
                      key={`t2-${t.id}`}
                      style={[
                        styles.optionCard,
                        team2Id === t.id && { borderColor: tooFew ? theme.colors.error : theme.colors.primary, borderWidth: 2 },
                      ]}
                      onPress={() => setTeam2Id(t.id)}
                    >
                      <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <RadioButton
                          value={t.id}
                          status={team2Id === t.id ? 'checked' : 'unchecked'}
                          onPress={() => setTeam2Id(t.id)}
                        />
                        <View style={{ flex: 1 }}>
                          <Text variant="titleSmall">{t.name} ({t.shortName})</Text>
                          <Text variant="bodySmall" style={{ color: tooFew ? theme.colors.error : theme.colors.onSurfaceVariant }}>
                            {t.players.length} players{tooFew ? ` — needs at least ${MIN_PLAYERS}` : ''}
                          </Text>
                        </View>
                        {tooFew && <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.error} />}
                      </Card.Content>
                    </Card>
                  );
                })}

                {team1Id && team2Id && (!team1HasEnough || !team2HasEnough) && (
                  <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4, marginBottom: 8 }}>
                    {!team1HasEnough && !team2HasEnough
                      ? `Both teams need at least ${MIN_PLAYERS} players to play.`
                      : !team1HasEnough
                      ? `${team1?.name} needs at least ${MIN_PLAYERS} players to play.`
                      : `${team2?.name} needs at least ${MIN_PLAYERS} players to play.`}
                    {' '}Add players from the Teams tab first.
                  </Text>
                )}
                <View style={styles.navButtons}>
                  <Button mode="text" onPress={() => setStep('format')}>Back</Button>
                  <Button mode="contained" testID="match-teams-next-btn" onPress={() => {
                    if (canProceedTeams) {
                      // Auto-select all players only when team has exactly the required count
                      if (team1 && team1.players.length === 11) setTeam1XI(new Set(team1.players.map(p => p.id)));
                      if (team2 && team2.players.length === 11) setTeam2XI(new Set(team2.players.map(p => p.id)));
                      setStep('playing_xi');
                    }
                  }} disabled={!canProceedTeams}>
                    Next
                  </Button>
                </View>
              </>
            )}
          </>
        )}

        {/* Step 3: Playing XI */}
        {step === 'playing_xi' && team1 && team2 && (
          <>
            <Text variant="titleLarge" style={styles.stepTitle}>Select Playing XI</Text>

            <Text variant="titleSmall" style={{ marginBottom: 8 }}>
              {team1.name}{' '}
              <Text style={{ color: requiredXI !== null ? (team1XI.size !== requiredXI ? theme.colors.error : theme.colors.primary) : (team1XI.size < MIN_PLAYERS ? theme.colors.error : theme.colors.primary) }}>
                ({team1XI.size}{requiredXI !== null ? `/${requiredXI}` : ` — min ${MIN_PLAYERS}`} selected)
              </Text>
            </Text>
            {team1.players.map(p => (
              <Card key={p.id} style={[styles.optionCard, { padding: 0 }]}>
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                  <Checkbox
                    status={team1XI.has(p.id) ? 'checked' : 'unchecked'}
                    onPress={() => togglePlayer(p.id, team1XI, setTeam1XI)}
                  />
                  <Text variant="bodyMedium">{p.name}</Text>
                  {p.isWicketKeeper && <Text variant="bodySmall" style={{ color: '#666' }}> (WK)</Text>}
                </Card.Content>
              </Card>
            ))}

            <Divider style={{ marginVertical: 16 }} />

            <Text variant="titleSmall" style={{ marginBottom: 8 }}>
              {team2.name}{' '}
              <Text style={{ color: requiredXI !== null ? (team2XI.size !== requiredXI ? theme.colors.error : theme.colors.primary) : (team2XI.size < MIN_PLAYERS ? theme.colors.error : theme.colors.primary) }}>
                ({team2XI.size}{requiredXI !== null ? `/${requiredXI}` : ` — min ${MIN_PLAYERS}`} selected)
              </Text>
            </Text>
            {team2.players.map(p => (
              <Card key={p.id} style={[styles.optionCard, { padding: 0 }]}>
                <Card.Content style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                  <Checkbox
                    status={team2XI.has(p.id) ? 'checked' : 'unchecked'}
                    onPress={() => togglePlayer(p.id, team2XI, setTeam2XI)}
                  />
                  <Text variant="bodyMedium">{p.name}</Text>
                  {p.isWicketKeeper && <Text variant="bodySmall" style={{ color: '#666' }}> (WK)</Text>}
                </Card.Content>
              </Card>
            ))}

            <View style={styles.navButtons}>
              <Button mode="text" onPress={() => setStep('teams')}>Back</Button>
              <Button mode="contained" testID="match-xi-next-btn" onPress={() => setStep('venue')} disabled={!canProceedXI}>
                Next
              </Button>
            </View>
          </>
        )}

        {/* Step 4: Venue */}
        {step === 'venue' && (
          <>
            <Text variant="titleLarge" style={styles.stepTitle}>Match Details</Text>
            <TextInput
              label="Venue"
              value={venue}
              onChangeText={setVenue}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Wankhede Stadium"
              testID="match-venue-input"
            />
            <View style={styles.navButtons}>
              <Button mode="text" onPress={() => setStep('playing_xi')}>Back</Button>
              <Button mode="contained" testID="match-venue-next-btn" onPress={() => setStep('confirm')}>Next</Button>
            </View>
          </>
        )}

        {/* Step 5: Confirm */}
        {step === 'confirm' && team1 && team2 && (
          <>
            <Text variant="titleLarge" style={styles.stepTitle}>Confirm Match</Text>
            <Card style={styles.summaryCard}>
              <Card.Content>
                <View style={styles.summaryRow}>
                  <Text variant="bodySmall" style={{ color: '#666' }}>Format</Text>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>{format.toUpperCase()}</Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.summaryRow}>
                  <Text variant="bodySmall" style={{ color: '#666' }}>Teams</Text>
                  <Text variant="bodyMedium" style={{ fontWeight: 'bold' }}>
                    {team1.shortName} vs {team2.shortName}
                  </Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.summaryRow}>
                  <Text variant="bodySmall" style={{ color: '#666' }}>Players</Text>
                  <Text variant="bodyMedium">{team1XI.size} vs {team2XI.size}</Text>
                </View>
                <Divider style={{ marginVertical: 8 }} />
                <View style={styles.summaryRow}>
                  <Text variant="bodySmall" style={{ color: '#666' }}>Venue</Text>
                  <Text variant="bodyMedium">{venue || 'Unknown Venue'}</Text>
                </View>
              </Card.Content>
            </Card>

            <View style={styles.navButtons}>
              <Button mode="text" onPress={() => setStep('venue')}>Back</Button>
              <Button mode="contained" testID="match-create-btn" onPress={handleCreate}>Create Match</Button>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    paddingBottom: 0,
  },
  progressItem: { alignItems: 'center', gap: 4 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  content: { padding: 16 },
  stepTitle: { fontWeight: 'bold', marginBottom: 16 },
  optionCard: { marginBottom: 8, borderRadius: 12 },
  input: { marginBottom: 16 },
  nextButton: { marginTop: 16 },
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  emptyState: { alignItems: 'center', padding: 32 },
  summaryCard: { borderRadius: 12, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unauthorized: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  unauthorizedTitle: { fontWeight: '700', marginTop: 8 },
});
