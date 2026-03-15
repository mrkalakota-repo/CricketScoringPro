import { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, useTheme, Avatar, Searchbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../src/store/team-store';

export default function TeamsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { teams, loading, loadTeams } = useTeamStore();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? teams.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : teams;

  const fabBottom = Math.max(insets.bottom, 8) + 16;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search teams…"
        value={query}
        onChangeText={setQuery}
        style={styles.searchbar}
        inputStyle={{ fontSize: 14 }}
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 56 }]}
        onRefresh={loadTeams}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {query ? (
              <Text variant="bodyMedium" style={{ color: '#999' }}>No teams match "{query}"</Text>
            ) : (
              <>
                <Text variant="titleMedium" style={{ color: '#999' }}>No teams yet</Text>
                <Text variant="bodyMedium" style={{ color: '#BBB', marginTop: 8 }}>
                  Tap + to create your first team
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => router.push(`/team/${item.id}`)}
          >
            <Card.Content style={styles.cardContent}>
              <Avatar.Text
                size={48}
                label={item.shortName.substring(0, 3)}
                style={{ backgroundColor: theme.colors.primary }}
                labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
              />
              <View style={styles.cardText}>
                <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                  {item.name}
                </Text>
                <Text variant="bodySmall" style={{ color: '#666' }}>
                  {item.players.length} player{item.players.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: fabBottom }]}
        color="#FFFFFF"
        onPress={() => router.push('/team/create')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 12, borderRadius: 12 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 12, borderRadius: 12 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardText: { flex: 1 },
  emptyState: { alignItems: 'center', padding: 48 },
  fab: { position: 'absolute', right: 16, borderRadius: 28 },
});
