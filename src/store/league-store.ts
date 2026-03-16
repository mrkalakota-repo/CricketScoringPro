import { create } from 'zustand';
import type { League, LeagueFixture, LeagueStandingRow } from '../engine/types';
import * as leagueRepo from '../db/repositories/league-repo';

interface LeagueStore {
  leagues: League[];
  fixtures: Record<string, LeagueFixture[]>;
  loading: boolean;
  loadLeagues: () => Promise<void>;
  loadFixtures: (leagueId: string) => Promise<void>;
  createLeague: (name: string, shortName: string) => Promise<League>;
  updateLeague: (id: string, name: string, shortName: string) => Promise<void>;
  deleteLeague: (id: string) => Promise<void>;
  addTeamToLeague: (leagueId: string, teamId: string) => Promise<void>;
  removeTeamFromLeague: (leagueId: string, teamId: string) => Promise<void>;
  createFixture: (leagueId: string, team1Id: string, team2Id: string, venue: string, date: number) => Promise<LeagueFixture>;
  updateFixtureResult: (fixtureId: string, result: string, winnerTeamId: string | null, t1Score: string | null, t2Score: string | null) => Promise<void>;
  deleteFixture: (fixtureId: string, leagueId: string) => Promise<void>;
  generateRoundRobin: (leagueId: string, startDate: number, daysApart: number, venue: string) => Promise<void>;
  computeStandings: (leagueId: string) => LeagueStandingRow[];
}

export const useLeagueStore = create<LeagueStore>((set, get) => ({
  leagues: [],
  fixtures: {},
  loading: false,

  loadLeagues: async () => {
    set({ loading: true });
    const leagues = await leagueRepo.getAllLeagues();
    set({ leagues, loading: false });
  },

  loadFixtures: async (leagueId) => {
    const fixtures = await leagueRepo.getFixturesForLeague(leagueId);
    set({ fixtures: { ...get().fixtures, [leagueId]: fixtures } });
  },

  createLeague: async (name, shortName) => {
    const league = await leagueRepo.createLeague(name, shortName);
    set({ leagues: [...get().leagues, league] });
    return league;
  },

  updateLeague: async (id, name, shortName) => {
    await leagueRepo.updateLeague(id, name, shortName);
    set({ leagues: get().leagues.map(l => l.id === id ? { ...l, name, shortName, updatedAt: Date.now() } : l) });
  },

  deleteLeague: async (id) => {
    await leagueRepo.deleteLeague(id);
    const { [id]: _, ...rest } = get().fixtures;
    set({ leagues: get().leagues.filter(l => l.id !== id), fixtures: rest });
  },

  addTeamToLeague: async (leagueId, teamId) => {
    await leagueRepo.addTeamToLeague(leagueId, teamId);
    set({
      leagues: get().leagues.map(l =>
        l.id === leagueId && !l.teamIds.includes(teamId)
          ? { ...l, teamIds: [...l.teamIds, teamId], updatedAt: Date.now() }
          : l
      ),
    });
  },

  removeTeamFromLeague: async (leagueId, teamId) => {
    await leagueRepo.removeTeamFromLeague(leagueId, teamId);
    set({
      leagues: get().leagues.map(l =>
        l.id === leagueId
          ? { ...l, teamIds: l.teamIds.filter(id => id !== teamId), updatedAt: Date.now() }
          : l
      ),
    });
  },

  createFixture: async (leagueId, team1Id, team2Id, venue, date) => {
    const fixture = await leagueRepo.createFixture(leagueId, team1Id, team2Id, venue, date);
    set({ fixtures: { ...get().fixtures, [leagueId]: [...(get().fixtures[leagueId] ?? []), fixture] } });
    return fixture;
  },

  updateFixtureResult: async (fixtureId, result, winnerTeamId, t1Score, t2Score) => {
    await leagueRepo.updateFixtureResult(fixtureId, result, winnerTeamId, t1Score, t2Score);
    const updated = { ...get().fixtures };
    for (const leagueId of Object.keys(updated)) {
      updated[leagueId] = updated[leagueId].map(f =>
        f.id === fixtureId
          ? { ...f, status: 'completed' as const, result, winnerTeamId, team1Score: t1Score, team2Score: t2Score, updatedAt: Date.now() }
          : f
      );
    }
    set({ fixtures: updated });
  },

  deleteFixture: async (fixtureId, leagueId) => {
    await leagueRepo.deleteFixture(fixtureId);
    set({
      fixtures: {
        ...get().fixtures,
        [leagueId]: (get().fixtures[leagueId] ?? []).filter(f => f.id !== fixtureId),
      },
    });
  },

  generateRoundRobin: async (leagueId, startDate, daysApart, venue) => {
    const league = get().leagues.find(l => l.id === leagueId);
    if (!league || league.teamIds.length < 2) return;
    const teams = league.teamIds;
    const pairs: [string, string][] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        pairs.push([teams[i], teams[j]]);
      }
    }
    const MS_PER_DAY = 86400000;
    for (let i = 0; i < pairs.length; i++) {
      const [t1, t2] = pairs[i];
      const date = startDate + i * daysApart * MS_PER_DAY;
      await get().createFixture(leagueId, t1, t2, venue, date);
    }
  },

  computeStandings: (leagueId) => {
    const fixtures = get().fixtures[leagueId] ?? [];
    const league = get().leagues.find(l => l.id === leagueId);
    if (!league) return [];

    const map: Record<string, LeagueStandingRow> = {};
    for (const teamId of league.teamIds) {
      map[teamId] = { teamId, played: 0, won: 0, lost: 0, tied: 0, abandoned: 0, points: 0 };
    }

    for (const f of fixtures) {
      if (f.status === 'scheduled') continue;
      const r1 = map[f.team1Id];
      const r2 = map[f.team2Id];
      if (!r1 || !r2) continue;

      if (f.status === 'abandoned') {
        r1.abandoned++; r2.abandoned++;
        r1.points++; r2.points++;
      } else if (f.status === 'completed') {
        r1.played++; r2.played++;
        if (!f.winnerTeamId) {
          // Tie
          r1.tied++; r2.tied++;
          r1.points++; r2.points++;
        } else if (f.winnerTeamId === f.team1Id) {
          r1.won++; r2.lost++;
          r1.points += 2;
        } else {
          r2.won++; r1.lost++;
          r2.points += 2;
        }
      }
    }

    return Object.values(map).sort((a, b) => b.points - a.points || b.won - a.won);
  },
}));
