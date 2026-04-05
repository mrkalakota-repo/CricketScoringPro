import { useState, useRef } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput, Button, useTheme, HelperText, Divider, Portal, Dialog } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserAuth } from '../src/hooks/useUserAuth';
import type { UserRole } from '../src/engine/types';

type Mode = 'register' | 'login' | 'restore';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India',             digits: 10 },
  { code: '+1',  flag: '🇺🇸', name: 'USA / Canada',      digits: 10 },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan',          digits: 10 },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka',         digits: 9  },
  { code: '+44', flag: '🇬🇧', name: 'United Kingdom',    digits: 10 },
  { code: '+61', flag: '🇦🇺', name: 'Australia',         digits: 9  },
  { code: '+27', flag: '🇿🇦', name: 'South Africa',      digits: 9  },
  { code: '+64', flag: '🇳🇿', name: 'New Zealand',       digits: 9  },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh',       digits: 10 },
  { code: '+263', flag: '🇿🇼', name: 'Zimbabwe',         digits: 9  },
];
type CountryEntry = typeof COUNTRY_CODES[number];

// Dot-based PIN progress indicator
function PinDots({ count, max, color, dimColor }: { count: number; max: number; color: string; dimColor: string }) {
  return (
    <View style={styles.pinDots}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.pinDot,
            { backgroundColor: i < count ? color : dimColor },
          ]}
        />
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, sessionExpired, register, login, restoreFromCloud, restoreStatus, resetRestoreStatus } = useUserAuth();

  const defaultMode: Mode = profile ? 'login' : sessionExpired ? 'restore' : 'register';
  const [mode, setMode] = useState<Mode>(defaultMode);

  // Shared
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Register only
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [role, setRole] = useState<UserRole>('scorer');
  const [country, setCountry] = useState<CountryEntry>(COUNTRY_CODES[0]); // default +91
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Restore only
  const [restorePhone, setRestorePhone] = useState('');
  const [restoreCountry, setRestoreCountry] = useState<CountryEntry>(COUNTRY_CODES[0]);
  const [showRestoreCountryPicker, setShowRestoreCountryPicker] = useState(false);

  // Dialogs
  const [registerWarningVisible, setRegisterWarningVisible] = useState(false);

  // Sequential focus refs
  const nameRef = useRef<any>(null);
  const pinRef = useRef<any>(null);
  const confirmPinRef = useRef<any>(null);
  const restorePinRef = useRef<any>(null);

  const pinMismatch = mode === 'register' && confirmPin.length > 0 && pin !== confirmPin;

  function clearFieldError(field: string) {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setPin('');
    setConfirmPin('');
    setShowPin(false);
    setShowConfirmPin(false);
    setFieldErrors({});
    resetRestoreStatus();
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const errors: Record<string, string> = {};
    const digits = phone.replace(/\D/g, '');
    if (!digits) errors.phone = 'Phone number is required';
    else if (digits.length !== country.digits) errors.phone = `Enter a valid ${country.digits}-digit number for ${country.name}`;
    if (!name.trim()) errors.name = 'Your name is required';
    if (pin.length < 4) errors.pin = 'PIN must be at least 4 digits';
    else if (pin !== confirmPin) errors.confirmPin = 'PINs do not match';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    // Store phone as countryCodeDigits + localDigits (e.g. "919876543210")
    const fullPhone = `${country.code.replace('+', '')}${digits}`;
    setBusy(true);
    try {
      await register(fullPhone, name.trim(), pin, role);
    } finally {
      setBusy(false);
    }
  };

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleRestore = async () => {
    const errors: Record<string, string> = {};
    const cleaned = restorePhone.replace(/\D/g, '');
    if (cleaned.length !== restoreCountry.digits) errors.restorePhone = `Enter a valid ${restoreCountry.digits}-digit number for ${restoreCountry.name}`;
    if (pin.length < 4) errors.pin = 'Enter your PIN';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    const fullPhone = `${restoreCountry.code.replace('+', '')}${cleaned}`;
    setBusy(true);
    setFieldErrors({});
    try {
      let ok = await restoreFromCloud(fullPhone, pin);
      if (!ok) {
        const { restoreStatus: status, restoreErrorMessage: msg } = useUserAuth.getState();
        // Fallback: accounts registered before international phone support stored bare
        // local digits with no country code prefix (e.g. "2025550101" not "12025550101").
        // Retry with the bare digits so existing users aren't locked out after upgrade.
        if (status === 'not_found') {
          ok = await restoreFromCloud(cleaned, pin);
        }
        if (!ok) {
          const { restoreStatus: status2, restoreErrorMessage: msg2 } = useUserAuth.getState();
          if (status2 === 'not_found') setFieldErrors({ restorePhone: 'No account found for this phone number.' });
          else if (status2 === 'wrong_pin') setFieldErrors({ pin: 'Incorrect PIN. Try again.' });
          else setFieldErrors({ pin: msg2 || msg || 'Could not restore account. Try again.' });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (pin.length < 4) { setFieldErrors({ pin: 'Enter your PIN' }); return; }
    setBusy(true);
    try {
      const ok = await login(pin);
      if (!ok) setFieldErrors({ pin: 'Incorrect PIN. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  // ── Subtitle per mode ─────────────────────────────────────────────────────
  const subtitle =
    mode === 'register' ? 'Create your player profile to get started' :
    mode === 'login'    ? `Welcome back, ${profile!.name}!` :
                          'Use this if you switched devices or forgot your PIN';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Portal>
        <Dialog visible={registerWarningVisible} onDismiss={() => setRegisterWarningVisible(false)}>
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title>Replace account on this device?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Registering a new account will replace{' '}
              <Text style={{ fontWeight: '700' }}>{profile?.name}</Text>'s profile on this device.
              Your cloud data will not be deleted.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRegisterWarningVisible(false)}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => { setRegisterWarningVisible(false); switchMode('register'); }}
            >
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Country code picker — register */}
      <Portal>
        <Dialog visible={showCountryPicker} onDismiss={() => setShowCountryPicker(false)}>
          <Dialog.Title>Select Country</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 320 }}>
            <ScrollView>
              {COUNTRY_CODES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { setCountry(c); setPhone(''); setShowCountryPicker(false); }}
                  style={[styles.countryOption, c.code === country.code && { backgroundColor: theme.colors.primaryContainer }]}
                >
                  <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                  <Text style={{ flex: 1, marginLeft: 12, color: theme.colors.onSurface }}>{c.name}</Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>

      {/* Country code picker — restore */}
      <Portal>
        <Dialog visible={showRestoreCountryPicker} onDismiss={() => setShowRestoreCountryPicker(false)}>
          <Dialog.Title>Select Country</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 320 }}>
            <ScrollView>
              {COUNTRY_CODES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { setRestoreCountry(c); setRestorePhone(''); setShowRestoreCountryPicker(false); }}
                  style={[styles.countryOption, c.code === restoreCountry.code && { backgroundColor: theme.colors.primaryContainer }]}
                >
                  <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                  <Text style={{ flex: 1, marginLeft: 12, color: theme.colors.onSurface }}>{c.name}</Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '700' }}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 28) }]} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '20' }]}>
            <MaterialCommunityIcons name="cricket" size={40} color={theme.colors.primary} />
          </View>
          <Text variant="headlineMedium" style={[styles.appName, { color: theme.colors.primary }]}>
            Inningsly
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            {subtitle}
          </Text>
        </View>

        {/* ── Register form ── */}
        {mode === 'register' && (
          <View style={styles.form}>
            <TouchableOpacity
              onPress={() => setShowCountryPicker(true)}
              style={[styles.countryRow, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>{country.flag}</Text>
              <Text style={{ fontWeight: '700', color: theme.colors.onSurface, flex: 1, marginLeft: 8 }}>
                {country.code}  {country.name}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TextInput
              label="Phone Number"
              value={phone}
              onChangeText={t => { setPhone(t.replace(/[^0-9]/g, '')); clearFieldError('phone'); }}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              maxLength={country.digits}
              placeholder={`${country.digits}-digit number`}
              left={<TextInput.Icon icon="phone" />}
              error={!!fieldErrors.phone}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => nameRef.current?.focus()}
            />
            <HelperText type={fieldErrors.phone ? 'error' : 'info'} visible={!!fieldErrors.phone || true} style={styles.helper}>
              {fieldErrors.phone ?? `${country.digits}-digit number, no dashes or spaces`}
            </HelperText>

            <TextInput
              ref={nameRef}
              label="Your Name"
              value={name}
              onChangeText={t => { setName(t); clearFieldError('name'); }}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Rohit Sharma"
              left={<TextInput.Icon icon="account" />}
              error={!!fieldErrors.name}
              returnKeyType="next"
              onSubmitEditing={() => pinRef.current?.focus()}
            />
            {fieldErrors.name ? <HelperText type="error" style={styles.helper}>{fieldErrors.name}</HelperText> : null}

            <Text variant="labelLarge" style={[styles.roleLabel, { color: theme.colors.onSurface }]}>
              I am a…
            </Text>
            <View style={styles.roleGrid}>
              {(
                [
                  { value: 'scorer'       as UserRole, label: 'Scorer',       icon: 'scoreboard-outline', desc: 'Score live matches' },
                  { value: 'team_admin'   as UserRole, label: 'Team Admin',   icon: 'shield-account',     desc: 'Manage teams & players' },
                  { value: 'league_admin' as UserRole, label: 'League Admin', icon: 'shield-crown',       desc: 'Run tournaments' },
                  { value: 'viewer'       as UserRole, label: 'Viewer',       icon: 'eye-outline',        desc: 'Follow matches & live scores' },
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
              ref={pinRef}
              label="Create PIN (4–6 digits)"
              value={pin}
              onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); clearFieldError('pin'); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={6}
              error={!!fieldErrors.pin}
              left={<TextInput.Icon icon="lock" />}
              right={<TextInput.Icon icon={showPin ? 'eye-off' : 'eye'} onPress={() => setShowPin(v => !v)} />}
              returnKeyType="next"
              onSubmitEditing={() => confirmPinRef.current?.focus()}
            />
            <PinDots count={pin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
            {fieldErrors.pin ? <HelperText type="error" style={styles.helper}>{fieldErrors.pin}</HelperText> : null}

            <TextInput
              ref={confirmPinRef}
              label="Confirm PIN"
              value={confirmPin}
              onChangeText={t => { setConfirmPin(t.replace(/[^0-9]/g, '')); clearFieldError('confirmPin'); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry={!showConfirmPin}
              maxLength={6}
              error={pinMismatch || !!fieldErrors.confirmPin}
              left={<TextInput.Icon icon="lock-check" />}
              right={<TextInput.Icon icon={showConfirmPin ? 'eye-off' : 'eye'} onPress={() => setShowConfirmPin(v => !v)} />}
              onSubmitEditing={handleRegister}
              returnKeyType="done"
            />
            <PinDots count={confirmPin.length} max={6} color={pinMismatch ? theme.colors.error : theme.colors.primary} dimColor={theme.colors.outlineVariant} />
            {(pinMismatch || fieldErrors.confirmPin) ? (
              <HelperText type="error" style={styles.helper}>{fieldErrors.confirmPin ?? 'PINs do not match'}</HelperText>
            ) : null}

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
            <Divider style={styles.divider} />
            <Button
              mode="text"
              icon="login"
              onPress={() => switchMode(profile ? 'login' : 'restore')}
              style={styles.linkBtn}
            >
              Already have an account? Sign in
            </Button>
          </View>
        )}

        {/* ── Login form ── */}
        {mode === 'login' && (
          <View style={styles.form}>
            <View style={[styles.profileChip, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name="account-circle" size={32} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
                  {profile!.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  +{profile!.phone}
                </Text>
              </View>
            </View>

            <TextInput
              label="Enter PIN"
              value={pin}
              onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); clearFieldError('pin'); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={6}
              error={!!fieldErrors.pin}
              left={<TextInput.Icon icon="lock" />}
              right={<TextInput.Icon icon={showPin ? 'eye-off' : 'eye'} onPress={() => setShowPin(v => !v)} />}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
              autoFocus
            />
            <PinDots count={pin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
            {fieldErrors.pin ? <HelperText type="error" style={styles.helper}>{fieldErrors.pin}</HelperText> : null}

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
              mode="contained-tonal"
              icon="account-switch"
              onPress={() => { setRestorePhone(''); switchMode('restore'); }}
              style={{ borderRadius: 10, marginBottom: 4 }}
            >
              Login as different user
            </Button>
            <Button
              mode="text"
              icon="lock-reset"
              onPress={() => switchMode('restore')}
              style={styles.linkBtn}
            >
              Forgot PIN? Restore from cloud
            </Button>
            <Button
              mode="text"
              icon="account-plus"
              onPress={() => setRegisterWarningVisible(true)}
              style={[styles.linkBtn, { opacity: 0.6 }]}
              labelStyle={{ fontSize: 12 }}
            >
              Not {profile!.name}? Register a new account
            </Button>
          </View>
        )}

        {/* ── Restore form ── */}
        {mode === 'restore' && (
          <View style={styles.form}>
            <TouchableOpacity
              onPress={() => setShowRestoreCountryPicker(true)}
              style={[styles.countryRow, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>{restoreCountry.flag}</Text>
              <Text style={{ fontWeight: '700', color: theme.colors.onSurface, flex: 1, marginLeft: 8 }}>
                {restoreCountry.code}  {restoreCountry.name}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TextInput
              label="Phone Number"
              value={restorePhone}
              onChangeText={t => { setRestorePhone(t.replace(/[^0-9]/g, '')); clearFieldError('restorePhone'); }}
              mode="outlined"
              style={styles.input}
              keyboardType="number-pad"
              maxLength={restoreCountry.digits}
              placeholder={`${restoreCountry.digits}-digit number`}
              left={<TextInput.Icon icon="phone" />}
              error={!!fieldErrors.restorePhone}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => restorePinRef.current?.focus()}
            />
            {fieldErrors.restorePhone ? (
              <HelperText type="error" style={styles.helper}>{fieldErrors.restorePhone}</HelperText>
            ) : null}

            <TextInput
              ref={restorePinRef}
              label="Enter PIN"
              value={pin}
              onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); clearFieldError('pin'); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={6}
              error={!!fieldErrors.pin}
              left={<TextInput.Icon icon="lock" />}
              right={<TextInput.Icon icon={showPin ? 'eye-off' : 'eye'} onPress={() => setShowPin(v => !v)} />}
              onSubmitEditing={handleRestore}
              returnKeyType="done"
            />
            <PinDots count={pin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
            {fieldErrors.pin ? <HelperText type="error" style={styles.helper}>{fieldErrors.pin}</HelperText> : null}

            {restoreStatus === 'fetching' && (
              <HelperText type="info" style={[styles.helper, { color: theme.colors.primary }]}>
                Connecting to server…
              </HelperText>
            )}
            {restoreStatus === 'success' && (
              <HelperText type="info" style={[styles.helper, { color: theme.colors.primary }]}>
                Account restored successfully!
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleRestore}
              loading={busy}
              disabled={busy}
              style={[styles.button, { borderRadius: 12 }]}
              icon="cloud-download"
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
              Back
            </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28 }, // paddingBottom overridden inline with insets
  header: { alignItems: 'center', marginBottom: 36 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { fontWeight: '900', marginBottom: 8 },
  form: { gap: 0 },
  input: { marginBottom: 0 },
  helper: { marginBottom: 6, marginTop: -4 },
  profileChip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 16 },
  button: { marginTop: 16 },
  divider: { marginVertical: 20 },
  linkBtn: { alignSelf: 'center' },
  roleLabel: { marginTop: 12, marginBottom: 8, fontWeight: '700' },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roleCard: { flex: 1, minWidth: '44%', maxWidth: '48%', borderWidth: 2, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  pinDots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 6, marginBottom: 10 },
  pinDot: { width: 10, height: 10, borderRadius: 5 },
  countryRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  countryOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
});
