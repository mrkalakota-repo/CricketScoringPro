import { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, useTheme, Searchbar, Chip } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../src/store/team-store';
import { usePrefsStore } from '../../src/store/prefs-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Team } from '../../src/engine/types';
import * as Location from 'expo-location';

const NEARBY_LIMIT = 10;
const RADIUS_KM = 80.47; // 50 miles in km

const AVATAR_COLORS = [
  '#1B5E20', '#0D47A1', '#4A148C', '#BF360C',
  '#006064', '#E65100', '#37474F', '#880E4F',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  const miles = km / 1.60934;
  if (miles < 1) return `${Math.round(miles * 5280)} ft`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function TeamCard({ team, distance, isMyTeam }: { team: Team; distance?: number; isMyTeam?: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const avatarColor = getAvatarColor(team.name);
  const hasPin = !!team.adminPinHash;

  return (
    <Card
      style={[styles.card, isMyTeam && { borderWidth: 1.5, borderColor: theme.colors.primary + '60' }]}
      onPress={() => router.push(`/team/${team.id}`)}
    >
      <View style={[styles.colorStripe, { backgroundColor: isMyTeam ? theme.colors.primary : avatarColor }]} />
      <Card.Content style={styles.cardContent}>
        <View style={[styles.avatar, {
          backgroundColor: isMyTeam ? theme.colors.primary + '20' : avatarColor + '22',
          borderColor: isMyTeam ? theme.colors.primary + '60' : avatarColor + '55',
          borderWidth: 1.5,
        }]}>
          <Text style={[styles.avatarText, { color: isMyTeam ? theme.colors.primary : avatarColor }]}>
            {team.shortName.substring(0, 3)}
          </Text>
        </View>
        <View style={styles.cardText}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: '700', color: theme.colors.onSurface, flex: 1 }}
              numberOfLines={1}
            >
              {team.name}
            </Text>
            {isMyTeam && (
              <Chip
                compact
                style={{ backgroundColor: theme.colors.primary, height: 22 }}
                textStyle={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}
              >
                MY TEAM
              </Chip>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text variant="bodySmall" style={[styles.shortCode, { color: isMyTeam ? theme.colors.primary : avatarColor }]}>
              {team.shortName}
            </Text>
            <Text style={[styles.dot, { color: theme.colors.outlineVariant }]}>·</Text>
            <MaterialCommunityIcons name="account-multiple" size={12} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
              {team.players.length} {team.players.length !== 1 ? 'players' : 'player'}
            </Text>
            {hasPin && (
              <>
                <Text style={[styles.dot, { color: theme.colors.outlineVariant }]}>·</Text>
                <MaterialCommunityIcons name="shield-lock" size={12} color={theme.colors.onSurfaceVariant} />
              </>
            )}
            {distance !== undefined && distance < RADIUS_KM && !isMyTeam && (
              <>
                <Text style={[styles.dot, { color: theme.colors.outlineVariant }]}>·</Text>
                <MaterialCommunityIcons name="map-marker" size={12} color={theme.colors.primary} />
                <Text variant="bodySmall" style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' }}>
                  {formatDistance(distance)}
                </Text>
              </>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.outlineVariant} />
      </Card.Content>
    </Card>
  );
}

type LocationState = 'loading' | 'granted' | 'denied';

type ListItem =
  | { type: 'sectionHeader'; label: string; icon: string }
  | { type: 'team'; team: Team; distance: number; isMyTeam: boolean };

export default function TeamsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { teams, loading, loadTeams } = useTeamStore();
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const [query, setQuery] = useState('');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<LocationState>('loading');

  useFocusEffect(useCallback(() => { loadTeams(); }, []));

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocState('denied'); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setLocState('granted');
      } catch {
        setLocState('denied');
      }
    })();
  }, []);

  const fabBottom = Math.max(insets.bottom, 8) + 16;
  const isSearching = query.trim().length > 0;

  const teamsWithDist = teams.map(t => ({
    team: t,
    distance: (userLoc && t.latitude != null && t.longitude != null)
      ? haversineKm(userLoc.lat, userLoc.lng, t.latitude, t.longitude)
      : Infinity,
    isMyTeam: myTeamIds.includes(t.id),
  }));

  const myTeams = teamsWithDist.filter(t => t.isMyTeam);

  // Nearby teams: within radius, not "my team", capped at NEARBY_LIMIT
  const nearbyOthers = teamsWithDist
    .filter(t => !t.isMyTeam && t.distance <= RADIUS_KM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEARBY_LIMIT);

  // Search: all teams matching query
  const searchResults = teamsWithDist
    .filter(({ team }) => team.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.team.name.localeCompare(b.team.name));

  // Build sectioned list items
  const listItems: ListItem[] = [];

  if (isSearching) {
    if (searchResults.length > 0) {
      listItems.push({
        type: 'sectionHeader',
        label: `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${query}"`,
        icon: 'magnify',
      });
      searchResults.forEach(({ team, distance, isMyTeam }) =>
        listItems.push({ type: 'team', team, distance, isMyTeam })
      );
    }
  } else {
    // My Teams section
    if (myTeams.length > 0) {
      listItems.push({ type: 'sectionHeader', label: 'My Teams', icon: 'star-circle' });
      myTeams.forEach(({ team, distance, isMyTeam }) =>
        listItems.push({ type: 'team', team, distance, isMyTeam })
      );
    }

    // Nearby section (or all teams if location denied)
    if (locState === 'granted') {
      if (nearbyOthers.length > 0) {
        listItems.push({
          type: 'sectionHeader',
          label: `${nearbyOthers.length} team${nearbyOthers.length !== 1 ? 's' : ''} within 50 miles`,
          icon: 'map-marker-radius',
        });
        nearbyOthers.forEach(({ team, distance, isMyTeam }) =>
          listItems.push({ type: 'team', team, distance, isMyTeam })
        );
      } else if (myTeams.length === 0) {
        // No my teams and no nearby — show empty state via empty list
      }
    } else if (locState === 'denied') {
      const others = teamsWithDist
        .filter(t => !t.isMyTeam)
        .sort((a, b) => a.team.name.localeCompare(b.team.name));
      if (others.length > 0) {
        listItems.push({ type: 'sectionHeader', label: `All Teams (${others.length})`, icon: 'shield-account-outline' });
        others.forEach(({ team, distance, isMyTeam }) =>
          listItems.push({ type: 'team', team, distance, isMyTeam })
        );
      }
    }
  }

  const noNearbyTeams = locState === 'granted' && !isSearching && nearbyOthers.length === 0 && myTeams.length === 0;
  const outsideRadius = locState === 'granted' && !isSearching && teams.length - myTeams.length - nearbyOthers.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search all teams by name…"
        value={query}
        onChangeText={setQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
        inputStyle={{ fontSize: 14, color: theme.colors.onSurface }}
        iconColor={theme.colors.onSurfaceVariant}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        elevation={0}
      />

      <FlatList
        data={listItems}
        keyExtractor={(item, index) =>
          item.type === 'team' ? item.team.id : `header-${index}`
        }
        contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 56 }]}
        onRefresh={loadTeams}
        refreshing={loading}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name={noNearbyTeams ? 'map-marker-off-outline' : isSearching ? 'magnify' : 'shield-account-outline'}
              size={56}
              color={theme.colors.outlineVariant}
            />
            {isSearching ? (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                No teams match "{query}"
              </Text>
            ) : noNearbyTeams ? (
              <>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
                  No teams within 50 miles
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6, textAlign: 'center' }}>
                  Search above to find teams by name
                </Text>
              </>
            ) : (
              <>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                  No teams yet
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                  Tap + to create your first team
                </Text>
              </>
            )}
          </View>
        }
        ListFooterComponent={
          outsideRadius ? (
            <View style={[styles.searchHint, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="magnify" size={15} color={theme.colors.onSurfaceVariant} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}>
                More teams exist outside 50 miles — search by name to find them
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'sectionHeader') {
            return (
              <View style={[styles.sectionHeader, item.label === 'My Teams' && { marginTop: 4 }]}>
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={14}
                  color={item.label === 'My Teams' ? theme.colors.primary : theme.colors.primary}
                />
                <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700', letterSpacing: 0.3 }}>
                  {item.label}
                </Text>
              </View>
            );
          }
          return <TeamCard team={item.team} distance={item.distance} isMyTeam={item.isMyTeam} />;
        }}
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  colorStripe: { height: 4 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  avatar: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  cardText: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' },
  shortCode: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  dot: { fontSize: 12 },
  searchHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, marginHorizontal: 4, marginBottom: 8,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
  },
  emptyState: { alignItems: 'center', padding: 56 },
  fab: { position: 'absolute', right: 16, borderRadius: 28 },
});
