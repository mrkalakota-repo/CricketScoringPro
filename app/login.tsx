import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserAuth } from '../src/hooks/useUserAuth';
import { isCloudEnabled } from '../src/config/supabase';
import type { UserRole } from '../src/engine/types';

type Mode = 'register' | 'login' | 'restore';

/**
 * Three modes:
 *  register — first launch, create profile (saved locally + pushed to cloud)
 *  login    — returning user on same device, enter PIN
 *  restore  — new device, enter phone + PIN to pull profile from Supabase
 */
interface LoginScreenProps {
  onBack?: () => void;
}

export default function LoginScreen({ onBack }: LoginScreenProps = {}) {
  const theme = useTheme();
  const { profile, register, login, restoreFromCloud, restoreStatus, restoreErrorMessage, resetRestoreStatus, sessionExpired } = useUserAuth();

  // On web: if session has expired (pinHash gone from sessionStorage), skip straight
  // to the restore form so the user is never stuck on an unresolvable "wrong PIN" loop.
  const defaultMode: Mode = sessionExpired ? 'restore' : profile ? 'login' : 'register';
  const [mode, setMode] = useState<Mode>(defaultMode);

  // Shared
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Register only
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [role, setRole] = useState<UserRole>('scorer');

  // Restore only — pre-fill phone (digits only) when session expired
  const [restorePhone, setRestorePhone] = useState(sessionExpired ? (profile?.phone ?? '') : '');
  const [restorePin, setRestorePin] = useState('');

  const pinMismatch = mode === 'register' && confirmPin.length > 0 && pin !== confirmPin;

  function clearErrors() {
    setError('');
    if (restoreStatus !== 'idle') resetRestoreStatus();
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setPin('');
    setConfirmPin('');
    setRestorePhone('');
    setRestorePin('');
    setError('');
    resetRestoreStatus();
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!phone.trim()) { setError('Phone number is required'); return; }
    if (!/^[0-9]{10}$/.test(phone.replace(/\s/g, ''))) { setError('Enter a valid 10-digit phone number'); return; }
    if (!name.trim()) { setError('Your name is required'); return; }
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    setBusy(true);
    try {
      await register(phone.trim(), name.trim(), pin, role);
    } finally {
      setBusy(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (pin.length < 4) { setError('Enter your PIN'); return; }
    setBusy(true);
    try {
      const ok = await login(pin);
      if (!ok) setError('Incorrect PIN. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restorePhone.trim()) { setError('Phone number is required'); return; }
    if (!/^[0-9]{10}$/.test(restorePhone.trim())) { setError('Enter a valid 10-digit phone number'); return; }
    if (restorePin.length < 4) { setError('Enter your PIN'); return; }
    setBusy(true);
    try {
      await restoreFromCloud(restorePhone.trim(), restorePin);
      // restoreStatus drives the error message below
    } finally {
      setBusy(false);
    }
  };

  const restoreError =
    restoreStatus === 'not_found' ? 'No account found for that phone number.' :
    restoreStatus === 'wrong_pin' ? 'Incorrect PIN. Try again.' :
    restoreStatus === 'error'     ? (restoreErrorMessage.includes('not ready') ? 'Cloud setup incomplete — ask the admin to run supabase-setup.sql.' : restoreErrorMessage.toLowerCase().includes('schema cache') || restoreErrorMessage.includes('waking up') ? 'Database is waking up — please try again in a moment.' : `Server error: ${restoreErrorMessage}`) :
    null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '20' }]}>
            <MaterialCommunityIcons name="cricket" size={40} color={theme.colors.primary} />
          </View>
          <Text variant="headlineMedium" style={[styles.appName, { color: theme.colors.primary }]}>
            Gully Cricket
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            {mode === 'register' && 'Create your player profile to get started'}
            {mode === 'login'    && `Welcome back, ${profile!.name}!`}
            {mode === 'restore'  && (sessionExpired ? `Welcome back, ${profile!.name}!` : 'Sign in on a new device')}
          </Text>
        </View>

        {/* ── Register form ── */}
        {mode === 'register' && (
          <View style={styles.form}>
            <TextInput
              label="Phone Number"
              value={phone}
              onChangeText={t => { setPhone(t.replace(/[^0-9]/g, '')); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="e.g., 8001234567"
              left={<TextInput.Icon icon="phone" />}
              right={<TextInput.Affix text="+1" />}
              autoFocus
            />
            <TextInput
              label="Your Name"
              value={name}
              onChangeText={t => { setName(t); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Rohit Sharma"
              left={<TextInput.Icon icon="account" />}
            />
            <Text variant="labelLarge" style={[styles.roleLabel, { color: theme.colors.onSurface }]}>
              I am a…
            </Text>
            <View style={styles.roleGrid}>
              {(
                [
                  { value: 'scorer'       as UserRole, label: 'Scorer',       icon: 'scoreboard-outline', desc: 'Score live matches' },
                  { value: 'team_admin'   as UserRole, label: 'Team Admin',   icon: 'shield-account',     desc: 'Manage teams & players' },
                  { value: 'league_admin' as UserRole, label: 'League Admin', icon: 'shield-crown',       desc: 'Run tournaments' },
                ] as { value: UserRole; label: string; icon: string; desc: string }[]
              ).map(r => {
                const selected = role === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setRole(r.value)}
                    style={[
                      styles.roleCard,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                        backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={r.icon as any}
                      size={22}
                      color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                    <Text
                      variant="labelMedium"
                      style={{ color: selected ? theme.colors.primary : theme.colors.onSurface, fontWeight: '700', textAlign: 'center' }}
                    >
                      {r.label}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', fontSize: 10 }}
                      numberOfLines={2}
                    >
                      {r.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              label="Create PIN (4–6 digits)"
              value={pin}
              onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              left={<TextInput.Icon icon="lock" />}
            />
            <TextInput
              label="Confirm PIN"
              value={confirmPin}
              onChangeText={t => { setConfirmPin(t.replace(/[^0-9]/g, '')); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              error={pinMismatch}
              left={<TextInput.Icon icon="lock-check" />}
              onSubmitEditing={handleRegister}
              returnKeyType="done"
            />
            {pinMismatch && <HelperText type="error">PINs do not match</HelperText>}
            {error ? <HelperText type="error" style={styles.errorText}>{error}</HelperText> : null}
            <Button
              mode="contained"
              onPress={handleRegister}
              loading={busy}
              disabled={busy}
              style={[styles.button, { borderRadius: 12 }]}
              icon="account-plus"
            >
              Create Account
            </Button>
            {isCloudEnabled && (
              <>
                <Divider style={styles.divider} />
                <Button
                  mode="text"
                  icon="cloud-download-outline"
                  onPress={() => switchMode('restore')}
                  style={styles.linkBtn}
                >
                  Already registered? Restore from another device
                </Button>
              </>
            )}
          </View>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <View style={styles.form}>
            <View style={[styles.profileChip, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name="phone" size={16} color={theme.colors.onPrimaryContainer} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600' }}>
                {profile!.phone}
              </Text>
            </View>
            <TextInput
              label="Enter PIN"
              value={pin}
              onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              left={<TextInput.Icon icon="lock" />}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
              autoFocus
            />
            {error ? <HelperText type="error" style={styles.errorText}>{error}</HelperText> : null}
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={busy}
              disabled={busy}
              style={[styles.button, { borderRadius: 12 }]}
              icon="login"
            >
              Unlock
            </Button>
            <Divider style={styles.divider} />
            <Button
              mode="text"
              icon="account-plus"
              onPress={() => switchMode('register')}
              style={styles.linkBtn}
            >
              Not {profile!.name}? Register a new account
            </Button>
            {isCloudEnabled && (
              <Button
                mode="text"
                icon="cloud-download-outline"
                onPress={() => switchMode('restore')}
                style={styles.linkBtn}
              >
                Sign in on a new device
              </Button>
            )}
          </View>
        )}

        {/* ── Restore form ── */}
        {mode === 'restore' && (
          <View style={styles.form}>
            {sessionExpired ? (
              <View style={[styles.infoBanner, { backgroundColor: theme.colors.tertiaryContainer ?? theme.colors.primaryContainer }]}>
                <MaterialCommunityIcons name="lock-clock" size={18} color={theme.colors.onTertiaryContainer ?? theme.colors.onPrimaryContainer} />
                <Text variant="bodySmall" style={{ color: theme.colors.onTertiaryContainer ?? theme.colors.onPrimaryContainer, flex: 1 }}>
                  Your session has expired. Enter your PIN to sign back in.
                </Text>
              </View>
            ) : (
              <View style={[styles.infoBanner, { backgroundColor: theme.colors.primaryContainer }]}>
                <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.onPrimaryContainer} />
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}>
                  Enter the phone number and PIN you used when you first registered.
                  Your profile will be restored from the cloud.
                </Text>
              </View>
            )}
            {!isCloudEnabled && (
              <View style={[styles.infoBanner, { backgroundColor: theme.colors.errorContainer }]}>
                <MaterialCommunityIcons name="cloud-off-outline" size={18} color={theme.colors.onErrorContainer} />
                <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer, flex: 1 }}>
                  Cloud sync is not enabled. Add Supabase credentials to .env and restart the app.
                </Text>
              </View>
            )}
            <TextInput
              label="Phone Number"
              value={restorePhone}
              onChangeText={t => { setRestorePhone(t.replace(/[^0-9]/g, '')); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="e.g., 8001234567"
              left={<TextInput.Icon icon="phone" />}
              right={<TextInput.Affix text="+1" />}
              autoFocus={!sessionExpired}
            />
            <TextInput
              label="PIN"
              value={restorePin}
              onChangeText={t => { setRestorePin(t.replace(/[^0-9]/g, '')); clearErrors(); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              left={<TextInput.Icon icon="lock" />}
              onSubmitEditing={handleRestore}
              returnKeyType="done"
              autoFocus={sessionExpired}
            />
            {restoreError ? <HelperText type="error" style={styles.errorText}>{restoreError}</HelperText> : null}
            <Button
              mode="contained"
              onPress={handleRestore}
              loading={busy}
              disabled={busy || !isCloudEnabled}
              style={[styles.button, { borderRadius: 12 }]}
              icon="cloud-download-outline"
            >
              Restore Account
            </Button>
            <Divider style={styles.divider} />
            <Button
              mode="text"
              icon="arrow-left"
              onPress={() => switchMode(profile ? 'login' : 'register')}
              style={styles.linkBtn}
            >
              {profile ? 'Back to sign in' : 'Back to registration'}
            </Button>
          </View>
        )}
        {onBack && (
          <>
            <Divider style={styles.divider} />
            <Button mode="text" icon="eye-outline" onPress={onBack} style={styles.linkBtn}>
              Continue as guest (view scores only)
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  header: { alignItems: 'center', marginBottom: 36 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { fontWeight: '900', marginBottom: 8 },
  form: { gap: 4 },
  input: { marginBottom: 10 },
  profileChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 10 },
  button: { marginTop: 12 },
  errorText: { marginBottom: 4 },
  divider: { marginVertical: 20 },
  linkBtn: { alignSelf: 'center' },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, marginBottom: 12 },
  roleLabel: { marginTop: 8, marginBottom: 8, fontWeight: '700' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roleCard: { flex: 1, minWidth: '44%', maxWidth: '48%', borderWidth: 2, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
});
