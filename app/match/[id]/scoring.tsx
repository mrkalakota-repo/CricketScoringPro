import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useResponsive } from '../../../src/hooks/useResponsive';
import { Text, Button, useTheme, Portal, Modal, Card, RadioButton, Surface, Dialog } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMatchStore } from '../../../src/store/match-store';
import { usePrefsStore } from '../../../src/store/prefs-store';
import * as cloudMatchRepo from '../../../src/db/repositories/cloud-match-repo';
import type { BallInput, DismissalType } from '../../../src/engine/types';
import { useRole } from '../../../src/hooks/useRole';
import { useSyncStatus } from '../../../src/hooks/useSyncStatus';
import { isCloudEnabled } from '../../../src/config/supabase';
import { formatOvers, formatBallOutcome } from '../../../src/utils/formatters';
import { getLiveFeed } from '../../../src/utils/commentary';
import { currentRunRate, requiredRunRate } from '../../../src/utils/cricket-math';
import { colors } from '../../../src/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const DISMISSAL_TYPES: { type: DismissalType; label: string }[] = [
  { type: 'bowled', label: 'Bowled' },
  { type: 'caught', label: 'Caught' },
  { type: 'lbw', label: 'LBW' },
  { type: 'run_out', label: 'Run Out' },
  { type: 'stumped', label: 'Stumped' },
  { type: 'hit_wicket', label: 'Hit Wicket' },
];

export default function ScoringScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    engine, recordBall, undoLastBall, setOpeners, setBowler,
    setNewBatter, retireBatter, swapStrike, startNextInnings, startSuperOver, saveMatch,
    syncMatchFromCloud, loadMatches,
  } = useMatchStore();
  const { myTeamIds, delegateTeamIds } = usePrefsStore();

  const { canScore } = useRole();
  const syncStatus = useSyncStatus();
  const { isSmallPhone, isTablet, height: screenHeight, modalMaxWidth } = useResponsive();

  const [isWide, setIsWide] = useState(false);
  const [isNoBall, setIsNoBall] = useState(false);
  const [isBye, setIsBye] = useState(false);
  const [isLegBye, setIsLegBye] = useState(false);

  const [recording, setRecording] = useState(false);

  // Modals
  const [wicketModal, setWicketModal] = useState(false);
  const [bowlerModal, setBowlerModal] = useState(false);
  const [openerModal, setOpenerModal] = useState(false);
  const [newBatterModal, setNewBatterModal] = useState(false);
  const [inningsCompleteModal, setInningsCompleteModal] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [retireModal, setRetireModal] = useState(false);
  const [retireBatsmanId, setRetireBatsmanId] = useState<string | null>(null);
  const [retireType, setRetireType] = useState<'retired_hurt' | 'retired_out'>('retired_hurt');

  // Selection state
  const [selectedDismissal, setSelectedDismissal] = useState<DismissalType>('bowled');
  const [selectedFielder, setSelectedFielder] = useState<string | null>(null);
  const [dismissedBatsmanId, setDismissedBatsmanId] = useState<string | null>(null);
  const [selectedBowler, setSelectedBowler] = useState<string | null>(null);
  const [selectedOpener1, setSelectedOpener1] = useState<string | null>(null);
  const [selectedOpener2, setSelectedOpener2] = useState<string | null>(null);
  const [selectedNewBatter, setSelectedNewBatter] = useState<string | null>(null);

  const matchId = Array.isArray(id) ? id[0] : id;
  const match = engine?.getMatch();
  const innings = engine?.getCurrentInnings();

  // Observer = owns team2 but NOT team1 (prevents cross-device double-scoring).
  // Team1 owners, delegates, and neutral scorers (no team ownership) can all score.
  const ownsTeam1 = match
    ? (myTeamIds.includes(match.team1.id) || delegateTeamIds.includes(match.team1.id))
    : false;
  const ownsTeam2 = match
    ? (myTeamIds.includes(match.team2.id) || delegateTeamIds.includes(match.team2.id))
    : false;
  const isHost = !(ownsTeam2 && !ownsTeam1);

  // Observer: sync live match state from cloud on every ball recorded by the host.
  const syncingRef = useRef(false);
  useEffect(() => {
    if (!matchId || isHost) return;
    const unsub = cloudMatchRepo.subscribeToLiveMatch(matchId, (status) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      syncMatchFromCloud(matchId).then(() => {
        syncingRef.current = false;
        if (status === 'completed') {
          loadMatches();
        }
      });
    });
    return unsub;
  }, [matchId, isHost]);

  // Check if we need openers — only auto-prompt the host
  const needsOpeners = innings && innings.status === 'in_progress' && !innings.currentStrikerId && innings.batters.length === 0;

  // Auto-show opener modal when openers are needed (host only)
  useEffect(() => {
    if (needsOpeners && !openerModal && isHost) {
      setOpenerModal(true);
    }
  }, [needsOpeners, isHost]);

  if (!match || !engine) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text variant="titleMedium">No active match</Text>
        <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 16 }}>Go Back</Button>
      </View>
    );
  }

  // Check if we need a bowler
  const needsBowler = innings && innings.status === 'in_progress' && !innings.currentBowlerId && innings.currentStrikerId;
  // Check if we need a new batter (after wicket)
  const needsNewBatter = innings && innings.status === 'in_progress' && (!innings.currentStrikerId || !innings.currentNonStrikerId) && innings.batters.length > 0 && innings.totalWickets < (match.config.playersPerSide - 1);
  // Innings complete
  const isInningsComplete = innings && (innings.status === 'completed' || innings.status === 'declared');
  const isMatchComplete = match.status === 'completed';

  // Get batting/bowling team players
  const battingTeamPlayers = innings?.battingTeamId === match.team1.id
    ? match.team1.players.filter(p => match.team1PlayingXI.includes(p.id))
    : match.team2.players.filter(p => match.team2PlayingXI.includes(p.id));

  const bowlingTeamPlayers = innings?.bowlingTeamId === match.team1.id
    ? match.team1.players.filter(p => match.team1PlayingXI.includes(p.id))
    : match.team2.players.filter(p => match.team2PlayingXI.includes(p.id));

  const battedPlayerIds = new Set(innings?.batters.map(b => b.playerId) ?? []);
  const availableBatters = battingTeamPlayers?.filter(p => !battedPlayerIds.has(p.id)) ?? [];

  const striker = engine.getStriker();
  const nonStriker = engine.getNonStriker();
  const bowler = engine.getCurrentBowler();
  const partnership = engine.getCurrentPartnership();
  const isFreeHit = engine.isFreeHit();

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return '?';
    const allPlayers = [...match.team1.players, ...match.team2.players];
    return allPlayers.find(p => p.id === playerId)?.name ?? '?';
  };

  const commentaryCtx = { getName: (id: string) => getPlayerName(id) };
  const liveFeed = innings ? getLiveFeed(innings.allBalls, commentaryCtx, 5) : [];

  const crr = innings ? currentRunRate(innings.totalRuns, innings.totalOvers, innings.totalBalls) : 0;
  const rrr = innings?.target && match.config.oversPerInnings
    ? requiredRunRate(
        innings.target,
        innings.totalRuns,
        innings.totalBalls > 0
          ? match.config.oversPerInnings - innings.totalOvers - 1
          : match.config.oversPerInnings - innings.totalOvers,
        innings.totalBalls > 0 ? 6 - innings.totalBalls : 0
      )
    : null;

  // Current over balls
  const currentOverBalls = innings?.allBalls.filter(b => b.overNumber === innings.totalOvers) ?? [];

  const clearExtras = () => {
    setIsWide(false);
    setIsNoBall(false);
    setIsBye(false);
    setIsLegBye(false);
  };

  const handleRun = (runs: number) => {
    if (recording) return;
    setRecording(true);
    const input: BallInput = {
      runs,
      isWide,
      isNoBall,
      isBye,
      isLegBye,
      dismissal: null,
      isBoundary: runs >= 4,
    };
    recordBall(input);
    clearExtras();

    // Check post-ball state
    setTimeout(() => {
      setRecording(false);
      const currentEngine = useMatchStore.getState().engine;
      if (!currentEngine) return;
      const currentInnings = currentEngine.getCurrentInnings();
      if (!currentInnings) return;

      if (currentInnings.status === 'completed' || currentInnings.status === 'declared') {
        setInningsCompleteModal(true);
      } else if (!currentInnings.currentBowlerId) {
        setBowlerModal(true);
      } else if (!currentInnings.currentStrikerId || !currentInnings.currentNonStrikerId) {
        setNewBatterModal(true);
      }
    }, 300);
  };

  const handleWicket = () => {
    setSelectedDismissal('bowled');
    setSelectedFielder(null);
    setDismissedBatsmanId(innings?.currentStrikerId ?? null);
    setWicketModal(true);
  };

  const confirmWicket = () => {
    setRecording(true);
    const input: BallInput = {
      runs: 0,
      isWide: false,
      isNoBall: false,
      isBye: false,
      isLegBye: false,
      dismissal: {
        type: selectedDismissal,
        fielderId: selectedFielder ?? undefined,
        batsmanId: dismissedBatsmanId ?? undefined,
      },
      isBoundary: false,
    };
    recordBall(input);
    setWicketModal(false);
    clearExtras();

    setTimeout(() => {
      const currentEngine = useMatchStore.getState().engine;
      if (!currentEngine) return;
      const currentInnings = currentEngine.getCurrentInnings();
      if (!currentInnings) return;

      if (currentInnings.status === 'completed' || currentInnings.status === 'declared') {
        setInningsCompleteModal(true);
      } else if (!currentInnings.currentStrikerId || !currentInnings.currentNonStrikerId) {
        setNewBatterModal(true);
      }
      setRecording(false);
    }, 300);
  };

  const handleUndo = () => {
    if (!engine.canUndo()) return;
    setShowUndoDialog(true);
  };

  const confirmUndo = () => {
    setShowUndoDialog(false);
    undoLastBall();
  };

  const handleSelectOpeners = () => {
    if (selectedOpener1 && selectedOpener2) {
      setOpeners(selectedOpener1, selectedOpener2);
      setOpenerModal(false);
      setBowlerModal(true);
    }
  };

  const handleSelectBowler = () => {
    if (selectedBowler) {
      setBowler(selectedBowler);
      setBowlerModal(false);
      setSelectedBowler(null);
    }
  };

  const handleSelectNewBatter = () => {
    if (selectedNewBatter) {
      setNewBatter(selectedNewBatter);
      setNewBatterModal(false);
      setSelectedNewBatter(null);

      // Check if bowler needed after setting batter
      setTimeout(() => {
        const currentEngine = useMatchStore.getState().engine;
        if (!currentEngine) return;
        const currentInnings = currentEngine.getCurrentInnings();
        if (currentInnings && !currentInnings.currentBowlerId) {
          setBowlerModal(true);
        }
      }, 100);
    }
  };

  const handleRetire = () => {
    setRetireBatsmanId(innings?.currentStrikerId ?? null);
    setRetireType('retired_hurt');
    setRetireModal(true);
  };

  const confirmRetire = () => {
    if (!retireBatsmanId) return;
    retireBatter(retireBatsmanId, retireType);
    setRetireModal(false);
    setRetireBatsmanId(null);
    // needsNewBatter will become true — the existing modal auto-shows via the post-ball check
    // but since no ball was recorded we trigger it manually
    setTimeout(() => {
      setSelectedNewBatter(null);
      setNewBatterModal(true);
    }, 100);
  };

  const handleNextInnings = async () => {
    setInningsCompleteModal(false);
    startNextInnings();
    await saveMatch();
    // Show opener selection
    setSelectedOpener1(null);
    setSelectedOpener2(null);
    setOpenerModal(true);
  };

  const battingTeamName = innings?.battingTeamId === match.team1.id ? match.team1.shortName : match.team2.shortName;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
      {/* Mini Scorecard */}
      <Surface style={[styles.scorecard, { backgroundColor: innings?.isSuperOver ? '#E65100' : theme.colors.primary }]} elevation={3}>
        {/* Sync status chip — top-right corner, only when cloud is enabled */}
        {isCloudEnabled && (
          <View style={styles.syncChip} pointerEvents="none">
            {syncStatus === 'syncing' && (
              <>
                <MaterialCommunityIcons name="cloud-upload-outline" size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.syncText}>Syncing…</Text>
              </>
            )}
            {syncStatus === 'offline' && (
              <>
                <MaterialCommunityIcons name="cloud-off-outline" size={11} color="#FFCC80" />
                <Text style={[styles.syncText, { color: '#FFCC80' }]}>Offline</Text>
              </>
            )}
            {syncStatus === 'synced' && (
              <>
                <MaterialCommunityIcons name="cloud-check-outline" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={[styles.syncText, { color: 'rgba(255,255,255,0.7)' }]}>Synced</Text>
              </>
            )}
          </View>
        )}
        {innings?.isSuperOver && (
          <View style={{ alignItems: 'center', marginBottom: 2 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 }}>⚡ SUPER OVER</Text>
          </View>
        )}
        <View style={styles.scoreRow}>
          <Text style={styles.teamLabel}>{battingTeamName}</Text>
          <Text style={[styles.scoreText, isSmallPhone && { fontSize: 26 }]}>
            {innings?.totalRuns ?? 0}/{innings?.totalWickets ?? 0}
          </Text>
          <Text style={styles.oversText}>
            ({formatOvers(innings?.totalOvers ?? 0, innings?.totalBalls ?? 0)} / 1)
          </Text>
        </View>
        <View style={styles.rateRow}>
          <Text style={styles.rateText}>CRR: {crr.toFixed(2)}</Text>
          {rrr !== null && <Text style={styles.rateText}>RRR: {rrr.toFixed(2)}</Text>}
          {innings?.target && (
            <Text style={styles.rateText}>
              Need {innings.target - innings.totalRuns} off {
                innings.isSuperOver
                  ? (6 - (innings.totalOvers * 6 + innings.totalBalls))
                  : match.config.oversPerInnings
                    ? (match.config.oversPerInnings * 6 - (innings.totalOvers * 6 + innings.totalBalls))
                    : '?'
              }
            </Text>
          )}
        </View>
        {isFreeHit && (
          <View style={styles.freeHitBadge}>
            <Text style={styles.freeHitText}>FREE HIT</Text>
          </View>
        )}
      </Surface>

      {/* Batter & Bowler Info */}
      <Surface style={[styles.playerInfo, { backgroundColor: theme.colors.surface }]} elevation={1}>
        <View style={styles.batterRow}>
          <View style={styles.batterInfo}>
            <Text style={[styles.playerName, { color: theme.colors.onSurface }, striker?.isOnStrike && { color: theme.colors.primary }]}>
              {striker ? `${getPlayerName(striker.playerId)}*` : '-'}
            </Text>
            <Text style={[styles.playerStats, { color: theme.colors.onSurfaceVariant }]}>
              {striker ? `${striker.runs} (${striker.ballsFaced})` : ''}
            </Text>
          </View>
          {canScore && isHost && !isMatchComplete && !isInningsComplete && striker && nonStriker && (
            <Pressable
              onPress={() => swapStrike()}
              style={[styles.swapButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}
            >
              <MaterialCommunityIcons name="swap-horizontal" size={18} color={theme.colors.primary} />
            </Pressable>
          )}
          <View style={styles.batterInfo}>
            <Text style={[styles.playerName, { color: theme.colors.onSurface }]}>
              {nonStriker ? getPlayerName(nonStriker.playerId) : '-'}
            </Text>
            <Text style={[styles.playerStats, { color: theme.colors.onSurfaceVariant }]}>
              {nonStriker ? `${nonStriker.runs} (${nonStriker.ballsFaced})` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.bowlerRow}>
          <Text style={[styles.bowlerLabel, { color: theme.colors.onSurfaceVariant }]}>Bowler: </Text>
          <Text style={[styles.playerName, { color: theme.colors.onSurface }]}>{bowler ? getPlayerName(bowler.playerId) : '-'}</Text>
          <Text style={[styles.playerStats, { color: theme.colors.onSurfaceVariant }]}>
            {bowler ? ` ${bowler.wickets}/${bowler.runsConceded} (${bowler.overs}.${bowler.ballsBowled})` : ''}
          </Text>
        </View>
        {partnership && (
          <Text style={[styles.partnershipText, { color: theme.colors.onSurfaceVariant }]}>
            Partnership: {partnership.runs} ({partnership.balls})
          </Text>
        )}
      </Surface>

      {/* This Over */}
      <View style={styles.thisOver}>
        <Text style={[styles.thisOverLabel, { color: theme.colors.onSurfaceVariant }]}>This Over: </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {currentOverBalls.map((ball, i) => (
            <View key={i} style={[
              styles.ballBubble,
              { backgroundColor: ball.dismissal ? colors.wicket :
                !ball.isLegal ? colors.wide :
                ball.runs === 4 ? colors.four :
                ball.runs === 6 ? colors.six :
                ball.runs === 0 ? colors.dot : colors.single }
            ]}>
              <Text style={styles.ballText}>{formatBallOutcome(ball)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Live Commentary Feed */}
      {liveFeed.length > 0 && (
        <View style={[styles.liveFeed, { backgroundColor: theme.colors.surfaceVariant }]}>
          {liveFeed.map((line, i) => (
            <Text
              key={i}
              style={[
                styles.liveFeedLine,
                { color: i === 0 ? theme.colors.onSurface : theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={2}
            >
              {line}
            </Text>
          ))}
        </View>
      )}

      {/* Observer banner — team2 admin watching live */}
      {canScore && !isHost && !isMatchComplete && (
        <View style={[styles.viewOnlyBanner, { backgroundColor: '#1565C0' }]}>
          <MaterialCommunityIcons name="eye-outline" size={16} color="#FFFFFF" />
          <Text variant="bodySmall" style={{ color: '#FFFFFF', flex: 1, fontWeight: '700' }}>
            Live viewing — {match?.team1.name ?? 'Host'} is scoring
          </Text>
          <Button
            mode="contained-tonal"
            compact
            icon="arrow-left"
            onPress={() => router.replace('/(tabs)/matches')}
            style={{ marginLeft: 8, borderRadius: 8 }}
            labelStyle={{ fontSize: 11 }}
            buttonColor="rgba(255,255,255,0.25)"
            textColor="#FFFFFF"
          >
            Exit
          </Button>
        </View>
      )}
      {/* View-only banner for non-scorers */}
      {!canScore && !isMatchComplete && (
        <View style={[styles.viewOnlyBanner, { backgroundColor: '#E65100' }]}>
          <MaterialCommunityIcons name="eye-outline" size={16} color="#FFFFFF" />
          <Text variant="bodySmall" style={{ color: '#FFFFFF', flex: 1, fontWeight: '700' }}>
            View only — your role does not have scoring permissions
          </Text>
          <Button
            mode="contained-tonal"
            compact
            icon="arrow-left"
            onPress={() => router.replace('/(tabs)/matches')}
            style={{ marginLeft: 8, borderRadius: 8 }}
            labelStyle={{ fontSize: 11 }}
            buttonColor="rgba(255,255,255,0.25)"
            textColor="#FFFFFF"
          >
            Exit
          </Button>
        </View>
      )}

      {/* Scoring Controls */}
      {canScore && isHost && !isMatchComplete && !isInningsComplete && (
        <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Extra Toggles */}
          <View style={styles.extrasRow}>
            <Pressable
              style={[styles.extraButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, isWide && styles.extraActive]}
              onPress={() => { setIsWide(!isWide); setIsBye(false); setIsLegBye(false); }}
            >
              <Text style={[styles.extraText, { color: theme.colors.onSurfaceVariant }, isWide && styles.extraTextActive]}>Wide</Text>
            </Pressable>
            <Pressable
              style={[styles.extraButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, isNoBall && styles.extraActive]}
              onPress={() => { setIsNoBall(!isNoBall); setIsWide(false); }}
            >
              <Text style={[styles.extraText, { color: theme.colors.onSurfaceVariant }, isNoBall && styles.extraTextActive]}>NB</Text>
            </Pressable>
            <Pressable
              style={[styles.extraButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, isBye && styles.extraActive]}
              onPress={() => { setIsBye(!isBye); setIsLegBye(false); setIsWide(false); }}
            >
              <Text style={[styles.extraText, { color: theme.colors.onSurfaceVariant }, isBye && styles.extraTextActive]}>Bye</Text>
            </Pressable>
            <Pressable
              style={[styles.extraButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, isLegBye && styles.extraActive]}
              onPress={() => { setIsLegBye(!isLegBye); setIsBye(false); setIsWide(false); }}
            >
              <Text style={[styles.extraText, { color: theme.colors.onSurfaceVariant }, isLegBye && styles.extraTextActive]}>LB</Text>
            </Pressable>
          </View>

          {/* Run Buttons */}
          <View style={styles.runsGrid}>
            {[0, 1, 2, 3].map(runs => (
              <Pressable
                key={runs}
                disabled={recording}
                style={[styles.runButton, { backgroundColor: runs === 0 ? theme.colors.surfaceVariant : theme.colors.primaryContainer, opacity: recording ? 0.5 : 1 }]}
                onPress={() => handleRun(runs)}
              >
                <Text style={[styles.runText, { color: theme.colors.onSurface }]}>{runs}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.runsGrid}>
            {[4, 5, 6].map(runs => (
              <Pressable
                key={runs}
                disabled={recording}
                style={[styles.runButton, {
                  backgroundColor: runs === 4 ? colors.four : runs === 6 ? colors.six : theme.colors.primaryContainer,
                  opacity: recording ? 0.5 : 1,
                }]}
                onPress={() => handleRun(runs)}
              >
                <Text style={[styles.runText, { color: runs === 4 || runs === 6 ? '#FFFFFF' : theme.colors.onSurface }]}>{runs}</Text>
              </Pressable>
            ))}
            <Pressable
              disabled={recording}
              style={[styles.runButton, { backgroundColor: '#FFCDD2', opacity: recording ? 0.5 : 1 }]}
              onPress={handleWicket}
            >
              <Text style={[styles.runText, { color: colors.wicket }]}>W</Text>
            </Pressable>
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <Button
              mode="outlined"
              icon="undo"
              onPress={handleUndo}
              disabled={!engine.canUndo()}
              compact
            >
              Undo
            </Button>
            {(striker || nonStriker) && (
              <Button
                mode="outlined"
                icon="account-arrow-right"
                onPress={handleRetire}
                compact
                textColor={theme.colors.error}
                style={{ borderColor: theme.colors.error }}
              >
                Retire
              </Button>
            )}
            <Button
              mode="text"
              onPress={() => router.push(`/match/${id}/scorecard`)}
              compact
            >
              Scorecard
            </Button>
            <Button
              mode="text"
              onPress={() => router.replace('/(tabs)/matches')}
              compact
            >
              Exit
            </Button>
          </View>
        </View>
      )}

      {/* Match Complete */}
      {isMatchComplete && (
        <View style={styles.matchComplete}>
          <MaterialCommunityIcons name="trophy" size={48} color={colors.secondary} />
          <Text variant="titleLarge" style={{ fontWeight: 'bold', marginTop: 16, color: theme.colors.onSurface }}>
            Match Complete
          </Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.primary, marginTop: 8, textAlign: 'center' }}>
            {match.result}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <Button mode="contained" onPress={() => router.push(`/match/${id}/scorecard`)}>
              View Scorecard
            </Button>
            <Button mode="outlined" onPress={async () => { await saveMatch(); router.replace('/'); }}>
              Home
            </Button>
          </View>
        </View>
      )}

      {/* ===== MODALS ===== */}

      {/* Opener Selection Modal */}
      <Portal>
        <Modal visible={openerModal} dismissable={false} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }, isTablet && { maxWidth: 500, alignSelf: 'center' as const }]}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16, color: theme.colors.onSurface }}>Select Opening Batters</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>Striker</Text>
          <ScrollView style={{ maxHeight: screenHeight * 0.22 }}>
            {(battingTeamPlayers ?? []).map(p => (
              <Pressable
                key={`o1-${p.id}`}
                style={[styles.selectionRow, selectedOpener1 === p.id && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => { setSelectedOpener1(p.id); if (selectedOpener2 === p.id) setSelectedOpener2(null); }}
              >
                <RadioButton value={p.id} status={selectedOpener1 === p.id ? 'checked' : 'unchecked'} onPress={() => { setSelectedOpener1(p.id); if (selectedOpener2 === p.id) setSelectedOpener2(null); }} />
                <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, marginBottom: 8 }}>Non-Striker</Text>
          <ScrollView style={{ maxHeight: screenHeight * 0.22 }}>
            {(battingTeamPlayers ?? []).filter(p => p.id !== selectedOpener1).map(p => (
              <Pressable
                key={`o2-${p.id}`}
                style={[styles.selectionRow, selectedOpener2 === p.id && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => setSelectedOpener2(p.id)}
              >
                <RadioButton value={p.id} status={selectedOpener2 === p.id ? 'checked' : 'unchecked'} onPress={() => setSelectedOpener2(p.id)} />
                <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button mode="contained" onPress={handleSelectOpeners} disabled={!selectedOpener1 || !selectedOpener2} style={{ marginTop: 16 }}>
            Confirm
          </Button>
        </Modal>
      </Portal>

      {/* Bowler Selection Modal */}
      <Portal>
        <Modal visible={bowlerModal} dismissable={false} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }, isTablet && { maxWidth: 500, alignSelf: 'center' as const }]}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16, color: theme.colors.onSurface }}>Select Bowler</Text>
          <ScrollView style={{ maxHeight: screenHeight * 0.45 }}>
            {(bowlingTeamPlayers ?? []).map(p => {
              const prevBowler = innings?.overs.length ? innings.overs[innings.overs.length - 1].bowlerId : null;
              const isSameAsPrev = p.id === prevBowler;
              const oversPerInnings = match.config.oversPerInnings;
              const maxOversPerBowler = oversPerInnings !== null ? Math.floor(oversPerInnings / 5) : null;
              const bowlerSpell = innings?.bowlers.find(b => b.playerId === p.id);
              const hasMaxOvers = maxOversPerBowler !== null && bowlerSpell !== undefined && bowlerSpell.overs >= maxOversPerBowler;
              const isDisabled = isSameAsPrev || hasMaxOvers;
              const disabledReason = isSameAsPrev ? ' (bowled last over)' : hasMaxOvers ? ` (max ${maxOversPerBowler} overs)` : '';
              return (
                <Pressable
                  key={p.id}
                  style={[styles.selectionRow, selectedBowler === p.id && { backgroundColor: theme.colors.primaryContainer }, isDisabled && { opacity: 0.4 }]}
                  onPress={() => !isDisabled && setSelectedBowler(p.id)}
                  disabled={isDisabled}
                >
                  <RadioButton value={p.id} status={selectedBowler === p.id ? 'checked' : 'unchecked'} onPress={() => !isDisabled && setSelectedBowler(p.id)} disabled={isDisabled} />
                  <View>
                    <Text style={[styles.modalName, { color: theme.colors.onSurface }, isDisabled && { color: theme.colors.onSurfaceVariant }]}>
                      {p.name}{disabledReason}
                    </Text>
                    {bowlerSpell && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {`${bowlerSpell.overs}.${bowlerSpell.ballsBowled}-${bowlerSpell.maidens}-${bowlerSpell.runsConceded}-${bowlerSpell.wickets}`}
                        {maxOversPerBowler !== null ? ` (${bowlerSpell.overs}/${maxOversPerBowler} overs)` : ''}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button mode="contained" onPress={handleSelectBowler} disabled={!selectedBowler} style={{ marginTop: 16 }}>
            Confirm
          </Button>
        </Modal>
      </Portal>

      {/* Wicket Modal */}
      <Portal>
        <Modal visible={wicketModal} onDismiss={() => setWicketModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }, isTablet && { maxWidth: 500, alignSelf: 'center' as const }]}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16, color: theme.colors.onSurface }}>Wicket!</Text>

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>Dismissed Batter</Text>
          <View style={styles.dismissedRow}>
            <Pressable
              style={[styles.selectionRow, { flex: 1 }, dismissedBatsmanId === innings?.currentStrikerId && { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => setDismissedBatsmanId(innings?.currentStrikerId ?? null)}
            >
              <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>{getPlayerName(innings?.currentStrikerId ?? null)}{'\n'}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>Striker</Text></Text>
            </Pressable>
            <Pressable
              style={[styles.selectionRow, { flex: 1 }, dismissedBatsmanId === innings?.currentNonStrikerId && { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => setDismissedBatsmanId(innings?.currentNonStrikerId ?? null)}
            >
              <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>{getPlayerName(innings?.currentNonStrikerId ?? null)}{'\n'}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>Non-striker</Text></Text>
            </Pressable>
          </View>

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 8 }}>Dismissal Type</Text>
          <View style={styles.dismissalGrid}>
            {DISMISSAL_TYPES.map(d => (
              <Pressable
                key={d.type}
                style={[styles.dismissalButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, selectedDismissal === d.type && { backgroundColor: colors.wicket, borderColor: colors.wicket }]}
                onPress={() => setSelectedDismissal(d.type)}
              >
                <Text style={[styles.dismissalText, { color: theme.colors.onSurface }, selectedDismissal === d.type && { color: '#FFF' }]}>
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {(selectedDismissal === 'caught' || selectedDismissal === 'run_out' || selectedDismissal === 'stumped') && (
            <>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, marginBottom: 8 }}>Fielder</Text>
              <ScrollView style={{ maxHeight: screenHeight * 0.18 }}>
                {(bowlingTeamPlayers ?? []).map(p => (
                  <Pressable
                    key={p.id}
                    style={[styles.selectionRow, selectedFielder === p.id && { backgroundColor: theme.colors.primaryContainer }]}
                    onPress={() => setSelectedFielder(p.id)}
                  >
                    <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>{p.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button mode="text" onPress={() => setWicketModal(false)}>Cancel</Button>
            <Button mode="contained" buttonColor={colors.wicket} onPress={confirmWicket}>Confirm</Button>
          </View>
        </Modal>
      </Portal>

      {/* New Batter Modal */}
      <Portal>
        <Modal visible={newBatterModal} dismissable={false} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }, isTablet && { maxWidth: 500, alignSelf: 'center' as const }]}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16, color: theme.colors.onSurface }}>Select New Batter</Text>
          <ScrollView style={{ maxHeight: screenHeight * 0.45 }}>
            {availableBatters.map(p => (
              <Pressable
                key={p.id}
                style={[styles.selectionRow, selectedNewBatter === p.id && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => setSelectedNewBatter(p.id)}
              >
                <RadioButton value={p.id} status={selectedNewBatter === p.id ? 'checked' : 'unchecked'} onPress={() => setSelectedNewBatter(p.id)} />
                <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Button mode="contained" onPress={handleSelectNewBatter} disabled={!selectedNewBatter} style={{ marginTop: 16 }}>
            Confirm
          </Button>
        </Modal>
      </Portal>

      {/* Innings Complete Modal */}
      <Portal>
        <Modal visible={inningsCompleteModal} dismissable={false} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8, color: theme.colors.onSurface }}>Innings Complete</Text>
          <Text variant="bodyMedium" style={{ marginBottom: 16, color: theme.colors.onSurfaceVariant }}>
            {battingTeamName}: {innings?.totalRuns}/{innings?.totalWickets} ({formatOvers(innings?.totalOvers ?? 0, innings?.totalBalls ?? 0)})
          </Text>
          {!isMatchComplete && match.innings.length < match.config.maxInnings ? (
            <Button mode="contained" onPress={handleNextInnings}>Start Next Innings</Button>
          ) : !isMatchComplete && innings?.isSuperOver ? (
            // Between super over innings 1 and 2
            <Button mode="contained" onPress={() => { startNextInnings(); setInningsCompleteModal(false); }}>
              Start Super Over — 2nd Innings
            </Button>
          ) : (
            <View style={{ gap: 10 }}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 4, color: theme.colors.onSurface }}>{match.result}</Text>
              {match.result === 'Match Tied' && match.config.maxInnings === 2 && (
                <Button mode="contained" icon="lightning-bolt" onPress={() => { startSuperOver(); setInningsCompleteModal(false); }}
                  style={{ backgroundColor: '#E65100' }}>
                  Play Super Over
                </Button>
              )}
              <Button mode="contained" onPress={async () => { await saveMatch(); setInningsCompleteModal(false); router.replace('/'); }}>
                Finish
              </Button>
            </View>
          )}
        </Modal>
      </Portal>

      {/* Retire Batter Modal */}
      <Portal>
        <Modal visible={retireModal} onDismiss={() => setRetireModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 16, color: theme.colors.onSurface }}>Retire Batter</Text>

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>Select Batter</Text>
          <View style={styles.dismissedRow}>
            {striker && (
              <Pressable
                style={[styles.selectionRow, { flex: 1 }, retireBatsmanId === innings?.currentStrikerId && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => setRetireBatsmanId(innings?.currentStrikerId ?? null)}
              >
                <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>
                  {getPlayerName(innings?.currentStrikerId ?? null)}
                  {'\n'}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>Striker</Text>
                </Text>
              </Pressable>
            )}
            {nonStriker && (
              <Pressable
                style={[styles.selectionRow, { flex: 1 }, retireBatsmanId === innings?.currentNonStrikerId && { backgroundColor: theme.colors.primaryContainer }]}
                onPress={() => setRetireBatsmanId(innings?.currentNonStrikerId ?? null)}
              >
                <Text style={[styles.modalName, { color: theme.colors.onSurface }]}>
                  {getPlayerName(innings?.currentNonStrikerId ?? null)}
                  {'\n'}<Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant, fontWeight: '400' }}>Non-striker</Text>
                </Text>
              </Pressable>
            )}
          </View>

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, marginBottom: 8 }}>Reason</Text>
          <View style={styles.dismissalGrid}>
            {([
              { type: 'retired_hurt' as const, label: 'Retired Hurt' },
              { type: 'retired_out' as const, label: 'Retired Out' },
            ]).map(opt => (
              <Pressable
                key={opt.type}
                style={[styles.dismissalButton, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }, retireType === opt.type && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                onPress={() => setRetireType(opt.type)}
              >
                <Text style={[styles.dismissalText, { color: theme.colors.onSurface }, retireType === opt.type && { color: '#FFF' }]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {retireType === 'retired_out' && (
            <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 8 }}>
              Retired Out counts as a wicket.
            </Text>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button mode="text" onPress={() => setRetireModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={confirmRetire} disabled={!retireBatsmanId}>Confirm</Button>
          </View>
        </Modal>
      </Portal>

      {/* Undo Confirmation Dialog */}
      <Portal>
        <Dialog visible={showUndoDialog} onDismiss={() => setShowUndoDialog(false)}>
          <Dialog.Title>Undo Last Ball</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Undo the last ball recorded?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowUndoDialog(false)}>Cancel</Button>
            <Button onPress={confirmUndo}>Undo</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Scorecard
  scorecard: { padding: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  teamLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  scoreText: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold' },
  oversText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  rateRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  rateText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  freeHitBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#FF9800', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  freeHitText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  // Player Info
  playerInfo: { margin: 12, padding: 12, borderRadius: 12 },
  batterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  batterInfo: { flex: 1 },
  swapButton: { padding: 6, borderRadius: 20, borderWidth: 1, marginHorizontal: 8 },
  playerName: { fontSize: 14, fontWeight: '600' },
  playerStats: { fontSize: 12 },
  bowlerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  bowlerLabel: { fontSize: 12 },
  partnershipText: { fontSize: 11, marginTop: 4 },

  // This Over
  thisOver: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  thisOverLabel: { fontSize: 12, marginRight: 8 },
  ballBubble: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginRight: 6,
  },
  ballText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  // Controls
  controls: { flex: 1, justifyContent: 'flex-end' },
  viewOnlyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 12, borderRadius: 10 },
  syncChip: { position: 'absolute', top: 8, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  syncText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  extrasRow: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, marginBottom: 12,
  },
  extraButton: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
  },
  extraActive: { backgroundColor: '#7B1FA2', borderColor: '#7B1FA2' },
  extraText: { fontSize: 13, fontWeight: '600' },
  extraTextActive: { color: '#FFF' },
  runsGrid: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    paddingHorizontal: 16, marginBottom: 10,
  },
  runButton: {
    flex: 1, maxWidth: 80, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    elevation: 2,
  },
  runText: { fontSize: 22, fontWeight: 'bold' },
  bottomActions: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, marginTop: 8,
  },

  // Match Complete
  matchComplete: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  // Modals
  modal: {
    margin: 24, padding: 24, borderRadius: 16,
    maxHeight: '80%',
  },
  selectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 8, borderRadius: 8,
  },
  modalName: { fontSize: 14, fontWeight: '600' },
  dismissedRow: { flexDirection: 'row', gap: 8 },
  dismissalGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  dismissalButton: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
  },
  dismissalText: { fontSize: 13, fontWeight: '600' },

  // Live Commentary Feed
  liveFeed: { paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  liveFeedLine: { fontSize: 12, lineHeight: 18 },
});
