import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { Text, Button, useTheme, Divider, ActivityIndicator } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlan, PLAN_PRICING, PLAN_LABELS } from '../src/hooks/usePlan';
import { useUserAuth } from '../src/hooks/useUserAuth';
import { usePrefsStore } from '../src/store/prefs-store';
import { supabase } from '../src/config/supabase';
import { useTeamStore } from '../src/store/team-store';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '../src/services/purchases';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import type { UserPlan } from '../src/engine/types';

// ── Feature list per tier ─────────────────────────────────────────────────────

const FREE_FEATURES = [
  '1 team (up to 15 players)',
  'Unlimited match scoring',
  'Ball-by-ball undo & live scorecard',
  'Basic player stats',
  'Match history stored locally',
];

const PRO_FEATURES = [
  'Everything in Starter',
  'Up to 3 teams',
  'Cloud sync & cross-device restore',
  'Real-time team chat',
  'Delegate access codes',
  'Scorecard export & sharing',
  'Up to 2 leagues',
  'Scorers on your team get Pro features',
];

const LEAGUE_FEATURES = [
  'Everything in Pro',
  'Unlimited teams & players',
  'Unlimited leagues & knockout brackets',
  'NRR tracking & standings tables',
  'Fixture scheduling & match verification',
  'Data export (CSV)',
  'All team members inherit Pro features',
];

// ── Tier card ─────────────────────────────────────────────────────────────────

interface TierCardProps {
  tierPlan: UserPlan;
  currentPlan: UserPlan;
  annual: boolean;
  features: string[];
  onUpgrade: (plan: UserPlan) => void;
  loading: boolean;
}

function TierCard({ tierPlan, currentPlan, annual, features, onUpgrade, loading }: TierCardProps) {
  const theme = useTheme();
  const isCurrent = currentPlan === tierPlan;
  const isDowngrade = tierPlan === 'free' ||
    (tierPlan === 'pro' && currentPlan === 'league');
  const isFree = tierPlan === 'free';
  const isHighlighted = tierPlan === 'pro';

  const price = isFree ? 0 : annual
    ? PLAN_PRICING[tierPlan as 'pro' | 'league'].annualMonthlyEquiv
    : PLAN_PRICING[tierPlan as 'pro' | 'league'].monthly;

  const priceLabel = isFree
    ? 'Free forever'
    : annual
      ? `$${PLAN_PRICING[tierPlan as 'pro' | 'league'].annualMonthlyEquiv.toFixed(2)}/mo · billed annually`
      : `$${(price as number).toFixed(2)}/mo`;

  const isLeague = tierPlan === 'league';

  const headerBg = isFree
    ? theme.colors.surfaceVariant
    : isHighlighted
      ? theme.colors.primary
      : isLeague
        ? '#1A237E'
        : theme.colors.onSurface;

  const headerText = isFree ? theme.colors.onSurfaceVariant : '#FFFFFF';
  const borderColor = isHighlighted ? theme.colors.primary : theme.colors.outlineVariant;

  return (
    <View style={[styles.tierCard, { borderColor }, isHighlighted && styles.tierCardFeatured]} testID={`upgrade-tier-${tierPlan}`}>
      {/* Header */}
      <View style={[styles.tierHeader, { backgroundColor: headerBg }]}>
        {isHighlighted && (
          <View style={[styles.popularBadge, { backgroundColor: '#F9A825' }]}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        )}
        <Text style={[styles.tierName, { color: headerText }]}>{PLAN_LABELS[tierPlan]}</Text>
        <Text style={[styles.tierPrice, { color: headerText }]}>
          {isFree ? '$0' : `$${annual ? PLAN_PRICING[tierPlan as 'pro' | 'league'].annual : PLAN_PRICING[tierPlan as 'pro' | 'league'].monthly}`}
          {!isFree && <Text style={[styles.tierPriceSub, { color: headerText + 'CC' }]}>{annual ? '/yr' : '/mo'}</Text>}
        </Text>
        <Text style={[styles.tierPriceLabel, { color: headerText + '99' }]}>{priceLabel}</Text>
      </View>

      {/* Features */}
      <View style={[styles.tierBody, { backgroundColor: theme.colors.surface }]}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <MaterialCommunityIcons
              name="check-circle"
              size={16}
              color={isHighlighted ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurface, flex: 1, lineHeight: 20 }}>{f}</Text>
          </View>
        ))}

        {/* CTA */}
        {isCurrent ? (
          <View testID="upgrade-current-plan-badge" style={[styles.currentBadge, { borderColor: theme.colors.outlineVariant }]}>
            <MaterialCommunityIcons name="check" size={14} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Current plan</Text>
          </View>
        ) : isDowngrade ? null : Platform.OS === 'web' ? (
          <View style={[styles.webNotice, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons name="cellphone" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, flex: 1, lineHeight: 18 }}>
              Subscriptions are managed through the iOS or Android app
            </Text>
          </View>
        ) : (
          <Button
            mode={isHighlighted ? 'contained' : 'outlined'}
            onPress={() => onUpgrade(tierPlan)}
            disabled={loading}
            style={styles.tierCta}
            icon="crown-outline"
            testID={`upgrade-${tierPlan}-btn`}
          >
            {loading ? <ActivityIndicator size={16} color={isHighlighted ? '#fff' : theme.colors.primary} /> : `Upgrade to ${PLAN_LABELS[tierPlan]}`}
          </Button>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function UpgradeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan: currentPlan } = usePlan();
  const { profile, updateProfile } = useUserAuth();
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const teamPlanCache = useTeamStore(s => s.teamPlanCache);

  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  // Fetch RC offering on mount so we have live prices
  useEffect(() => {
    getOfferings().then(o => setOffering(o));
  }, []);

  /** Propagates a newly confirmed plan to Supabase + local store. */
  const applyPlan = async (newPlan: UserPlan) => {
    if (!profile) return;
    if (supabase) {
      await supabase.from('user_profiles').update({ plan: newPlan }).eq('phone', profile.phone);
      if (myTeamIds.length > 0) {
        await supabase.from('cloud_teams').update({ team_plan: newPlan }).in('id', myTeamIds);
      }
    }
    await updateProfile(profile.name, undefined, undefined, newPlan);
    const updatedCache: Record<string, UserPlan> = { ...teamPlanCache };
    myTeamIds.forEach(id => { updatedCache[id] = newPlan; });
    useTeamStore.setState({ teamPlanCache: updatedCache });
  };

  /**
   * Find the matching RC package for the selected plan + billing cycle.
   * Product ID convention: inningsly_{plan}_{monthly|annual}
   */
  const findPackage = (targetPlan: Exclude<UserPlan, 'free'>): PurchasesPackage | null => {
    if (!offering) return null;
    const suffix = annual ? 'annual' : 'monthly';
    const prefix = `inningsly_${targetPlan}_${suffix}`;
    return offering.availablePackages.find(p => p.product.identifier.startsWith(prefix)) ?? null;
  };

  const handleUpgrade = async (targetPlan: UserPlan) => {
    if (!profile || targetPlan === 'free') return;
    setLoading(true);
    setError('');
    try {
      const pkg = findPackage(targetPlan as Exclude<UserPlan, 'free'>);
      if (pkg) {
        // Real RevenueCat purchase
        const result = await purchasePackage(pkg);
        if (!result.success) {
          if (!result.cancelled) setError(result.error);
          return;
        }
        await applyPlan(result.plan);
        router.back();
      } else if (__DEV__) {
        // Dev-only override: no RC package found in development builds
        await applyPlan(targetPlan);
        router.back();
      } else {
        setError('Purchase unavailable. Please check your connection and try again.');
      }
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Upgrade failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError('');
    try {
      const result = await restorePurchases();
      if (!result.success) {
        setError(result.error);
        return;
      }
      await applyPlan(result.plan);
      router.back();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Restore failed. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]} testID="upgrade-screen">
      <Stack.Screen options={{
        title: 'Upgrade Plan',
        presentation: 'modal',
        headerRight: () => (
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.colors.onSurface}
            onPress={() => router.back()}
            style={{ paddingHorizontal: 8 }}
          />
        ),
      }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="crown-outline" size={36} color={theme.colors.primary} />
          <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            Choose Your Plan
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            Unlock more teams, cloud sync, leagues, and team chat.
          </Text>
        </View>

        {/* Billing toggle */}
        <View style={[styles.billingToggle, { backgroundColor: theme.colors.surfaceVariant, borderRadius: 12 }]} testID="upgrade-billing-toggle">
          <TouchableOpacity
            testID="upgrade-billing-monthly"
            style={[styles.billingBtn, !annual && { backgroundColor: theme.colors.surface, borderRadius: 10 }]}
            onPress={() => setAnnual(false)}
            activeOpacity={0.7}
          >
            <Text variant="labelMedium" style={{ color: annual ? theme.colors.onSurfaceVariant : theme.colors.primary, fontWeight: '700' }}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="upgrade-billing-annual"
            style={[styles.billingBtn, annual && { backgroundColor: theme.colors.surface, borderRadius: 10 }]}
            onPress={() => setAnnual(true)}
            activeOpacity={0.7}
          >
            <Text variant="labelMedium" style={{ color: !annual ? theme.colors.onSurfaceVariant : theme.colors.primary, fontWeight: '700' }}>
              Annual
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.saveBadgeText}>SAVE 30%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, textAlign: 'center', marginBottom: 8 }}>{error}</Text>
        ) : null}

        {/* Tier cards */}
        <TierCard tierPlan="free"   currentPlan={currentPlan} annual={annual} features={FREE_FEATURES}   onUpgrade={handleUpgrade} loading={loading} />
        <TierCard tierPlan="pro"    currentPlan={currentPlan} annual={annual} features={PRO_FEATURES}    onUpgrade={handleUpgrade} loading={loading} />
        <TierCard tierPlan="league" currentPlan={currentPlan} annual={annual} features={LEAGUE_FEATURES} onUpgrade={handleUpgrade} loading={loading} />

        <Divider style={{ marginVertical: 20 }} />

        {/* Restore purchases */}
        <Button
          mode="text"
          icon="restore"
          textColor={theme.colors.onSurfaceVariant}
          onPress={handleRestore}
          loading={restoring}
          disabled={restoring}
          testID="upgrade-restore-btn"
        >
          Restore Purchases
        </Button>

        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 18 }}
        >
          Payment will be charged to your Apple Account at confirmation of purchase. Subscriptions automatically
          renew unless cancelled at least 24 hours before the end of the current period. Your account will be
          charged for renewal within 24 hours prior to the end of the current period. Manage or cancel
          subscriptions in your device&apos;s Account Settings after purchase.
        </Text>
        <View style={styles.legalLinks}>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://inningsly.com/privacy')}
          >
            Privacy Policy
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}> · </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://inningsly.com/terms')}
          >
            Terms of Use
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 4 },
  header: { alignItems: 'center', gap: 8, marginBottom: 20 },
  headerTitle: { fontWeight: '900', textAlign: 'center' },
  billingToggle: { flexDirection: 'row', padding: 4, marginBottom: 16 },
  billingBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  saveBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  tierCard: { borderWidth: 1.5, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  tierCardFeatured: { shadowColor: '#1B6B28', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  tierHeader: { padding: 20, alignItems: 'center', gap: 4 },
  popularBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  popularBadgeText: { color: '#4E342E', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  tierName: { fontSize: 18, fontWeight: '900' },
  tierPrice: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  tierPriceSub: { fontSize: 16, fontWeight: '500' },
  tierPriceLabel: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  tierBody: { padding: 16, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tierCta: { marginTop: 8, borderRadius: 20 },
  currentBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 8, paddingVertical: 10,
    borderWidth: 1, borderRadius: 20,
  },
  webNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderRadius: 20,
  },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
});
