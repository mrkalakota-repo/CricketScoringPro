import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, useTheme, Button } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import * as cloudMatchRepo from '../../src/db/repositories/cloud-match-repo';
import type { CloudMatchRow, MatchInvitation } from '../../src/db/repositories/cloud-match-repo';
import { isCloudEnabled } from '../../src/config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMatchStore } from '../../src/store/match-store';
import { useTeamStore } from '../../src/store/team-store';
import { useUserAuth } from '../../src/hooks/useUserAuth';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MatchRow } from '../../src/db/repositories/match-repo';
import { useRole } from '../../src/hooks/useRole';

const PENDING_ORANGE = '#F57C00';

function parseMatchInfo(item: MatchRow, teams: ReturnType<typeof useTeamStore.getState>['teams']) {
  let team1Short = '';
  let team2Short = '';
  let score = '';

  if (item.match_state_json) {
    try {
      const m = JSON.parse(item.match_state_json);
      team1Short = m.team1?.shortName ?? '';
      team2Short = m.team2?.shortName ?? '';
      const inn = m.innings?.[m.currentInningsIndex];
      if (inn) {
        const batting = inn.battingTeamId === m.team1?.id ? m.team1?.shortName : m.team2?.shortName;
        score = `${batting}: ${inn.totalRuns}/${inn.totalWickets} (${inn.totalOvers}.${inn.totalBalls} ov)`;
      }
    } catch {}
  }

  if (!team1Short) team1Short = teams.find(t => t.id === item.team1_id)?.shortName ?? '???';
  if (!team2Short) team2Short = teams.find(t => t.id === item.team2_id)?.shortName ?? '???';

  return { team1Short, team2Short, score };
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }> = {
    in_progress:        { label: 'LIVE',    color: '#D32F2F', icon: 'circle' },
    toss:               { label: 'TOSS',    color: '#F57C00', icon: 'circle-outline' },
    completed:          { label: 'DONE',    color: '#2E7D32', icon: 'check-circle' },
    scheduled:          { label: 'SOON',    color: '#1565C0', icon: 'clock-outline' },
    pending_acceptance: { label: 'PENDING', color: PENDING_ORANGE, icon: 'clock-alert-outline' },
  };
  const c = config[status] ?? { label: status.toUpperCase(), color: '#9E9E9E', icon: 'circle-outline' };
  return (
    <View style={[styles.badge, { backgroundColor: c.color + '18', borderColor: c.color + '50', borderWidth: 1 }]}>
      <MaterialCommunityIcons name={c.icon} size={9} color={c.color} />
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

export default function MatchesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { matches, loading, loadMatches, acceptMatchInvitation, declineMatchInvitation } = useMatchStore();
  const teams = useTeamStore(s => s.teams);
  const { canCreateMatch } = useRole();
  const myPhone = useUserAuth(s => s.profile?.phone ?? null);
  const [cloudMatches, setCloudMatches] = useState<CloudMatchRow[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<MatchInvitation[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const invUnsubRef = useRef<(() => void) | null>(null);

  const loadCloud = useCallback(async () => {
    if (!isCloudEnabled) return;
    setCloudLoading(true);
    try {
      const all = await cloudMatchRepo.fetchRecentCloudMatches(7);
      const localIds = new Set(matches.map(m => m.id));
      setCloudMatches(all.filter(m => !localIds.has(m.id)));
    } finally {
      setCloudLoading(false);
    }
  }, [matches]);

  useFocusEffect(useCallback(() => { loadMatches(); }, []));

  useFocusEffect(useCallback(() => {
    loadCloud();
  }, [loadCloud]));

  // Subscribe to incoming match invitations (team2 admin view)
  useEffect(() => {
    if (!isCloudEnabled || !myPhone) return;
    cloudMatchRepo.fetchPendingInvitations(myPhone).then(setPendingInvitations);
    invUnsubRef.current = cloudMatchRepo.subscribeToInvitations(myPhone, setPendingInvitations);
    return () => { invUnsubRef.current?.(); };
  }, [myPhone]);

  const handleAccept = async (inv: MatchInvitation) => {
    setRespondingTo(inv.matchId);
    try {
      await acceptMatchInvitation(inv.matchId);
      setPendingInvitations(prev => prev.filter(i => i.matchId !== inv.matchId));
      router.push(`/match/${inv.matchId}/toss`);
    } finally {
      setRespondingTo(null);
    }
  };

  const handleDecline = async (inv: MatchInvitation) => {
    setRespondingTo(inv.matchId);
    try {
      await declineMatchInvitation(inv.matchId);
      setPendingInvitations(prev => prev.filter(i => i.matchId !== inv.matchId));
    } finally {
      setRespondingTo(null);
    }
  };

  const fabBottom = Math.max(insets.bottom, 8) + 16;

  const handlePress = (item: MatchRow) => {
    if (item.status === 'toss') {
      router.push(`/match/${item.id}/toss`);
    } else if (item.status === 'in_progress') {
      router.push(`/match/${item.id}/scoring`);
    } else {
      router.push(`/match/${item.id}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── Pending Invitations (team2 admin sees this) ── */}
      {pendingInvitations.length > 0 && (
        <View style={[styles.invSection, { borderBottomColor: theme.colors.outlineVariant }]}>
          <View style={styles.invHeader}>
            <MaterialCommunityIcons name="clock-alert-outline" size={16} color={PENDING_ORANGE} />
            <Text variant="labelMedium" style={[styles.invHeaderText, { color: PENDING_ORANGE }]}>
              Pending Invitations
            </Text>
          </View>
          {pendingInvitations.map(inv => (
            <Card key={inv.matchId} style={[styles.card, styles.invCard, { marginHorizontal: 16, marginBottom: 10 }]}>
              <View style={[styles.liveStripe, { backgroundColor: PENDING_ORANGE }]} />
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={[styles.formatBadge, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={[styles.formatText, { color: PENDING_ORANGE }]}>{inv.format.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#FFF3E018', borderColor: PENDING_ORANGE + '50', borderWidth: 1 }]}>
                    <MaterialCommunityIcons name="clock-outline" size={9} color={PENDING_ORANGE} />
                    <Text style={[styles.badgeText, { color: PENDING_ORANGE }]}>INVITED</Text>
                  </View>
                </View>
                <Text variant="titleMedium" style={[styles.teamsText, { color: theme.colors.onSurface }]}>
                  {inv.team1Name}{' '}
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>vs</Text>
                  {' '}{inv.team2Name}
                </Text>
                {inv.venue ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>{inv.venue}</Text>
                ) : null}
                <View style={styles.invActions}>
                  <Button
                    mode="contained"
                    icon="check"
                    onPress={() => handleAccept(inv)}
                    loading={respondingTo === inv.matchId}
                    disabled={respondingTo === inv.matchId}
                    style={{ flex: 1, borderRadius: 10 }}
                    buttonColor={theme.colors.primary}
                    compact
                  >
                    Accept
                  </Button>
                  <Button
                    mode="outlined"
                    icon="close"
                    onPress={() => handleDecline(inv)}
                    loading={respondingTo === inv.matchId}
                    disabled={respondingTo === inv.matchId}
                    style={{ flex: 1, borderRadius: 10 }}
                    textColor={theme.colors.error}
                    compact
                  >
                    Decline
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}

      <FlatList
        data={matches}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 56 }]}
        onRefresh={loadMatches}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="trophy-outline" size={56} color={theme.colors.outlineVariant} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>No matches yet</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>Tap + to start a match</Text>
          </View>
        }
        renderItem={({ item }) => {
          const { team1Short, team2Short, score } = parseMatchInfo(item, teams);
          return (
            <Card style={[styles.card, item.status === 'in_progress' && styles.liveCard]} onPress={() => handlePress(item)}>
              {item.status === 'in_progress' && <View style={[styles.liveStripe, { backgroundColor: theme.colors.error }]} />}
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={[styles.formatBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={[styles.formatText, { color: theme.colors.onPrimaryContainer }]}>
                      {item.format.toUpperCase()}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                <Text variant="titleMedium" style={[styles.teamsText, { color: theme.colors.onSurface }]}>
                  {team1Short}{' '}
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>vs</Text>
                  {' '}{team2Short}
                </Text>

                {score ? (
                  <Text variant="bodySmall" style={[styles.score, { color: theme.colors.primary }]}>{score}</Text>
                ) : null}

                {item.result ? (
                  <Text variant="bodySmall" style={[styles.result, { color: theme.colors.primary }]}>{item.result}</Text>
                ) : null}

                <View style={[styles.cardFooter, { borderTopColor: theme.colors.outlineVariant }]}>
                  {item.venue ? (
                    <View style={styles.footerItem}>
                      <MaterialCommunityIcons name="map-marker-outline" size={12} color={theme.colors.onSurfaceVariant} />
                      <Text variant="bodySmall" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>{item.venue}</Text>
                    </View>
                  ) : null}
                  <View style={styles.footerItem}>
                    <MaterialCommunityIcons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text variant="bodySmall" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
                      {new Date(item.match_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />
      {(cloudMatches.length > 0 || cloudLoading) && (
        <View style={[styles.cloudSection, { borderTopColor: theme.colors.outlineVariant }]}>
          <View style={styles.cloudHeader}>
            <MaterialCommunityIcons name="cloud-outline" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelMedium" style={[styles.cloudHeaderText, { color: theme.colors.onSurfaceVariant }]}>
              Cloud · Last 7 Days
            </Text>
          </View>
          {cloudLoading && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, paddingHorizontal: 16, paddingBottom: 8 }}>
              Loading…
            </Text>
          )}
          {cloudMatches.map(item => (
            <Card
              key={item.id}
              style={[styles.card, { marginHorizontal: 16 }]}
              onPress={() => router.push(`/match/${item.id}`)}
            >
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardTop}>
                  <View style={[styles.formatBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={[styles.formatText, { color: theme.colors.onPrimaryContainer }]}>
                      {item.format.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#1565C018', borderColor: '#1565C050', borderWidth: 1 }]}>
                    <MaterialCommunityIcons name="cloud-outline" size={9} color="#1565C0" />
                    <Text style={[styles.badgeText, { color: '#1565C0' }]}>CLOUD</Text>
                  </View>
                </View>
                <Text variant="titleMedium" style={[styles.teamsText, { color: theme.colors.onSurface }]}>
                  {item.team1Short}{' '}
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>vs</Text>
                  {' '}{item.team2Short}
                </Text>
                {item.result ? (
                  <Text variant="bodySmall" style={[styles.result, { color: theme.colors.primary }]}>{item.result}</Text>
                ) : null}
                <View style={[styles.cardFooter, { borderTopColor: theme.colors.outlineVariant }]}>
                  {item.venue ? (
                    <View style={styles.footerItem}>
                      <MaterialCommunityIcons name="map-marker-outline" size={12} color={theme.colors.onSurfaceVariant} />
                      <Text variant="bodySmall" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>{item.venue}</Text>
                    </View>
                  ) : null}
                  <View style={styles.footerItem}>
                    <MaterialCommunityIcons name="calendar-outline" size={12} color={theme.colors.onSurfaceVariant} />
                    <Text variant="bodySmall" style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
                      {new Date(item.matchDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
      {canCreateMatch && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: fabBottom }]}
          color="#FFFFFF"
          onPress={() => router.push('/match/create')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  card: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  liveCard: { elevation: 4, shadowColor: '#D32F2F', shadowOpacity: 0.15, shadowRadius: 8 },
  liveStripe: { height: 4, width: '100%' },
  cardContent: { paddingTop: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  formatBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  formatText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  teamsText: { fontWeight: '800', fontSize: 18, letterSpacing: 0.2 },
  score: { marginTop: 4, fontWeight: '600' },
  result: { marginTop: 4, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 11 },
  emptyState: { alignItems: 'center', padding: 64 },
  fab: { position: 'absolute', right: 16, borderRadius: 28 },
  cloudSection: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 80 },
  cloudHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  cloudHeaderText: { fontWeight: '700', letterSpacing: 0.3 },
  invSection: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 4 },
  invHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  invHeaderText: { fontWeight: '700', letterSpacing: 0.3 },
  invCard: { elevation: 2, shadowColor: PENDING_ORANGE, shadowOpacity: 0.12, shadowRadius: 4 },
  invActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
