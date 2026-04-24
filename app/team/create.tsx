import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme, Switch, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeamStore } from '../../src/store/team-store';
import { useAdminAuth, hashAdminPin } from '../../src/hooks/useAdminAuth';
import { usePrefsStore } from '../../src/store/prefs-store';
import { usePlan, PLAN_LIMITS } from '../../src/hooks/usePlan';
import { UpgradeSheet } from '../../src/components/UpgradeSheet';
import * as teamRepo from '../../src/db/repositories/team-repo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export default function CreateTeamScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const createTeam = useTeamStore(s => s.createTeam);
  const teams = useTeamStore(s => s.teams);
  const setTeamAdminPin = useTeamStore(s => s.setTeamAdminPin);
  const authenticate = useAdminAuth(s => s.authenticate);
  const addMyTeam = usePrefsStore(s => s.addMyTeam);
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const { plan, canCreateTeam } = usePlan();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [setPinNow, setSetPinNow] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [teamLocation, setTeamLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Silently capture location in the background — no prompt shown
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setTeamLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch { /* location unavailable — team saved without coordinates */ }
    })();
  }, []);

  const pinMismatch = setPinNow && confirmPin.length > 0 && pin !== confirmPin;
  const pinTooShort = setPinNow && pin.length > 0 && pin.length < 4;

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) { setError('Team name is required'); return; }
    if (!shortName.trim()) { setError('Short name is required'); return; }
    if (shortName.length > 5) { setError('Short name must be 5 characters or less'); return; }
    if (setPinNow) {
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
      if (pin !== confirmPin) { setError('PINs do not match'); return; }
    }

    setBusy(true);
    try {
      // Check for duplicate team name
      const nameTaken = await teamRepo.isTeamNameTaken(name.trim());
      if (nameTaken) { setError('A team with this name already exists'); setBusy(false); return; }
      const team = await createTeam(
        name.trim(), shortName.trim().toUpperCase(),
        teamLocation?.latitude ?? null, teamLocation?.longitude ?? null,
      );
      await addMyTeam(team.id);
      if (setPinNow && pin) {
        const pinHash = await hashAdminPin(pin);
        await setTeamAdminPin(team.id, pinHash);
        // Auto-authenticate the creator so they have immediate admin access
        await authenticate(team.id, pinHash, pin);
      }
      router.replace(`/team/${team.id}`);
    } finally {
      setBusy(false);
    }
  };

  if (!canCreateTeam(myTeamIds.length)) {
    const atLimit = myTeamIds.length >= PLAN_LIMITS[plan].maxOwnedTeams;
    const requiredPlan = plan === 'free' ? 'pro' : 'league';
    const firstOwnedTeam = myTeamIds.length > 0 ? teams.find(t => t.id === myTeamIds[0]) : null;

    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={styles.form}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: theme.colors.primary + '18' }]}>
              <MaterialCommunityIcons name="crown-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>
              Team Limit Reached
            </Text>
            <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
              {plan === 'free'
                ? 'Free accounts can manage 1 team. Upgrade to Pro to create up to 3 teams.'
                : 'Pro accounts can manage 3 teams. Upgrade to League Pro for unlimited teams.'}
            </Text>
          </View>
          {atLimit && (
            <Button mode="contained" icon="crown-outline" onPress={() => router.push('/upgrade')} style={styles.button} testID="team-limit-upgrade-btn">
              Upgrade Plan
            </Button>
          )}
          {firstOwnedTeam && (
            <Button mode="outlined" icon="shield-account" onPress={() => router.replace(`/team/${firstOwnedTeam.id}`)} style={styles.button}>
              Go to My Team
            </Button>
          )}
          <Button mode="text" onPress={() => router.back()} style={styles.button}>Cancel</Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={styles.form}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.colors.primary + '18' }]}>
            <MaterialCommunityIcons name="shield-account" size={32} color={theme.colors.primary} />
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>
            Create Team
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Set up your team name and optionally protect it with an admin PIN
          </Text>
        </View>

        {/* Team Info */}
        <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>Team Info</Text>
        <TextInput
          label="Team Name"
          value={name}
          onChangeText={(t) => { setName(t); setError(''); }}
          mode="outlined"
          style={styles.input}
          placeholder="e.g., Mumbai Indians"
          autoFocus
          testID="team-create-name-input"
        />
        <TextInput
          label="Short Name (up to 5 chars)"
          value={shortName}
          onChangeText={(t) => { setShortName(t.toUpperCase()); setError(''); }}
          mode="outlined"
          style={styles.input}
          placeholder="e.g., MI"
          maxLength={5}
          autoCapitalize="characters"
          testID="team-create-short-name-input"
        />

        {/* Admin PIN Section */}
        <View style={[styles.pinToggleRow, { borderColor: theme.colors.outlineVariant }]}>
          <View style={styles.pinToggleText}>
            <MaterialCommunityIcons name="shield-lock-outline" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>Set Admin PIN</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Protect team edits with a PIN. Only admins can modify the roster.
              </Text>
            </View>
          </View>
          <Switch value={setPinNow} onValueChange={setSetPinNow} testID="team-create-pin-toggle" />
        </View>

        {setPinNow && (
          <View style={styles.pinFields}>
            <TextInput
              label="Admin PIN (4–6 digits)"
              value={pin}
              onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); setError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="e.g., 1234"
              testID="team-create-pin-input"
            />
            <TextInput
              label="Confirm PIN"
              value={confirmPin}
              onChangeText={t => { setConfirmPin(t.replace(/[^0-9]/g, '')); setError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              placeholder="Re-enter PIN"
              error={pinMismatch}
              testID="team-create-confirm-pin-input"
            />
            {pinMismatch && (
              <HelperText type="error">PINs do not match</HelperText>
            )}
            {pinTooShort && (
              <HelperText type="error">PIN must be at least 4 digits</HelperText>
            )}
            <View style={[styles.pinHint, { backgroundColor: theme.colors.primaryContainer, borderRadius: 10 }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={theme.colors.onPrimaryContainer} />
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}>
                You'll be automatically logged in as admin after creating the team. Share the PIN only with other admins.
              </Text>
            </View>
          </View>
        )}

        {error ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>
        ) : null}

        <Button
          mode="contained"
          onPress={handleCreate}
          style={[styles.button, { borderRadius: 12 }]}
          loading={busy}
          disabled={busy}
          icon="check"
          testID="team-create-btn"
        >
          Create Team
        </Button>
        <Button mode="text" onPress={() => router.back()} style={styles.button} testID="team-create-cancel-btn">
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  headerIcon: {
    width: 64, height: 64, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontWeight: '800', marginBottom: 6 },
  subtitle: { textAlign: 'center' },
  sectionLabel: { fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { marginBottom: 14 },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  pinToggleText: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  pinFields: { marginBottom: 8 },
  pinHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, marginBottom: 12 },
  button: { marginTop: 8 },
});
