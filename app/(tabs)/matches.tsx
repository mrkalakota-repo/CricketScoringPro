import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, useTheme, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMatchStore } from '../../src/store/match-store';

export default function MatchesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { matches, loading, loadMatches } = useMatchStore();

  const fabBottom = Math.max(insets.bottom, 8) + 16;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return '#F44336';
      case 'completed': return '#4CAF50';
      case 'scheduled': return '#2196F3';
      case 'toss': return '#FF9800';
      default: return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'Live';
      case 'completed': return 'Completed';
      case 'scheduled': return 'Scheduled';
      case 'toss': return 'Toss';
      default: return status;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={matches}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 56 }]}
        onRefresh={loadMatches}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text variant="titleMedium" style={{ color: '#999' }}>No matches yet</Text>
            <Text variant="bodyMedium" style={{ color: '#BBB', marginTop: 8 }}>
              Tap + to create your first match
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => {
              if (item.status === 'in_progress' || item.status === 'toss') {
                router.push(`/match/${item.id}/scoring`);
              } else {
                router.push(`/match/${item.id}`);
              }
            }}
          >
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                  {item.format.toUpperCase()} Match
                </Text>
                <Chip
                  compact
                  textStyle={{ fontSize: 10, color: '#FFF' }}
                  style={{ backgroundColor: getStatusColor(item.status) }}
                >
                  {getStatusLabel(item.status)}
                </Chip>
              </View>
              {item.venue ? (
                <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                  {item.venue}
                </Text>
              ) : null}
              {item.result ? (
                <Text variant="bodySmall" style={{ color: theme.colors.primary, marginTop: 4, fontWeight: '600' }}>
                  {item.result}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={{ color: '#999', marginTop: 4 }}>
                {new Date(item.match_date).toLocaleDateString()}
              </Text>
            </Card.Content>
          </Card>
        )}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: fabBottom }]}
        color="#FFFFFF"
        onPress={() => router.push('/match/create')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  card: { marginBottom: 12, borderRadius: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyState: { alignItems: 'center', padding: 48 },
  fab: { position: 'absolute', right: 16, borderRadius: 28 },
});
