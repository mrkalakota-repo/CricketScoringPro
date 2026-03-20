import { create } from 'zustand';
import type { League, LeagueFixture, LeagueStandingRow, FixtureNRRData, LeagueFormat } from '../engine/types';
import * as leagueRepo from '../db/repositories/league-repo';

interface LeagueStore {
  leagues: League[];
  fixtures: Record<string, LeagueFixture[]>;
  loading: boolean;
  loadLeagues: () => Promise<void>;
  loadFixtures: (leagueId: string) => Promise<void>;
  createLeague: (name: string, shortName: string, format?: LeagueFormat) => Promise<League>;
  updateLeague: (id: string, name: string, shortName: string) => Promise<void>;
  deleteLeague: (id: string) => Promise<void>;
  addTeamToLeague: (leagueId: string, teamId: string) => Promise<void>;
  removeTeamFromLeague: (leagueId: string, teamId: string) => Promise<void>;
  createFixture: (leagueId: string, team1Id: string, team2Id: string, venue: string, date: number, round?: number | null, bracketSlot?: number | null) => Promise<LeagueFixture>;
  generateKnockout: (leagueId: string, startDate: number, daysApart: number, venue: string) => Promise<void>;
  updateFixtureResult: (fixtureId: string, result: string, winnerTeamId: string | null, t1Score: string | null, t2Score: string | null, nrrData: FixtureNRRData | null) => Promise<void>;
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

  createLeague: async (name, shortName, format = 'round_robin') => {
    const league = await leagueRepo.createLeague(name, shortName, format);
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

  createFixture: async (leagueId, team1Id, team2Id, venue, date, round = null, bracketSlot = null) => {
    const fixture = await leagueRepo.createFixture(leagueId, team1Id, team2Id, venue, date, round, bracketSlot);
    set({ fixtures: { ...get().fixtures, [leagueId]: [...(get().fixtures[leagueId] ?? []), fixture] } });
    return fixture;
  },

  generateKnockout: async (leagueId, startDate, daysApart, venue) => {
    const league = get().leagues.find(l => l.id === leagueId);
    if (!league || league.teamIds.length < 2) return;

    const teams = [...league.teamIds];
    const MS_PER_DAY = 86_400_000;
    let date = startDate;
    let slot = 0;

    for (let i = 0; i + 1 < teams.length; i += 2) {
      await get().createFixture(leagueId, teams[i], teams[i + 1], venue, date, 1, slot++);
      date += daysApart * MS_PER_DAY;
    }

    // Odd team out → auto-advance bye (create a pre-completed fixture)
    if (teams.length % 2 === 1) {
      const byeTeam = teams[teams.length - 1];
      const byeFixture = await leagueRepo.createFixture(leagueId, byeTeam, byeTeam, venue, date, 1, slot);
      // Immediately mark as completed so auto-advance picks it up
      await leagueRepo.updateFixtureResult(byeFixture.id, 'Bye', byeTeam, null, null, null);
      const completedBye = { ...byeFixture, status: 'completed' as const, result: 'Bye', winnerTeamId: byeTeam };
      set({
        fixtures: {
          ...get().fixtures,
          [leagueId]: [...(get().fixtures[leagueId] ?? []), completedBye],
        },
      });
    }
  },

  updateFixtureResult: async (fixtureId, result, winnerTeamId, t1Score, t2Score, nrrData) => {
    await leagueRepo.updateFixtureResult(fixtureId, result, winnerTeamId, t1Score, t2Score, nrrData);

    // Update local state first
    const updated = { ...get().fixtures };
    let targetLeagueId: string | null = null;
    for (const leagueId of Object.keys(updated)) {
      const idx = updated[leagueId].findIndex(f => f.id === fixtureId);
      if (idx !== -1) {
        targetLeagueId = leagueId;
        updated[leagueId] = updated[leagueId].map(f =>
          f.id === fixtureId
            ? { ...f, status: 'completed' as const, result, winnerTeamId, team1Score: t1Score, team2Score: t2Score, nrrData, updatedAt: Date.now() }
            : f
        );
      }
    }
    set({ fixtures: updated });

    // Knockout auto-advance: if all fixtures in this round are done, generate next round
    if (!targetLeagueId) return;
    const league = get().leagues.find(l => l.id === targetLeagueId);
    if (league?.format !== 'knockout') return;

    const completedFixture = updated[targetLeagueId].find(f => f.id === fixtureId);
    const currentRound = completedFixture?.round;
    if (currentRound == null) return;

    const roundFixtures = updated[targetLeagueId]
      .filter(f => f.round === currentRound)
      .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));

    const allDone = roundFixtures.every(f => f.status === 'completed' || f.status === 'abandoned');
    if (!allDone) return;

    const winners = roundFixtures.map(f => f.winnerTeamId).filter(Boolean) as string[];
    if (winners.length < 2) return; // tournament over (1 winner remains)

    const nextRound = currentRound + 1;
    const nextDate = Date.now() + 7 * 86_400_000;
    for (let i = 0; i + 1 < winners.length; i += 2) {
      await get().createFixture(targetLeagueId, winners[i], winners[i + 1], completedFixture?.venue ?? '', nextDate, nextRound, i / 2);
    }
    // Odd winner → auto-bye into next-next round (create pre-completed)
    if (winners.length % 2 === 1) {
      const byeWinner = winners[winners.length - 1];
      const byeFixture = await leagueRepo.createFixture(targetLeagueId, byeWinner, byeWinner, '', nextDate, nextRound, Math.floor(winners.length / 2));
      await leagueRepo.updateFixtureResult(byeFixture.id, 'Bye', byeWinner, null, null, null);
      set({
        fixtures: {
          ...get().fixtures,
          [targetLeagueId]: [...(get().fixtures[targetLeagueId] ?? []), { ...byeFixture, status: 'completed' as const, result: 'Bye', winnerTeamId: byeWinner }],
        },
      });
    }
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

    // Convert cricket overs notation (18.3) to decimal (18.5 = 18 + 3/6)
    const oversToDecimal = (raw: number) => {
      const complete = Math.floor(raw);
      const balls = Math.round((raw - complete) * 10);
      return complete + balls / 6;
    };

    interface NRRAccum { runsScored: number; oversFaced: number; runsConceded: number; oversBowled: number; }
    const nrrMap: Record<string, NRRAccum> = {};
    for (const teamId of league.teamIds) {
      nrrMap[teamId] = { runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0 };
    }

    const map: Record<string, LeagueStandingRow> = {};
    for (const teamId of league.teamIds) {
      map[teamId] = { teamId, played: 0, won: 0, lost: 0, tied: 0, abandoned: 0, points: 0, nrr: 0 };
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
          r1.tied++; r2.tied++;
          r1.points++; r2.points++;
        } else if (f.winnerTeamId === f.team1Id) {
          r1.won++; r2.lost++;
          r1.points += 2;
        } else {
          r2.won++; r1.lost++;
          r2.points += 2;
        }

        // Accumulate NRR data when available
        if (f.nrrData) {
          const d = f.nrrData;
          const maxOversDecimal = d.maxOvers;
          // Team 1 batting: if all out treat as full quota
          const t1Faced = d.team1AllOut ? maxOversDecimal : oversToDecimal(d.team1OversRaw);
          // Team 2 batting: if all out treat as full quota
          const t2Faced = d.team2AllOut ? maxOversDecimal : oversToDecimal(d.team2OversRaw);

          const n1 = nrrMap[f.team1Id];
          const n2 = nrrMap[f.team2Id];
          if (n1) {
            n1.runsScored += d.team1Runs;
            n1.oversFaced += t1Faced;
            n1.runsConceded += d.team2Runs;
            n1.oversBowled += t2Faced;
          }
          if (n2) {
            n2.runsScored += d.team2Runs;
            n2.oversFaced += t2Faced;
            n2.runsConceded += d.team1Runs;
            n2.oversBowled += t1Faced;
          }
        }
      }
    }

    // Compute final NRR per team
    for (const teamId of league.teamIds) {
      const n = nrrMap[teamId];
      if (n && n.oversFaced > 0 && n.oversBowled > 0) {
        map[teamId].nrr = (n.runsScored / n.oversFaced) - (n.runsConceded / n.oversBowled);
      }
    }

    return Object.values(map).sort((a, b) =>
      b.points - a.points || b.nrr - a.nrr || b.won - a.won
    );
  },
}));
