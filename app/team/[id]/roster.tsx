import { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { TextInput, Button, Text, Card, useTheme, IconButton, SegmentedButtons, Switch, Portal, Dialog, HelperText } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTeamStore } from '../../../src/store/team-store';
import { usePrefsStore } from '../../../src/store/prefs-store';
import { useAdminAuth } from '../../../src/hooks/useAdminAuth';
import { AdminPinModal } from '../../../src/components/AdminPinModal';
import { getPlayerCode } from '../../../src/utils/player-code';
import * as teamRepo from '../../../src/db/repositories/team-repo';
import type { BowlingStyle } from '../../../src/engine/types';

const BOWLING_STYLES: BowlingStyle[] = [
  'none',
  'Right-arm fast',
  'Right-arm medium',
  'Right-arm off-break',
  'Right-arm leg-break',
  'Left-arm fast',
  'Left-arm medium',
  'Left-arm orthodox',
  'Left-arm chinaman',
];

const MAX_NAME_LENGTH = 50;

export default function RosterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const addPlayer = useTeamStore(s => s.addPlayer);
  const deletePlayer = useTeamStore(s => s.deletePlayer);

  const team = teams.find(t => t.id === id);
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const isAdmin = useAdminAuth(s => s.isAdmin);
  const [showPinModal, setShowPinModal] = useState(false);

  const teamId = Array.isArray(id) ? id[0] : id;
  const isMyTeam = team ? myTeamIds.includes(team.id) : false;
  const adminUnlocked = isMyTeam && (team ? isAdmin(team.id, team.adminPinHash) : false);

  // Add player form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [battingStyle, setBattingStyle] = useState('right');
  const [bowlingStyleIndex, setBowlingStyleIndex] = useState(0);
  const [isKeeper, setIsKeeper] = useState(false);
  const [isAllRounder, setIsAllRounder] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [isViceCaptain, setIsViceCaptain] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  // Delete confirmation
  const [deleteDialogPlayer, setDeleteDialogPlayer] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!team) return <View style={styles.container}><Text>Team not found</Text></View>;

  const resetForm = () => {
    setName('');
    setPhone('');
    setBattingStyle('right');
    setBowlingStyleIndex(0);
    setIsKeeper(false);
    setIsAllRounder(false);
    setIsCaptain(false);
    setIsViceCaptain(false);
    setShowForm(false);
    setAddError(null);
  };

  // Captain and Vice-Captain are mutually exclusive
  const handleCaptainToggle = (val: boolean) => {
    setIsCaptain(val);
    if (val) setIsViceCaptain(false);
  };
  const handleViceCaptainToggle = (val: boolean) => {
    setIsViceCaptain(val);
    if (val) setIsCaptain(false);
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) return;
    if (!teamId) return;

    // Validate phone uniqueness
    if (trimmedPhone) {
      if (!/^\+?[0-9]{7,15}$/.test(trimmedPhone.replace(/\s/g, ''))) {
        setAddError('Enter a valid phone number or leave it blank.');
        return;
      }
      const taken = await teamRepo.isPhoneNumberTaken(trimmedPhone);
      if (taken) {
        setAddError('This phone number is already linked to another player.');
        return;
      }
    }

    setAddError(null);
    setAddBusy(true);
    try {
      await addPlayer(
        teamId, trimmedName, trimmedPhone || null,
        battingStyle, BOWLING_STYLES[bowlingStyleIndex],
        isKeeper, isAllRounder, isCaptain, isViceCaptain,
      );
      resetForm();
    } catch (err) {
      setAddError('Could not add player. Please try again.');
      console.error('[RosterScreen] addPlayer failed:', err);
    } finally {
      setAddBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialogPlayer || !teamId) return;
    try {
      await deletePlayer(deleteDialogPlayer.id, teamId);
      setDeleteDialogPlayer(null);
    } catch (err) {
      setDeleteError('Could not remove player. Please try again.');
      console.error('[RosterScreen] deletePlayer failed:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: `${team.name} — Roster` }} />

      {team.adminPinHash && (
        <AdminPinModal
          visible={showPinModal}
          teamId={team.id}
          adminPinHash={team.adminPinHash}
          onSuccess={() => setShowPinModal(false)}
          onDismiss={() => setShowPinModal(false)}
        />
      )}

      {/* Add Player */}
      {!showForm ? (
        <Button
          mode="contained"
          icon="account-plus"
          onPress={() => adminUnlocked ? setShowForm(true) : setShowPinModal(true)}
          style={{ margin: 16, borderRadius: 20 }}
        >
          Add Player
        </Button>
      ) : (
        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 12, color: theme.colors.onSurface }}>
              New Player
            </Text>

            <TextInput
              label="Player Name"
              value={name}
              onChangeText={t => { setName(t.substring(0, MAX_NAME_LENGTH)); setAddError(null); }}
              mode="outlined"
              style={styles.input}
              autoFocus
              maxLength={MAX_NAME_LENGTH}
            />

            <TextInput
              label="Phone Number (optional)"
              value={phone}
              onChangeText={t => { setPhone(t); setAddError(null); }}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="+91 98765 43210"
              left={<TextInput.Icon icon="phone" />}
            />

            {addError && <HelperText type="error" style={{ marginBottom: 4 }}>{addError}</HelperText>}

            <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Batting Style</Text>
            <SegmentedButtons
              value={battingStyle}
              onValueChange={setBattingStyle}
              buttons={[
                { value: 'right', label: 'Right Hand' },
                { value: 'left', label: 'Left Hand' },
              ]}
              style={styles.input}
            />

            <Text variant="bodySmall" style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>Bowling Style</Text>
            <FlatList
              horizontal
              data={BOWLING_STYLES}
              keyExtractor={item => item}
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              renderItem={({ item, index }) => (
                <Button
                  mode={index === bowlingStyleIndex ? 'contained' : 'outlined'}
                  compact
                  onPress={() => setBowlingStyleIndex(index)}
                  style={{ marginRight: 8, borderRadius: 16 }}
                  labelStyle={{ fontSize: 11 }}
                >
                  {item === 'none' ? 'None' : item}
                </Button>
              )}
            />

            {/* Captain / VC — mutually exclusive */}
            <View style={styles.toggleRow}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Captain</Text>
              <Switch value={isCaptain} onValueChange={handleCaptainToggle} />
            </View>
            <View style={styles.toggleRow}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Vice Captain</Text>
              <Switch value={isViceCaptain} onValueChange={handleViceCaptainToggle} />
            </View>
            <View style={styles.toggleRow}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Wicket Keeper</Text>
              <Switch value={isKeeper} onValueChange={setIsKeeper} />
            </View>
            <View style={styles.toggleRow}>
              <View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>All-Rounder</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Bats and bowls</Text>
              </View>
              <Switch value={isAllRounder} onValueChange={setIsAllRounder} />
            </View>

            <View style={styles.formActions}>
              <Button mode="text" onPress={resetForm}>Cancel</Button>
              <Button mode="contained" onPress={handleAdd} disabled={!name.trim() || addBusy} loading={addBusy}>
                Add
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Players List */}
      <FlatList
        data={team.players}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              No players yet. Add some above.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={styles.playerCard} onPress={() => router.push(`/player/${item.id}`)}>
            <Card.Content style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                  {index + 1}. {item.name}
                </Text>
                {item.phoneNumber ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 1 }}>
                    {item.phoneNumber}
                  </Text>
                ) : null}
                <View style={styles.badgeRow}>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.battingStyle === 'right' ? 'RHB' : 'LHB'}
                    {item.bowlingStyle !== 'none' ? ` · ${item.bowlingStyle}` : ''}
                  </Text>
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
                <Text style={[styles.playerCode, { color: theme.colors.outlineVariant }]}>
                  Code: {getPlayerCode(item.id)}
                </Text>
              </View>
              {adminUnlocked && (
                <IconButton
                  icon="delete-outline"
                  iconColor={theme.colors.error}
                  size={20}
                  onPress={() => {
                    setDeleteError(null);
                    setDeleteDialogPlayer({ id: item.id, name: item.name });
                  }}
                />
              )}
            </Card.Content>
          </Card>
        )}
      />

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {team.players.length} player{team.players.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Delete Dialog */}
      <Portal>
        <Dialog visible={!!deleteDialogPlayer} onDismiss={() => { setDeleteDialogPlayer(null); setDeleteError(null); }}>
          <Dialog.Title>Remove Player</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Remove {deleteDialogPlayer?.name} from the team?</Text>
            {deleteError && (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>{deleteError}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDeleteDialogPlayer(null); setDeleteError(null); }}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={confirmDelete}>Remove</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formCard: { margin: 16, borderRadius: 12 },
  input: { marginBottom: 12 },
  label: { marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  playerCard: { marginBottom: 8, borderRadius: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center' },
  playerInfo: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  footer: { padding: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  playerCode: { fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
});
