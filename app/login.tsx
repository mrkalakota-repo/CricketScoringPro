import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserAuth } from '../src/hooks/useUserAuth';
import type { UserRole } from '../src/engine/types';

type Mode = 'register' | 'login';

export default function LoginScreen() {
  const theme = useTheme();
  const { profile, register, login } = useUserAuth();

  const defaultMode: Mode = profile ? 'login' : 'register';
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

  const pinMismatch = mode === 'register' && confirmPin.length > 0 && pin !== confirmPin;

  function clearErrors() {
    setError('');
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setPin('');
    setConfirmPin('');
    setError('');
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
          </View>
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
  roleLabel: { marginTop: 8, marginBottom: 8, fontWeight: '700' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roleCard: { flex: 1, minWidth: '44%', maxWidth: '48%', borderWidth: 2, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
});
