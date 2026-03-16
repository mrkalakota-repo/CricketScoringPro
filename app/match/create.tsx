import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, SegmentedButtons, TextInput, RadioButton, Checkbox, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTeamStore } from '../../src/store/team-store';
import { useMatchStore } from '../../src/store/match-store';
import { FORMAT_CONFIGS } from '../../src/engine/types';
import type { MatchFormat, MatchConfig, Player } from '../../src/engine/types';
import { createNewMatch } from '../../src/engine/match-engine';
import * as matchRepo from '../../src/db/repositories/match-repo';
import * as Crypto from 'expo-crypto';
const uuidv4 = () => Crypto.randomUUID();

type Step = 'format' | 'teams' | 'playing_xi' | 'venue' | 'confirm';

export default function CreateMatchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const teams = useTeamStore(s => s.teams);
  const { createAndStartMatch } = useMatchStore();

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
      if (newSet.size >= 11) return;
      newSet.add(playerId);
    }
    setTeamSet(newSet);
  };

  const handleCreate = async () => {
    if (!team1 || !team2) return;

    const config: MatchConfig = format === 'custom'
      ? {
          format: 'custom',
          oversPerInnings: parseInt(customOvers) || 20,
          maxInnings: 2,
          playersPerSide: Math.max(team1XI.size, team2XI.size, 2),
          powerplays: [],
          followOnMinimum: null,
          wideRuns: 1,
          noBallRuns: 1,
        }
      : { format, ...FORMAT_CONFIGS[format] };

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
    // Save initial match state so it can be restored if user navigates away
    await matchRepo.saveMatchState(matchId, match);

    createAndStartMatch(match);
    router.replace(`/match/${matchId}/toss`);
  };

  const canProceedTeams = team1Id && team2Id && team1Id !== team2Id;
  const canProceedXI = team1XI.size >= 2 && team2XI.size >= 2;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
              />
            )}
            <Button mode="contained" onPress={() => setStep('teams')} style={styles.nextButton}>
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
                {teams.map(t => (
                  <Card
                    key={`t1-${t.id}`}
                    style={[styles.optionCard, team1Id === t.id && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                    onPress={() => { setTeam1Id(t.id); if (t.id === team2Id) setTeam2Id(null); }}
                  >
                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <RadioButton
                        value={t.id}
                        status={team1Id === t.id ? 'checked' : 'unchecked'}
                        onPress={() => { setTeam1Id(t.id); if (t.id === team2Id) setTeam2Id(null); }}
                      />
                      <View>
                        <Text variant="titleSmall">{t.name} ({t.shortName})</Text>
                        <Text variant="bodySmall" style={{ color: '#666' }}>{t.players.length} players</Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))}

                <Divider style={{ marginVertical: 16 }} />

                <Text variant="titleSmall" style={{ marginBottom: 8 }}>Team 2</Text>
                {teams.filter(t => t.id !== team1Id).map(t => (
                  <Card
                    key={`t2-${t.id}`}
                    style={[styles.optionCard, team2Id === t.id && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                    onPress={() => setTeam2Id(t.id)}
                  >
                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <RadioButton
                        value={t.id}
                        status={team2Id === t.id ? 'checked' : 'unchecked'}
                        onPress={() => setTeam2Id(t.id)}
                      />
                      <View>
                        <Text variant="titleSmall">{t.name} ({t.shortName})</Text>
                        <Text variant="bodySmall" style={{ color: '#666' }}>{t.players.length} players</Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))}

                <View style={styles.navButtons}>
                  <Button mode="text" onPress={() => setStep('format')}>Back</Button>
                  <Button mode="contained" onPress={() => {
                    if (canProceedTeams) {
                      // Auto-select all players if teams have <= 11
                      if (team1 && team1.players.length <= 11) setTeam1XI(new Set(team1.players.map(p => p.id)));
                      if (team2 && team2.players.length <= 11) setTeam2XI(new Set(team2.players.map(p => p.id)));
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
              {team1.name} ({team1XI.size}/11)
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
              {team2.name} ({team2XI.size}/11)
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
              <Button mode="contained" onPress={() => setStep('venue')} disabled={!canProceedXI}>
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
            />
            <View style={styles.navButtons}>
              <Button mode="text" onPress={() => setStep('playing_xi')}>Back</Button>
              <Button mode="contained" onPress={() => setStep('confirm')}>Next</Button>
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
              <Button mode="contained" onPress={handleCreate}>Create Match</Button>
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
});
