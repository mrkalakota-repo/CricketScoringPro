import { useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { TextInput, Button, Text, Card, useTheme, IconButton, SegmentedButtons, Switch, Chip } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTeamStore } from '../../../src/store/team-store';
import { useAdminAuth } from '../../../src/hooks/useAdminAuth';
import { AdminPinModal } from '../../../src/components/AdminPinModal';
import { getPlayerCode } from '../../../src/utils/player-code';
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
  const isAdmin = useAdminAuth(s => s.isAdmin);
  const [showPinModal, setShowPinModal] = useState(false);

  const teamId = Array.isArray(id) ? id[0] : id;
  const adminUnlocked = team ? isAdmin(team.id, team.adminPinHash) : false;

  const [name, setName] = useState('');
  const [battingStyle, setBattingStyle] = useState('right');
  const [bowlingStyleIndex, setBowlingStyleIndex] = useState(0);
  const [isKeeper, setIsKeeper] = useState(false);
  const [isAllRounder, setIsAllRounder] = useState(false);
  const [isCaptain, setIsCaptain] = useState(false);
  const [showForm, setShowForm] = useState(false);

  if (!team) return <View style={styles.container}><Text>Team not found</Text></View>;

  const resetForm = () => {
    setName('');
    setBattingStyle('right');
    setBowlingStyleIndex(0);
    setIsKeeper(false);
    setIsAllRounder(false);
    setIsCaptain(false);
    setShowForm(false);
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (!teamId) return;
    try {
      await addPlayer(teamId, trimmedName, battingStyle, BOWLING_STYLES[bowlingStyleIndex], isKeeper, isAllRounder, isCaptain);
      resetForm();
    } catch (err) {
      Alert.alert('Error', 'Could not add player. Please try again.');
      console.error('[RosterScreen] addPlayer failed:', err);
    }
  };

  const handleDelete = (playerId: string, playerName: string) => {
    if (!teamId) return;
    Alert.alert('Remove Player', `Remove ${playerName} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlayer(playerId, teamId);
          } catch (err) {
            Alert.alert('Error', 'Could not remove player. Please try again.');
            console.error('[RosterScreen] deletePlayer failed:', err);
          }
        },
      },
    ]);
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

      {/* Add Player Section */}
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
            <Text variant="titleSmall" style={{ fontWeight: 'bold', marginBottom: 12 }}>New Player</Text>

            <TextInput
              label="Player Name"
              value={name}
              onChangeText={t => setName(t.substring(0, MAX_NAME_LENGTH))}
              mode="outlined"
              style={styles.input}
              autoFocus
              maxLength={MAX_NAME_LENGTH}
            />

            <Text variant="bodySmall" style={styles.label}>Batting Style</Text>
            <SegmentedButtons
              value={battingStyle}
              onValueChange={setBattingStyle}
              buttons={[
                { value: 'right', label: 'Right Hand' },
                { value: 'left', label: 'Left Hand' },
              ]}
              style={styles.input}
            />

            <Text variant="bodySmall" style={styles.label}>Bowling Style</Text>
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

            <View style={styles.toggleRow}>
              <Text variant="bodyMedium">Captain</Text>
              <Switch value={isCaptain} onValueChange={setIsCaptain} />
            </View>

            <View style={styles.toggleRow}>
              <Text variant="bodyMedium">Wicket Keeper</Text>
              <Switch value={isKeeper} onValueChange={setIsKeeper} />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text variant="bodyMedium">All-Rounder</Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>Bats and bowls</Text>
              </View>
              <Switch value={isAllRounder} onValueChange={setIsAllRounder} />
            </View>

            <View style={styles.formActions}>
              <Button mode="text" onPress={resetForm}>Cancel</Button>
              <Button mode="contained" onPress={handleAdd} disabled={!name.trim()}>Add</Button>
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
            <Text variant="bodyMedium" style={{ color: '#999' }}>No players yet. Add some above.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Card style={styles.playerCard} onPress={() => router.push(`/player/${item.id}`)}>
            <Card.Content style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <Text variant="titleSmall">{index + 1}. {item.name}</Text>
                <View style={styles.badgeRow}>
                  <Text variant="bodySmall" style={{ color: '#666' }}>
                    {item.battingStyle === 'right' ? 'RHB' : 'LHB'}
                    {item.bowlingStyle !== 'none' ? ` · ${item.bowlingStyle}` : ''}
                  </Text>
                  {!!item.isCaptain && (
                    <Chip compact style={[styles.badge, { backgroundColor: '#FFF3E0' }]} textStyle={{ fontSize: 10, color: '#E65100' }}>C</Chip>
                  )}
                  {!!item.isWicketKeeper && (
                    <Chip compact style={styles.badge} textStyle={{ fontSize: 10 }}>WK</Chip>
                  )}
                  {!!item.isAllRounder && (
                    <Chip compact style={[styles.badge, { backgroundColor: '#E8F5E9' }]} textStyle={{ fontSize: 10, color: '#2E7D32' }}>AR</Chip>
                  )}
                </View>
                <Text style={styles.playerCode}>Code: {getPlayerCode(item.id)}</Text>
              </View>
              {adminUnlocked && (
                <IconButton
                  icon="delete-outline"
                  iconColor={theme.colors.error}
                  size={20}
                  onPress={() => handleDelete(item.id, item.name)}
                />
              )}
            </Card.Content>
          </Card>
        )}
      />

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <Text variant="bodySmall" style={{ color: '#666' }}>
          {team.players.length} player{team.players.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  formCard: { margin: 16, borderRadius: 12 },
  input: { marginBottom: 12 },
  label: { marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  playerCard: { marginBottom: 8, borderRadius: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center' },
  playerInfo: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  badge: { height: 20, borderRadius: 4 },
  footer: { padding: 12, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  playerCode: { fontSize: 10, color: '#AAA', marginTop: 2, letterSpacing: 0.5 },
});
