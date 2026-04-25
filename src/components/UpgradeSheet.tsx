import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Button, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PLAN_PRICING, PLAN_LABELS, type PlanFeature } from '../hooks/usePlan';
import type { UserPlan } from '../engine/types';

// ── Feature copy ──────────────────────────────────────────────────────────────

const FEATURE_COPY: Record<PlanFeature, { icon: string; title: string; body: string }> = {
  additional_teams:   { icon: 'shield-plus',       title: 'More Teams',          body: 'Pro allows 3 teams; League Pro allows unlimited.' },
  team_chat:          { icon: 'chat-plus-outline',  title: 'Team Chat',           body: 'Real-time messaging for all team members.' },
  delegate_codes:     { icon: 'key-plus',           title: 'Delegate Access',     body: 'Share a 6-digit code so scorers can join your team.' },
  cloud_sync:         { icon: 'cloud-sync-outline', title: 'Cloud Sync',          body: 'Access your teams and history from any device.' },
  leagues:            { icon: 'tournament',         title: 'Leagues & Fixtures',  body: 'Create tournaments with round-robin or knockout fixtures.' },
  scorecard_export:   { icon: 'file-export-outline','title': 'Export Scorecard',  body: 'Share match scorecards as images or text.' },
  public_scoreboard:  { icon: 'web',                title: 'Public Scoreboard',   body: 'A shareable URL showing your league live standings.' },
  data_export:        { icon: 'database-export-outline', title: 'Data Export',   body: 'Download all match and player data as CSV.' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface UpgradeSheetProps {
  visible: boolean;
  feature: PlanFeature;
  requiredPlan: Exclude<UserPlan, 'free'>;
  onDismiss: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UpgradeSheet({ visible, feature, requiredPlan, onDismiss }: UpgradeSheetProps) {
  const theme = useTheme();
  const router = useRouter();
  const copy = FEATURE_COPY[feature];
  const pricing = PLAN_PRICING[requiredPlan];
  const planLabel = PLAN_LABELS[requiredPlan];

  const handleUpgrade = () => {
    onDismiss();
    router.push('/upgrade');
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog} testID="upgrade-sheet-dialog">
        <View style={[styles.iconRow, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons
            name={copy.icon as any}
            size={32}
            color={theme.colors.primary}
          />
        </View>
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          {copy.title}
        </Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
            {copy.body}
          </Text>
          <View style={[styles.pricePill, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="crown-outline" size={14} color={theme.colors.primary} />
            <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {planLabel} — from ${pricing.monthly}/mo
            </Text>
          </View>
        </Dialog.Content>
        <Dialog.Actions style={styles.actions}>
          <Button testID="upgrade-sheet-dismiss-btn" onPress={onDismiss} textColor={theme.colors.onSurfaceVariant}>
            Maybe later
          </Button>
          <Button mode="contained" onPress={handleUpgrade} icon="crown-outline">
            Upgrade
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 20 },
  iconRow: {
    width: 64, height: 64, borderRadius: 18,
    alignSelf: 'center',
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24, marginBottom: 4,
  },
  title: { textAlign: 'center', fontWeight: '800' },
  body: { textAlign: 'center', lineHeight: 22, marginBottom: 14 },
  pricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  actions: { justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
});
