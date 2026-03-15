import { useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, Button, Avatar, useTheme, Divider, Chip } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../../src/store/team-store';
import { useAdminAuth } from '../../../src/hooks/useAdminAuth';
import { AdminPinModal } from '../../../src/components/AdminPinModal';
import { SetAdminPinModal } from '../../../src/components/SetAdminPinModal';

type PendingAction = 'roster' | 'edit' | 'delete' | 'setPin';

export default function TeamDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const deleteTeam = useTeamStore(s => s.deleteTeam);

  const teamId = Array.isArray(id) ? id[0] : id;
  const team = teams.find(t => t.id === teamId);

  const isAdmin = useAdminAuth(s => s.isAdmin);
  const revoke = useAdminAuth(s => s.revoke);

  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  if (!team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleMedium" style={{ color: '#999' }}>Team not found</Text>
      </View>
    );
  }

  const adminUnlocked = isAdmin(team.id, team.adminPinHash);

  const requireAdmin = (action: PendingAction, callback: () => void) => {
    if (adminUnlocked) {
      callback();
    } else {
      setPendingAction(action);
      setShowPinModal(true);
    }
  };

  const onPinSuccess = () => {
    setShowPinModal(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'roster') router.push(`/team/${teamId}/roster`);
    else if (action === 'edit') router.push(`/team/${teamId}/edit`);
    else if (action === 'setPin') setShowSetPinModal(true);
    else if (action === 'delete') confirmDelete();
  };

  const confirmDelete = () => {
    Alert.alert('Delete Team', `Delete "${team.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTeam(team.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: team.name }} />

      {/* PIN Modals */}
      {team.adminPinHash && (
        <AdminPinModal
          visible={showPinModal}
          teamId={team.id}
          adminPinHash={team.adminPinHash}
          onSuccess={onPinSuccess}
          onDismiss={() => { setShowPinModal(false); setPendingAction(null); }}
        />
      )}
      <SetAdminPinModal
        visible={showSetPinModal}
        teamId={team.id}
        hasPinAlready={!!team.adminPinHash}
        onDone={() => setShowSetPinModal(false)}
        onDismiss={() => setShowSetPinModal(false)}
      />

      {/* Team Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Avatar.Text
          size={64}
          label={team.shortName.substring(0, 3)}
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          labelStyle={{ fontSize: 24, fontWeight: 'bold' }}
        />
        <Text variant="headlineSmall" style={styles.teamName}>{team.name}</Text>
        <Text variant="bodyMedium" style={styles.shortName}>{team.shortName}</Text>
        {team.adminPinHash ? (
          <Chip
            compact
            icon={adminUnlocked ? 'lock-open' : 'lock'}
            textStyle={{ fontSize: 10, color: adminUnlocked ? '#2E7D32' : '#E65100' }}
            style={{ marginTop: 8, backgroundColor: adminUnlocked ? '#E8F5E9' : '#FFF3E0' }}
            onPress={() => adminUnlocked ? revoke(team.id) : requireAdmin('roster', () => {})}
          >
            {adminUnlocked ? 'Admin unlocked' : 'PIN protected'}
          </Chip>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="account-plus"
          onPress={() => requireAdmin('roster', () => router.push(`/team/${teamId}/roster`))}
          style={styles.actionButton}
        >
          Manage Roster
        </Button>
        <Button
          mode="outlined"
          icon="pencil"
          onPress={() => requireAdmin('edit', () => router.push(`/team/${teamId}/edit`))}
          style={styles.actionButton}
        >
          Edit Team
        </Button>
      </View>

      <Divider style={{ marginHorizontal: 16 }} />

      {/* Players List */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Players ({team.players.length})
      </Text>

      <FlatList
        data={team.players}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 8) + 80 }}
        ListEmptyComponent={
          <View style={styles.emptyPlayers}>
            <Text variant="bodyMedium" style={{ color: '#999' }}>
              No players added yet
            </Text>
            <Button
              mode="contained"
              icon="account-plus"
              onPress={() => requireAdmin('roster', () => router.push(`/team/${teamId}/roster`))}
              style={{ marginTop: 12 }}
            >
              Add Players
            </Button>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={styles.playerCard}>
            <Card.Content style={styles.playerContent}>
              <Avatar.Text
                size={40}
                label={`${index + 1}`}
                style={{ backgroundColor: theme.colors.primaryContainer }}
                labelStyle={{ fontSize: 14 }}
              />
              <View style={styles.playerInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text variant="titleSmall">{item.name}</Text>
                  {!!item.isCaptain && (
                    <Chip compact style={{ height: 20, backgroundColor: '#FFF3E0' }} textStyle={{ fontSize: 10, color: '#E65100' }}>C</Chip>
                  )}
                  {!!item.isWicketKeeper && (
                    <Chip compact style={{ height: 20 }} textStyle={{ fontSize: 10 }}>WK</Chip>
                  )}
                  {!!item.isAllRounder && (
                    <Chip compact style={{ height: 20, backgroundColor: '#E8F5E9' }} textStyle={{ fontSize: 10, color: '#2E7D32' }}>AR</Chip>
                  )}
                </View>
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  {item.battingStyle === 'right' ? 'RHB' : 'LHB'}
                  {item.bowlingStyle !== 'none' ? ` · ${item.bowlingStyle}` : ''}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      {/* Admin Footer */}
      <View style={[styles.adminSection, { borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          mode="text"
          icon={team.adminPinHash ? 'shield-edit' : 'shield-plus'}
          onPress={() => requireAdmin('setPin', () => setShowSetPinModal(true))}
        >
          {team.adminPinHash ? 'Change Admin PIN' : 'Set Admin PIN'}
        </Button>
        <Button
          mode="text"
          textColor={theme.colors.error}
          icon="delete"
          onPress={() => requireAdmin('delete', confirmDelete)}
        >
          Delete Team
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  teamName: { color: '#FFFFFF', fontWeight: 'bold', marginTop: 12 },
  shortName: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  actionButton: { borderRadius: 20 },
  sectionTitle: { fontWeight: 'bold', padding: 16, paddingBottom: 8 },
  playerCard: { marginBottom: 8, borderRadius: 12 },
  playerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerInfo: { flex: 1 },
  emptyPlayers: { alignItems: 'center', padding: 32 },
  adminSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
