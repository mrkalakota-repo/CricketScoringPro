import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, RadioButton, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMatchStore } from '../../../src/store/match-store';
import { usePrefsStore } from '../../../src/store/prefs-store';
import * as cloudMatchRepo from '../../../src/db/repositories/cloud-match-repo';
import type { TossDecision } from '../../../src/engine/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TossScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { engine, loadMatch, recordToss, startMatch, setOpeners, saveMatch } = useMatchStore();
  const { myTeamIds, delegateTeamIds } = usePrefsStore();
  const matchId = Array.isArray(id) ? id[0] : id;

  const [matchLoading, setMatchLoading] = useState(true);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [decision, setDecision] = useState<TossDecision>('bat');
  const [step, setStep] = useState<'winner' | 'decision' | 'done'>('winner');
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (matchId && (!engine || engine.getMatch().id !== matchId)) {
      loadMatch(matchId).finally(() => setMatchLoading(false));
    } else {
      setMatchLoading(false);
    }
  }, [matchId]);

  const match = engine?.getMatch();

  // Determine if this device controls the toss (owns/delegates team1)
  const canDoToss = match
    ? (myTeamIds.includes(match.team1.id) || delegateTeamIds.includes(match.team1.id))
    : true; // default to allow until match loads

  // Observer: subscribe to live_matches and auto-navigate when toss is done
  useEffect(() => {
    if (!matchId || canDoToss) return;
    const unsub = cloudMatchRepo.subscribeToLiveMatch(matchId, (status) => {
      if ((status === 'in_progress' || status === 'toss') && !navigatingRef.current) {
        navigatingRef.current = true;
        loadMatch(matchId).finally(() => {
          router.replace(`/match/${matchId}/scoring`);
        });
      }
    });
    return unsub;
  }, [matchId, canDoToss]);

  if (matchLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Loading match…</Text>
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Match not found</Text>
        <Button mode="text" icon="arrow-left" onPress={() => router.back()} style={{ marginTop: 8 }}>Go Back</Button>
      </View>
    );
  }

  // Observer (team2 admin): show waiting screen while team1 admin does the toss
  if (!canDoToss) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <MaterialCommunityIcons name="circle-outline" size={48} color="#FFFFFF" />
          <Text variant="headlineSmall" style={styles.headerTitle}>Toss</Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            {match.team1.shortName} vs {match.team2.shortName}
          </Text>
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginTop: 16, fontWeight: '700' }}>
            Waiting for toss…
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
            {match.team1.name} admin is recording the toss. You will be taken to the scoring screen automatically.
          </Text>
        </View>
      </View>
    );
  }

  if (match.status === 'pending_acceptance') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="clock-alert-outline" size={48} color="#F57C00" />
        <Text variant="titleMedium" style={{ color: '#F57C00', marginTop: 12, fontWeight: '700' }}>Awaiting acceptance</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
          The opposing team must accept the match before the toss can begin.
        </Text>
        <Button mode="text" icon="arrow-left" onPress={() => router.back()} style={{ marginTop: 16 }}>Go Back</Button>
      </View>
    );
  }

  const handleConfirm = async () => {
    recordToss({ winnerId: winnerId!, decision });

    const battingTeamId = decision === 'bat' ? winnerId! :
      (winnerId === match.team1.id ? match.team2.id : match.team1.id);
    const bowlingTeamId = battingTeamId === match.team1.id ? match.team2.id : match.team1.id;

    startMatch(battingTeamId, bowlingTeamId);
    await saveMatch();
    setStep('done');
  };

  const winnerTeam = winnerId === match.team1.id ? match.team1 : match.team2;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <MaterialCommunityIcons name="circle-outline" size={48} color="#FFFFFF" />
        <Text variant="headlineSmall" style={styles.headerTitle}>Toss</Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {match.team1.shortName} vs {match.team2.shortName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {step === 'winner' && (
          <>
            <Text variant="titleMedium" style={styles.question}>Who won the toss?</Text>
            <Card
              style={[styles.teamCard, winnerId === match.team1.id && { borderColor: theme.colors.primary, borderWidth: 2 }]}
              onPress={() => setWinnerId(match.team1.id)}
            >
              <Card.Content style={styles.teamContent}>
                <RadioButton
                  value={match.team1.id}
                  status={winnerId === match.team1.id ? 'checked' : 'unchecked'}
                  onPress={() => setWinnerId(match.team1.id)}
                />
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{match.team1.name}</Text>
              </Card.Content>
            </Card>
            <Card
              style={[styles.teamCard, winnerId === match.team2.id && { borderColor: theme.colors.primary, borderWidth: 2 }]}
              onPress={() => setWinnerId(match.team2.id)}
            >
              <Card.Content style={styles.teamContent}>
                <RadioButton
                  value={match.team2.id}
                  status={winnerId === match.team2.id ? 'checked' : 'unchecked'}
                  onPress={() => setWinnerId(match.team2.id)}
                />
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{match.team2.name}</Text>
              </Card.Content>
            </Card>
            <Button
              mode="contained"
              onPress={() => setStep('decision')}
              disabled={!winnerId}
              style={styles.nextButton}
            >
              Next
            </Button>
          </>
        )}

        {step === 'decision' && winnerId && (
          <>
            <Text variant="titleMedium" style={styles.question}>
              {winnerTeam.name} elected to...
            </Text>
            <View style={styles.decisionRow}>
              <Card
                style={[styles.decisionCard, decision === 'bat' && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                onPress={() => setDecision('bat')}
              >
                <Card.Content style={styles.decisionContent}>
                  <MaterialCommunityIcons name="cricket" size={40} color={decision === 'bat' ? theme.colors.primary : '#999'} />
                  <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>Bat</Text>
                </Card.Content>
              </Card>
              <Card
                style={[styles.decisionCard, decision === 'bowl' && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                onPress={() => setDecision('bowl')}
              >
                <Card.Content style={styles.decisionContent}>
                  <MaterialCommunityIcons name="baseball" size={40} color={decision === 'bowl' ? theme.colors.primary : '#999'} />
                  <Text variant="titleMedium" style={{ fontWeight: 'bold', marginTop: 8 }}>Bowl</Text>
                </Card.Content>
              </Card>
            </View>
            <View style={styles.navButtons}>
              <Button mode="text" onPress={() => setStep('winner')}>Back</Button>
              <Button mode="contained" onPress={handleConfirm}>Confirm</Button>
            </View>
          </>
        )}

        {step === 'done' && (
          <>
            <View style={styles.doneContainer}>
              <MaterialCommunityIcons name="check-circle" size={64} color={theme.colors.primary} />
              <Text variant="titleLarge" style={{ fontWeight: 'bold', marginTop: 16 }}>
                Toss Complete!
              </Text>
              <Text variant="bodyMedium" style={{ color: '#666', marginTop: 8, textAlign: 'center' }}>
                {winnerTeam.name} won the toss and elected to {decision}
              </Text>
            </View>
            <Button
              mode="contained"
              onPress={() => router.replace(`/match/${id}/scoring`)}
              style={styles.nextButton}
              icon="play"
            >
              Start Scoring
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 8 },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)' },
  content: { padding: 24 },
  question: { fontWeight: 'bold', marginBottom: 16 },
  teamCard: { marginBottom: 12, borderRadius: 12 },
  teamContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  decisionRow: { flexDirection: 'row', gap: 16 },
  decisionCard: { flex: 1, borderRadius: 12 },
  decisionContent: { alignItems: 'center', padding: 16 },
  nextButton: { marginTop: 24 },
  navButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  doneContainer: { alignItems: 'center', padding: 32 },
});
