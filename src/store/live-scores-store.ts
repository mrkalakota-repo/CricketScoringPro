import { create } from 'zustand';
import type { LiveMatchSummary } from '../db/repositories/cloud-match-repo';
import * as cloudMatchRepo from '../db/repositories/cloud-match-repo';
import * as Location from 'expo-location';

interface LiveScoresStore {
  matches: LiveMatchSummary[];
  loading: boolean;
  location: { lat: number; lon: number } | null;
  loadNearby: () => Promise<void>;
  subscribe: () => () => void;
}

export const useLiveScoresStore = create<LiveScoresStore>((set, get) => ({
  matches: [],
  loading: false,
  location: null,

  loadNearby: async () => {
    set({ loading: true });
    try {
      let loc = get().location;
      if (!loc) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          set({ location: loc });
        }
      }
      if (loc) {
        const matches = await cloudMatchRepo.fetchNearbyLiveMatches(loc.lat, loc.lon);
        set({ matches });
      }
    } catch (err) {
      console.error('[live-scores-store] loadNearby failed:', err);
    } finally {
      set({ loading: false });
    }
  },

  subscribe: () => {
    const loc = get().location;
    if (!loc) return () => {};
    return cloudMatchRepo.subscribeToNearbyLiveMatches(loc.lat, loc.lon, 80, (matches) => {
      set({ matches });
    });
  },
}));
