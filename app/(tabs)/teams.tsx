import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, FlatList, Platform } from 'react-native';
import { Text, Card, FAB, useTheme, Searchbar, ActivityIndicator } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../src/store/team-store';
import { usePrefsStore } from '../../src/store/prefs-store';
import { useRole } from '../../src/hooks/useRole';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Team } from '../../src/engine/types';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

// Xcode default simulated location — used when running on iOS simulator with no GPS fix
const SIMULATOR_DEFAULT_LOC = { lat: 37.3318, lng: -122.0312 };
import * as cloudRepo from '../../src/db/repositories/cloud-team-repo';
import { isCloudEnabled } from '../../src/config/supabase';
import { getAvatarColor } from '../../src/utils/avatar';

const NEARBY_LIMIT = 10;
const RADIUS_KM = 80.47; // 50 miles

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

function TeamCard({ team, distance, isMyTeam, isPlayerTeam }: { team: Team; distance?: number; isMyTeam?: boolean; isPlayerTeam?: boolean }) {
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
          backgroundColor: isMyTeam ? theme.colors.primary : avatarColor,
        }]}>
          <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
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
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="star-circle" size={11} color="#FFFFFF" />
                <Text style={styles.badgeText}>MY TEAM</Text>
              </View>
            )}
            {isPlayerTeam && !isMyTeam && (
              <View style={[styles.badge, { backgroundColor: theme.colors.secondary }]}>
                <MaterialCommunityIcons name="account-circle" size={11} color="#FFFFFF" />
                <Text style={styles.badgeText}>PLAYER</Text>
              </View>
            )}
          </View>
          <View style={styles.metaRow}>
            <Text variant="bodySmall" style={[styles.shortCode, { color: isMyTeam ? theme.colors.primary : avatarColor, opacity: 1 }]}>
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
            {distance !== undefined && isFinite(distance) && (
              <>
                <Text style={[styles.dot, { color: isMyTeam ? 'rgba(255,255,255,0.4)' : theme.colors.outlineVariant }]}>·</Text>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={12}
                  color={isMyTeam ? 'rgba(255,255,255,0.85)' : theme.colors.primary}
                />
                <Text variant="bodySmall" style={{
                  color: isMyTeam ? 'rgba(255,255,255,0.85)' : theme.colors.primary,
                  fontSize: 12, fontWeight: '600',
                }}>
                  {formatDistance(distance)}
                </Text>
              </>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
      </Card.Content>
    </Card>
  );
}

type LocationState = 'loading' | 'granted' | 'denied';
type CloudState = 'idle' | 'syncing' | 'done' | 'error';

type ListItem =
  | { type: 'sectionHeader'; label: string; icon: string }
  | { type: 'team'; team: Team; distance: number; isMyTeam: boolean; isPlayerTeam: boolean };

export default function TeamsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { teams, loading, loadTeams, importCloudTeams } = useTeamStore();
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const playerTeamIds = usePrefsStore(s => s.playerTeamIds);
  const [query, setQuery] = useState('');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locState, setLocState] = useState<LocationState>('loading');
  const [cloudState, setCloudState] = useState<CloudState>('idle');
  const [needsSync, setNeedsSync] = useState(true); // triggers cloud fetch when true + location ready
  const lastSyncTimeRef = useRef(0);
  const SYNC_COOLDOWN_MS = 60_000;

  useFocusEffect(useCallback(() => {
    loadTeams();
    const now = Date.now();
    if (now - lastSyncTimeRef.current > SYNC_COOLDOWN_MS) {
      setNeedsSync(true);
    }
  }, []));

  // Request location once on mount — fast-path via last-known, then fresh fix with manual timeout.
  // NOTE: expo-location has no built-in timeout option; getCurrentPositionAsync hangs indefinitely
  // on iOS without one. Use Promise.race to enforce a 10 s cap.
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocState('denied'); return; }

        // 1. Instant cache hit (iOS fast path)
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
        if (lastKnown) {
          setUserLoc({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
          setLocState('granted');
          return;
        }

        // 2. Fresh fix with a hard 10 s timeout via Promise.race
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('location_timeout')), 10_000)
        );
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          timeout,
        ]);
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setLocState('granted');
      } catch {
        // 3. Last-known with no maxAge constraint (stale is better than nothing)
        try {
          const fallback = await Location.getLastKnownPositionAsync();
          if (fallback) {
            setUserLoc({ lat: fallback.coords.latitude, lng: fallback.coords.longitude });
            setLocState('granted');
            return;
          }
        } catch {}

        // 4. iOS simulator has no real GPS — fall back to Xcode default location
        //    so nearby cloud sync still runs during development.
        if (Platform.OS === 'ios' && !Constants.isDevice) {
          setUserLoc(SIMULATOR_DEFAULT_LOC);
          setLocState('granted');
          return;
        }

        setLocState('denied');
      }
    })();
  }, []);

  // Fetch nearby teams whenever location is available AND a sync is needed
  useEffect(() => {
    if (!userLoc || !needsSync || !isCloudEnabled) return;
    setNeedsSync(false); // consume the trigger immediately to prevent double-fire

    (async () => {
      setCloudState('syncing');
      try {
        const cloudTeams = await cloudRepo.fetchNearbyTeams(
          userLoc.lat, userLoc.lng, RADIUS_KM, myTeamIds
        );
        await importCloudTeams(cloudTeams, myTeamIds);
        setCloudState('done');
        lastSyncTimeRef.current = Date.now();
      } catch {
        setCloudState('error');
      }
    })();
  }, [userLoc, needsSync]);

  // Cloud search: when user types, also search cloud for teams not in local store
  useEffect(() => {
    if (!isCloudEnabled) return;
    if (query.trim().length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const localIds = teams.map(t => t.id);
        const cloudResults = await cloudRepo.searchCloudTeams(query.trim(), localIds);
        if (cloudResults.length > 0) {
          await importCloudTeams(cloudResults, myTeamIds);
        }
      } catch {
        // silent — local search still works
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const { canManageTeams } = useRole();
  const fabBottom = Math.max(insets.bottom, 8) + 16;
  const isSearching = query.trim().length > 0;

  const handleRefresh = useCallback(async () => {
    await loadTeams();
    if (userLoc) {
      setCloudState('syncing');
      try {
        const cloudTeams = await cloudRepo.fetchNearbyTeams(
          userLoc.lat, userLoc.lng, RADIUS_KM, myTeamIds
        );
        await importCloudTeams(cloudTeams, myTeamIds);
        setCloudState('done');
        lastSyncTimeRef.current = Date.now();
      } catch {
        setCloudState('error');
      }
    }
  }, [userLoc, myTeamIds, loadTeams, importCloudTeams]);

  const searchbarStyle = useMemo(
    () => [styles.searchbar, { backgroundColor: theme.colors.surface }],
    [theme.colors.surface]
  );
  const searchbarInputStyle = useMemo(
    () => ({ fontSize: 14, color: theme.colors.onSurface }),
    [theme.colors.onSurface]
  );

  const teamsWithDist = useMemo(() => teams.map(t => ({
    team: t,
    distance: (userLoc && t.latitude != null && t.longitude != null)
      ? haversineKm(userLoc.lat, userLoc.lng, t.latitude, t.longitude)
      : Infinity,
    isMyTeam: myTeamIds.includes(t.id),
    isPlayerTeam: playerTeamIds.includes(t.id),
  })), [teams, userLoc, myTeamIds, playerTeamIds]);

  // "My Teams" section = owned + player teams
  const myTeams = useMemo(() =>
    teamsWithDist.filter(t => t.isMyTeam || t.isPlayerTeam),
  [teamsWithDist]);

  const nearbyOthers = useMemo(() => teamsWithDist
    .filter(t => !t.isMyTeam && !t.isPlayerTeam && t.distance <= RADIUS_KM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEARBY_LIMIT),
  [teamsWithDist]);

  const searchResults = useMemo(() => teamsWithDist
    .filter(({ team }) => team.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.team.name.localeCompare(b.team.name)),
  [teamsWithDist, query]);

  // Build sectioned list
  const listItems: ListItem[] = [];

  if (isSearching) {
    if (searchResults.length > 0) {
      listItems.push({
        type: 'sectionHeader',
        label: `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${query}"`,
        icon: 'magnify',
      });
      searchResults.forEach(({ team, distance, isMyTeam, isPlayerTeam }) =>
        listItems.push({ type: 'team', team, distance, isMyTeam, isPlayerTeam })
      );
    }
  } else {
    if (myTeams.length > 0) {
      listItems.push({ type: 'sectionHeader', label: 'My Teams', icon: 'star-circle' });
      myTeams.forEach(({ team, distance, isMyTeam, isPlayerTeam }) =>
        listItems.push({ type: 'team', team, distance, isMyTeam, isPlayerTeam })
      );
    }

    if (locState === 'granted') {
      if (nearbyOthers.length > 0) {
        listItems.push({
          type: 'sectionHeader',
          label: `${nearbyOthers.length} team${nearbyOthers.length !== 1 ? 's' : ''} within 50 miles`,
          icon: 'map-marker-radius',
        });
        nearbyOthers.forEach(({ team, distance, isMyTeam, isPlayerTeam }) =>
          listItems.push({ type: 'team', team, distance, isMyTeam, isPlayerTeam })
        );
      }
    } else if (locState === 'denied') {
      const others = teamsWithDist
        .filter(t => !t.isMyTeam && !t.isPlayerTeam)
        .sort((a, b) => a.team.name.localeCompare(b.team.name));
      if (others.length > 0) {
        listItems.push({ type: 'sectionHeader', label: `All Teams (${others.length})`, icon: 'shield-account-outline' });
        others.forEach(({ team, distance, isMyTeam, isPlayerTeam }) =>
          listItems.push({ type: 'team', team, distance, isMyTeam, isPlayerTeam })
        );
      }
    }
  }

  const noNearbyTeams = locState === 'granted' && !isSearching && nearbyOthers.length === 0 && myTeams.length === 0;
  const outsideRadius = locState === 'granted' && !isSearching &&
    teamsWithDist.filter(t => !t.isMyTeam && !t.isPlayerTeam && t.distance > RADIUS_KM).length > 0;

  return (
    <View testID="teams-screen" style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Search all teams by name…"
        value={query}
        onChangeText={setQuery}
        style={searchbarStyle}
        inputStyle={searchbarInputStyle}
        iconColor={theme.colors.onSurfaceVariant}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        elevation={0}
      />

      {/* Cloud sync status banner */}
      {isCloudEnabled && cloudState === 'syncing' && (
        <View style={[styles.syncBanner, { backgroundColor: theme.colors.primaryContainer }]}>
          <ActivityIndicator size={12} color={theme.colors.primary} />
          <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, marginLeft: 6 }}>
            Finding nearby teams…
          </Text>
        </View>
      )}
      {isCloudEnabled && !userLoc && locState === 'loading' && (
        <View style={[styles.syncBanner, { backgroundColor: theme.colors.surfaceVariant }]}>
          <ActivityIndicator size={12} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 6 }}>
            Getting location…
          </Text>
        </View>
      )}

      <FlatList
        data={listItems}
        keyExtractor={(item, index) =>
          item.type === 'team' ? item.team.id : `header-${index}`
        }
        contentContainerStyle={[styles.list, { paddingBottom: fabBottom + 56 }]}
        onRefresh={handleRefresh}
        refreshing={loading || cloudState === 'syncing'}
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
                  color={theme.colors.primary}
                />
                <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700', letterSpacing: 0.3 }}>
                  {item.label}
                </Text>
              </View>
            );
          }
          return <TeamCard team={item.team} distance={item.distance} isMyTeam={item.isMyTeam} isPlayerTeam={item.isPlayerTeam} />;
        }}
      />

      {canManageTeams && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary, bottom: fabBottom }]}
          color="#FFFFFF"
          onPress={() => router.push('/team/create')}
          testID="teams-create-team-btn"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 12, borderRadius: 12 },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 4 },
  list: { padding: 16, paddingTop: 4 },
  card: { marginBottom: 12, borderRadius: 16 },
  colorStripe: { height: 4, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  avatar: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  avatarText: { fontSize: 14, fontWeight: '900', letterSpacing: 1, color: '#FFFFFF' },
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.5 },
  fab: { position: 'absolute', right: 16, borderRadius: 28 },
});
