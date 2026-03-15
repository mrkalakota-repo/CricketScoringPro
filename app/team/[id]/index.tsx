import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Button, Avatar, useTheme, IconButton, Divider } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamStore } from '../../../src/store/team-store';

export default function TeamDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const deleteTeam = useTeamStore(s => s.deleteTeam);

  const team = teams.find(t => t.id === id);

  if (!team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleMedium" style={{ color: '#999' }}>Team not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: team.name }} />
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
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="account-plus"
          onPress={() => router.push(`/team/${id}/roster`)}
          style={styles.actionButton}
        >
          Manage Roster
        </Button>
        <Button
          mode="outlined"
          icon="pencil"
          onPress={() => router.push(`/team/${id}/edit`)}
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.emptyPlayers}>
            <Text variant="bodyMedium" style={{ color: '#999' }}>
              No players added yet
            </Text>
            <Button
              mode="contained"
              icon="account-plus"
              onPress={() => router.push(`/team/${id}/roster`)}
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
                <Text variant="titleSmall">{item.name}</Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  {item.battingStyle === 'right' ? 'RHB' : 'LHB'}
                  {item.bowlingStyle !== 'none' ? ` · ${item.bowlingStyle}` : ''}
                  {item.isWicketKeeper ? ' · WK' : ''}
                  {item.isAllRounder ? ' · AR' : ''}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      {/* Delete Team Button */}
      <View style={styles.deleteSection}>
        <Button
          mode="text"
          textColor={theme.colors.error}
          icon="delete"
          onPress={async () => {
            await deleteTeam(team.id);
            router.back();
          }}
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
  deleteSection: { padding: 16, alignItems: 'center' },
});
