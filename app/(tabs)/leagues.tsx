import { useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, useTheme, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLeagueStore } from '../../src/store/league-store';
import { useTeamStore } from '../../src/store/team-store';
import type { League } from '../../src/engine/types';

export default function LeaguesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { leagues, loading, loadLeagues } = useLeagueStore();
  const teams = useTeamStore(s => s.teams);
  const fabBottom = Math.max(insets.bottom, 8) + 16;

  useFocusEffect(useCallback(() => { loadLeagues(); }, []));

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.shortName ?? '???';

  const renderLeague = ({ item }: { item: League }) => (
    <Card style={styles.card} onPress={() => router.push(`/league/${item.id}`)}>
      <Card.Content style={styles.cardContent}>
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="tournament" size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.info}>
          <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '800', letterSpacing: 0.5 }}>
              {item.shortName}
            </Text>
            <Text style={{ color: theme.colors.outlineVariant }}>·</Text>
            <MaterialCommunityIcons name="shield-account" size={13} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {item.teamIds.length} {item.teamIds.length === 1 ? 'team' : 'teams'}
            </Text>
            {item.teamIds.length > 0 && (
              <>
                <Text style={{ color: theme.colors.outlineVariant }}>·</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                  {item.teamIds.slice(0, 3).map(getTeamName).join(', ')}
                  {item.teamIds.length > 3 ? ` +${item.teamIds.length - 3}` : ''}
                </Text>
              </>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.outlineVariant} />
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={leagues}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 56 }]}
        refreshing={loading}
        onRefresh={loadLeagues}
        renderItem={renderLeague}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="tournament" size={56} color={theme.colors.outlineVariant} />
            <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
              No leagues yet
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, textAlign: 'center' }}>
              Tap + to create a league and invite teams
            </Text>
          </View>
        }
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: fabBottom }]}
        color="#FFFFFF"
        onPress={() => router.push('/league/create')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  card: { marginBottom: 12, borderRadius: 16 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  badge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, minWidth: 0 },
  empty: { alignItems: 'center', padding: 56 },
  fab: { position: 'absolute', right: 16, borderRadius: 28 },
});
