import { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, Avatar, useTheme, Divider, Chip, Portal, Dialog } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../../src/store/team-store';
import { useAdminAuth } from '../../../src/hooks/useAdminAuth';
import { AdminPinModal } from '../../../src/components/AdminPinModal';
import { SetAdminPinModal } from '../../../src/components/SetAdminPinModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BowlingStyle, BattingStyle } from '../../../src/engine/types';

type PendingAction = 'roster' | 'edit' | 'delete' | 'setPin';
type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function bowlingIcon(style: BowlingStyle): { icon: IconName; color: string } {
  if (style === 'none') return { icon: 'minus-circle-outline', color: '#9E9E9E' };
  if (style.includes('fast')) return { icon: 'lightning-bolt', color: '#E65100' };
  if (style.includes('medium')) return { icon: 'weather-windy', color: '#1565C0' };
  if (style.includes('off-break') || style.includes('orthodox')) return { icon: 'rotate-right', color: '#6A1B9A' };
  if (style.includes('leg-break') || style.includes('chinaman')) return { icon: 'rotate-left', color: '#00695C' };
  return { icon: 'cricket', color: '#9E9E9E' };
}

function battingIcon(style: BattingStyle): { icon: IconName; color: string } {
  return style === 'right'
    ? { icon: 'alpha-r-circle', color: '#1B6B28' }
    : { icon: 'alpha-l-circle', color: '#E65100' };
}

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  if (!team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="shield-off-outline" size={48} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Team not found</Text>
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
    else if (action === 'delete') setShowDeleteDialog(true);
  };

  const doDelete = async () => {
    setShowDeleteDialog(false);
    await deleteTeam(team.id);
    router.back();
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

      {/* Delete confirm dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Team</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Delete "{team.name}"? This cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={doDelete}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Team Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Avatar.Text
          size={64}
          label={team.shortName.substring(0, 3)}
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          labelStyle={{ fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' }}
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

      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        Players ({team.players.length})
      </Text>

      <FlatList
        data={team.players}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 8) + 80 }}
        ListEmptyComponent={
          <View style={styles.emptyPlayers}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={48} color={theme.colors.outlineVariant} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
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
        renderItem={({ item, index }) => {
          const batInfo = battingIcon(item.battingStyle);
          const bowlInfo = bowlingIcon(item.bowlingStyle);
          return (
            <Card style={styles.playerCard} onPress={() => router.push(`/player/${item.id}`)}>
              <Card.Content style={styles.playerContent}>
                <Avatar.Text
                  size={40}
                  label={`${index + 1}`}
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                  labelStyle={{ fontSize: 14, color: theme.colors.onPrimaryContainer }}
                />
                <View style={styles.playerInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{item.name}</Text>
                    {!!item.isCaptain && (
                      <Chip compact icon="crown" style={{ height: 22, backgroundColor: '#FFF3E0' }} textStyle={{ fontSize: 9, color: '#E65100' }}>C</Chip>
                    )}
                    {!!item.isWicketKeeper && (
                      <Chip compact icon="shield-account" style={{ height: 22 }} textStyle={{ fontSize: 9 }}>WK</Chip>
                    )}
                    {!!item.isAllRounder && (
                      <Chip compact icon="star-four-points" style={{ height: 22, backgroundColor: '#E8F5E9' }} textStyle={{ fontSize: 9, color: '#2E7D32' }}>AR</Chip>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <MaterialCommunityIcons name={batInfo.icon} size={12} color={batInfo.color} />
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                        {item.battingStyle === 'right' ? 'RHB' : 'LHB'}
                      </Text>
                    </View>
                    {item.bowlingStyle !== 'none' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <MaterialCommunityIcons name={bowlInfo.icon} size={12} color={bowlInfo.color} />
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}>
                          {item.bowlingStyle}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.outlineVariant} />
              </Card.Content>
            </Card>
          );
        }}
      />

      {/* Admin Footer */}
      <View style={[styles.adminSection, { borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          mode="text"
          icon={team.adminPinHash ? 'shield-edit' : 'shield-plus'}
          onPress={() => requireAdmin('setPin', () => setShowSetPinModal(true))}
        >
          {team.adminPinHash ? 'Change PIN' : 'Set PIN'}
        </Button>
        <Button
          mode="text"
          textColor={theme.colors.error}
          icon="delete"
          onPress={() => requireAdmin('delete', () => setShowDeleteDialog(true))}
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
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16 },
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
