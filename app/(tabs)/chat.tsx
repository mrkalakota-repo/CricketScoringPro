import { useCallback } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, useTheme, TouchableRipple, Chip, Button } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTeamStore } from '../../src/store/team-store';
import { usePrefsStore } from '../../src/store/prefs-store';
import { useChatStore } from '../../src/store/chat-store';
import { isCloudEnabled } from '../../src/config/supabase';
import type { Team } from '../../src/engine/types';
import { getAvatarColor } from '../../src/utils/avatar';

function TeamChatRow({ team, isDelegate, messageCount }: { team: Team; isDelegate: boolean; messageCount: number }) {
  const router = useRouter();
  const theme = useTheme();
  const color = getAvatarColor(team.name);
  const initials = team.shortName.substring(0, 2).toUpperCase();

  return (
    <TouchableRipple onPress={() => router.push(`/chat/${team.id}`)} borderless={false}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: color + '20', borderColor: color + '50', borderWidth: 1.5 }]}>
          <Text style={[styles.avatarText, { color }]}>{initials}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }} numberOfLines={1}>
            {team.name}
          </Text>
          <View style={styles.rowMeta}>
            {isDelegate && (
              <Chip compact icon="key" style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}
                textStyle={{ fontSize: 10, color: theme.colors.onSecondaryContainer }}>
                Delegate
              </Chip>
            )}
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {team.players.length} player{team.players.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {messageCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.badgeText}>{messageCount > 99 ? '99+' : messageCount}</Text>
          </View>
        )}
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} style={{ marginLeft: 4 }} />
      </View>
    </TouchableRipple>
  );
}

export default function ChatTab() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const teams = useTeamStore(s => s.teams);
  const { myTeamIds, delegateTeamIds } = usePrefsStore();
  const messages = useChatStore(s => s.messages);

  useFocusEffect(useCallback(() => {
    // nothing to load — messages are loaded on enter to each chat
  }, []));

  const accessibleTeamIds = new Set([...myTeamIds, ...delegateTeamIds]);
  const chatTeams = teams.filter(t => accessibleTeamIds.has(t.id));

  if (!isCloudEnabled) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="cloud-off-outline" size={56} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
          Chat requires cloud sync
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          Add your Supabase credentials to .env and restart to enable team chat.
        </Text>
      </View>
    );
  }

  if (chatTeams.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons name="chat-outline" size={56} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
          No teams yet
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
          Create or join a team to start chatting with your squad.
        </Text>
        <Button
          mode="contained"
          icon="shield-account"
          onPress={() => router.push('/(tabs)/teams')}
          style={{ marginTop: 20 }}
        >
          Go to Teams
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={chatTeams}
        keyExtractor={t => t.id}
        contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <TeamChatRow
              team={item}
              isDelegate={delegateTeamIds.includes(item.id) && !myTeamIds.includes(item.id)}
              messageCount={messages[item.id]?.length ?? 0}
            />
          </Card>
        )}
        ListHeaderComponent={
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
            {chatTeams.length} team{chatTeams.length !== 1 ? 's' : ''} — tap to open chat
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 12, overflow: 'hidden', marginBottom: 10 },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '900' },
  rowInfo: { flex: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  chip: { height: 20 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
