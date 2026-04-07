import { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image } from 'react-native';
import { Text, Card, Button, Avatar, useTheme, Divider, Chip, Portal, Dialog, TextInput, ActivityIndicator } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../../src/store/team-store';
import { usePrefsStore } from '../../../src/store/prefs-store';
import { useAdminAuth } from '../../../src/hooks/useAdminAuth';
import { AdminPinModal } from '../../../src/components/AdminPinModal';
import { SetAdminPinModal } from '../../../src/components/SetAdminPinModal';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { isCloudEnabled } from '../../../src/config/supabase';
import * as delegateRepo from '../../../src/db/repositories/cloud-delegate-repo';
import { generateDelegateCode, DELEGATE_CODE_TTL_MS } from '../../../src/utils/delegate-code';
import type { BowlingStyle } from '../../../src/engine/types';
import { bowlingIcon, battingIcon } from '../../../src/utils/player-icons';

type PendingAction = 'roster' | 'edit' | 'delete' | 'setPin' | 'delegate';

export default function TeamDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const deleteTeam = useTeamStore(s => s.deleteTeam);

  const teamId = Array.isArray(id) ? id[0] : id;
  const team = teams.find(t => t.id === teamId);

  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const playerTeamIds = usePrefsStore(s => s.playerTeamIds);
  const delegateTeamIds = usePrefsStore(s => s.delegateTeamIds);
  const addDelegateTeam = usePrefsStore(s => s.addDelegateTeam);
  const isAdmin = useAdminAuth(s => s.isAdmin);
  const revoke = useAdminAuth(s => s.revoke);

  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPinModal, setShowSetPinModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Delegate state
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [delegateCode, setDelegateCode] = useState('');
  const [delegateExpiry, setDelegateExpiry] = useState(0);
  const [delegateCountdown, setDelegateCountdown] = useState('');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Countdown timer for delegate code
  useEffect(() => {
    if (!delegateExpiry) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, delegateExpiry - Date.now());
      if (remaining === 0) { setDelegateCode(''); setDelegateExpiry(0); setDelegateCountdown(''); clearInterval(interval); return; }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDelegateCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [delegateExpiry]);

  if (!team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="shield-off-outline" size={48} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>Team not found</Text>
      </View>
    );
  }

  const isMyTeam = myTeamIds.includes(team.id);
  const isPlayerTeam = playerTeamIds.includes(team.id);
  const isDelegate = !isMyTeam && delegateTeamIds.includes(team.id);
  const hasEditAccess = isMyTeam || isDelegate;
  const isMember = isMyTeam || isPlayerTeam || isDelegate;
  const adminUnlocked = isMyTeam && isAdmin(team.id, team.adminPinHash);

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
    else if (action === 'delegate') handleGenerateCode();
  };

  const handleGenerateCode = async () => {
    const code = generateDelegateCode();
    const expiry = Date.now() + DELEGATE_CODE_TTL_MS;
    setDelegateCode(code);
    setDelegateExpiry(expiry);
    try { await delegateRepo.publishDelegateCode(team.id, code, expiry); } catch { /* ignore */ }
    setShowDelegateModal(true);
  };

  const handleClaimCode = async () => {
    setClaimError('');
    setClaimLoading(true);
    try {
      const ok = await delegateRepo.fetchAndClaimDelegateCode(team.id, claimCode.trim());
      if (ok) {
        await addDelegateTeam(team.id);
        setShowClaimModal(false);
        setClaimCode('');
      } else {
        setClaimError('Invalid or expired code. Ask the team admin for a new one.');
      }
    } catch {
      setClaimError('Could not verify code. Check your connection.');
    } finally {
      setClaimLoading(false);
    }
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

      {/* Delegate Code Modal (creator shows code) */}
      <Portal>
        <Dialog visible={showDelegateModal} onDismiss={() => setShowDelegateModal(false)}>
          <Dialog.Title>Delegate Access Code</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
              Share this code with someone to grant them editor access to {team.name}. Expires in:
            </Text>
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Text style={{ fontSize: 36, fontWeight: '900', letterSpacing: 8, color: theme.colors.primary }}>
                {delegateCode}
              </Text>
              {!!delegateCountdown && (
                <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>{delegateCountdown} remaining</Text>
              )}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDelegateModal(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Claim Code Modal (delegate enters code) */}
        <Dialog visible={showClaimModal} onDismiss={() => { setShowClaimModal(false); setClaimCode(''); setClaimError(''); }}>
          <Dialog.Title>Enter Delegate Code</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
              Ask the team creator for a 6-character code to get editor access.
            </Text>
            {!isCloudEnabled && (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
                Cloud sync required. Add Supabase credentials to .env to use this feature.
              </Text>
            )}
            <TextInput
              label="Code"
              value={claimCode}
              onChangeText={t => { setClaimCode(t.toUpperCase()); setClaimError(''); }}
              mode="outlined"
              autoCapitalize="characters"
              maxLength={6}
              style={{ fontFamily: 'monospace', letterSpacing: 4 }}
            />
            {!!claimError && (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>{claimError}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setShowClaimModal(false); setClaimCode(''); setClaimError(''); }}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleClaimCode}
              disabled={claimCode.length < 6 || claimLoading || !isCloudEnabled}
            >
              {claimLoading ? <ActivityIndicator size={16} color="#fff" /> : 'Verify'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
        {!hasEditAccess ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
              <MaterialCommunityIcons name="eye-outline" size={13} color="#FFFFFF" />
              <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '700' }}>View Only</Text>
            </View>
            {!isDelegate && (
              <Chip
                compact icon="account-key"
                textStyle={{ fontSize: 10, color: '#FFFFFF', fontWeight: '700' }}
                style={{ backgroundColor: '#E65100', borderWidth: 0 }}
                onPress={() => setShowClaimModal(true)}
              >
                Claim Access
              </Chip>
            )}
          </View>
        ) : isDelegate ? (
          <Chip
            compact icon="account-key"
            textStyle={{ fontSize: 10, color: '#2E7D32' }}
            style={{ marginTop: 8, backgroundColor: '#E8F5E9' }}
          >
            Delegate Access
          </Chip>
        ) : team.adminPinHash ? (
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
        {hasEditAccess && (
          <Button
            mode="contained"
            icon="account-plus"
            onPress={() => isDelegate ? router.push(`/team/${teamId}/roster`) : requireAdmin('roster', () => router.push(`/team/${teamId}/roster`))}
            style={styles.actionButtonFull}
          >
            Manage Roster
          </Button>
        )}
        <View style={styles.actionsRow}>
          {hasEditAccess && (
            <Button
              mode="outlined"
              icon="pencil"
              onPress={() => isDelegate ? router.push(`/team/${teamId}/edit`) : requireAdmin('edit', () => router.push(`/team/${teamId}/edit`))}
              style={styles.actionButton}
            >
              Edit Team
            </Button>
          )}
          {isCloudEnabled && isMember && (
            <Button
              mode="outlined"
              icon="chat"
              onPress={() => router.push(`/chat/${teamId}`)}
              style={styles.actionButton}
            >
              Team Chat
            </Button>
          )}
        </View>
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
            {hasEditAccess && (
              <Button
                mode="contained"
                icon="account-plus"
                onPress={() => isDelegate ? router.push(`/team/${teamId}/roster`) : requireAdmin('roster', () => router.push(`/team/${teamId}/roster`))}
                style={{ marginTop: 12 }}
              >
                Add Players
              </Button>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const batInfo = battingIcon(item.battingStyle);
          const bowlInfo = bowlingIcon(item.bowlingStyle);
          return (
            <Card style={styles.playerCard} onPress={() => router.push(`/player/${item.id}`)}>
              <Card.Content style={styles.playerContent}>
                <View style={styles.avatarWrapper}>
                  {item.photoUri ? (
                    <Image source={{ uri: item.photoUri }} style={styles.playerPhoto} />
                  ) : (
                    <Avatar.Text
                      size={40}
                      label={`${index + 1}`}
                      style={{ backgroundColor: theme.colors.primaryContainer }}
                      labelStyle={{ fontSize: 14, color: theme.colors.onPrimaryContainer }}
                    />
                  )}
                  {item.jerseyNumber !== null && (
                    <View style={[styles.jerseyBadge, { backgroundColor: theme.colors.surface }]}>
                      <Text style={[styles.jerseyBadgeText, { color: theme.colors.onSurface }]}>
                        {item.jerseyNumber}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.playerInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{item.name}</Text>
                    {!!item.isCaptain && (
                      <View style={[styles.roleBadge, { backgroundColor: '#FFF3E0' }]}>
                        <MaterialCommunityIcons name="crown" size={11} color="#E65100" />
                        <Text style={[styles.roleBadgeText, { color: '#E65100' }]}>C</Text>
                      </View>
                    )}
                    {!!item.isViceCaptain && (
                      <View style={[styles.roleBadge, { backgroundColor: '#FFF8E1' }]}>
                        <MaterialCommunityIcons name="crown-outline" size={11} color="#F9A825" />
                        <Text style={[styles.roleBadgeText, { color: '#F9A825' }]}>VC</Text>
                      </View>
                    )}
                    {!!item.isWicketKeeper && (
                      <View style={[styles.roleBadge, { backgroundColor: theme.colors.surfaceVariant }]}>
                        <MaterialCommunityIcons name="shield-account" size={11} color={theme.colors.onSurfaceVariant} />
                        <Text style={[styles.roleBadgeText, { color: theme.colors.onSurfaceVariant }]}>WK</Text>
                      </View>
                    )}
                    {!!item.isAllRounder && (
                      <View style={[styles.roleBadge, { backgroundColor: '#E8F5E9' }]}>
                        <MaterialCommunityIcons name="star-four-points" size={11} color="#2E7D32" />
                        <Text style={[styles.roleBadgeText, { color: '#2E7D32' }]}>AR</Text>
                      </View>
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
      {hasEditAccess && (
        <View style={[styles.adminSection, { borderTopColor: theme.colors.outlineVariant }]}>
          {isMyTeam && (
            <>
              <Button
                mode="text"
                icon={team.adminPinHash ? 'shield-edit' : 'shield-plus'}
                onPress={() => requireAdmin('setPin', () => setShowSetPinModal(true))}
              >
                {team.adminPinHash ? 'Change PIN' : 'Set PIN'}
              </Button>
              <Button
                mode="text"
                icon="account-key"
                onPress={() => requireAdmin('delegate', () => handleGenerateCode())}
                disabled={!isCloudEnabled}
              >
                Delegate Code
              </Button>
              <Button
                mode="text"
                textColor={theme.colors.error}
                icon="delete"
                onPress={() => requireAdmin('delete', () => setShowDeleteDialog(true))}
              >
                Delete
              </Button>
            </>
          )}
        </View>
      )}
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
  actions: { gap: 10, padding: 16 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionButtonFull: { borderRadius: 20 },
  actionButton: { flex: 1, borderRadius: 20 },
  sectionTitle: { fontWeight: 'bold', padding: 16, paddingBottom: 8 },
  playerCard: { marginBottom: 8, borderRadius: 12 },
  playerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerInfo: { flex: 1 },
  avatarWrapper: { position: 'relative', width: 40, height: 40 },
  playerPhoto: { width: 40, height: 40, borderRadius: 20 },
  jerseyBadge: {
    position: 'absolute', bottom: -2, right: -4,
    borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1,
    minWidth: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
  jerseyBadgeText: { fontSize: 9, fontWeight: '800', lineHeight: 12 },
  emptyPlayers: { alignItems: 'center', padding: 32 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  adminSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
