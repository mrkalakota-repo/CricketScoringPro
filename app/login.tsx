import { useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, TextInput as RNTextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text, TextInput, Button, useTheme, HelperText, Divider,
  Portal, Dialog, ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLocales } from 'expo-localization';
import { useUserAuth } from '../src/hooks/useUserAuth';
import type { UserRole } from '../src/engine/types';
import { TurnstileWidget } from '../src/components/TurnstileWidget';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'register' | 'login' | 'restore';

/** Steps within the registration wizard. */
type RegStep = 'phone' | 'otp' | 'name' | 'role' | 'pin';

/**
 * Restore has two paths:
 * - 'pin'  → existing phone + PIN flow (unchanged)
 * - 'otp'  → phone → OTP → set new PIN (forgot PIN)
 */
type RestoreTab = 'pin' | 'otp';
type RestoreOtpStep = 'phone' | 'otp' | 'pin';

// ── Country data ──────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+91',  flag: '🇮🇳', name: 'India',          digits: 10 },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada',   digits: 10 },
  { code: '+44',  flag: '🇬🇧', name: 'United Kingdom', digits: 10 },
  { code: '+61',  flag: '🇦🇺', name: 'Australia',      digits: 9  },
  { code: '+64',  flag: '🇳🇿', name: 'New Zealand',    digits: 9  },
];
type CountryEntry = typeof COUNTRY_CODES[number];

const REGION_TO_DIAL: Record<string, string> = {
  IN: '+91', US: '+1', CA: '+1',
  GB: '+44', AU: '+61', NZ: '+64',
};

function detectDefaultCountry(): CountryEntry {
  try {
    const locales = getLocales();
    for (const locale of locales) {
      const region = locale.regionCode;
      if (region && REGION_TO_DIAL[region]) {
        const match = COUNTRY_CODES.find(c => c.code === REGION_TO_DIAL[region]);
        if (match) return match;
      }
    }
  } catch { /* fall through */ }
  return COUNTRY_CODES[0];
}

// ── Small shared components ───────────────────────────────────────────────────

function PinDots({ count, max, color, dimColor }: { count: number; max: number; color: string; dimColor: string }) {
  return (
    <View style={styles.pinDots}>
      {Array.from({ length: max }).map((_, i) => (
        <View key={i} style={[styles.pinDot, { backgroundColor: i < count ? color : dimColor }]} />
      ))}
    </View>
  );
}

/** 6-box OTP input. Calls onComplete when all 6 digits are entered. */
function OtpInput({
  value, onChange, onComplete, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const inputRef = useRef<RNTextInput>(null);

  const handleChange = useCallback((text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    onChange(digits);
    if (digits.length === 6) onComplete(digits);
  }, [onChange, onComplete]);

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.otpWrap}>
      {/* Hidden real input */}
      <RNTextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.otpHidden}
        autoFocus
        editable={!disabled}
      />
      {/* Visual boxes */}
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = i < value.length;
        const active = i === value.length;
        return (
          <View
            key={i}
            style={[
              styles.otpBox,
              {
                borderColor: active
                  ? theme.colors.primary
                  : filled
                  ? theme.colors.outline
                  : theme.colors.outlineVariant,
                backgroundColor: filled ? theme.colors.primaryContainer : theme.colors.surface,
              },
            ]}
          >
            <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.onSurface }}>
              {value[i] ?? ''}
            </Text>
          </View>
        );
      })}
    </TouchableOpacity>
  );
}

/** Country picker row + dialog. */
function CountryPicker({
  value, onChange,
}: {
  value: CountryEntry;
  onChange: (c: CountryEntry) => void;
}) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={[styles.countryRow, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }]}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 20 }}>{value.flag}</Text>
        <Text style={{ fontWeight: '700', color: theme.colors.onSurface, flex: 1, marginLeft: 8 }}>
          {value.code}  {value.name}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>Select Country</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 320 }}>
            <ScrollView>
              {COUNTRY_CODES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => { onChange(c); setVisible(false); }}
                  style={[styles.countryOption, c.code === value.code && { backgroundColor: theme.colors.primaryContainer }]}
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
    </>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────

const REG_STEPS: RegStep[] = ['phone', 'otp', 'name', 'role', 'pin'];

function StepProgress({ current, total }: { current: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.progressWrap}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            {
              backgroundColor: i <= current ? theme.colors.primary : theme.colors.outlineVariant,
              width: i === current ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LoginScreen({ initialMode }: { initialMode?: Mode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    profile, sessionExpired,
    register, login, restoreFromCloud,
    restoreStatus, resetRestoreStatus,
    sendOtp, verifyOtp, checkPhoneExists, otpSending, otpVerifying, otpError, clearOtpError,
  } = useUserAuth();

  const defaultMode: Mode = initialMode ?? (profile ? 'login' : sessionExpired ? 'restore' : 'register');
  const [mode, setMode] = useState<Mode>(defaultMode);

  // ── Register wizard state ─────────────────────────────────────────────────
  const [regStep, setRegStep] = useState<RegStep>('phone');
  const [regCountry, setRegCountry] = useState<CountryEntry>(detectDefaultCountry);
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('scorer');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);
  const [showRegConfirmPin, setShowRegConfirmPin] = useState(false);
  const [regError, setRegError] = useState('');
  const [regBusy, setRegBusy] = useState(false);
  // Countdown for OTP resend
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Login state ───────────────────────────────────────────────────────────
  const [loginPin, setLoginPin] = useState('');
  const [showLoginPin, setShowLoginPin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  // ── Restore state ─────────────────────────────────────────────────────────
  const [restoreTab, setRestoreTab] = useState<RestoreTab>('pin');
  // PIN restore (existing)
  const [restoreCountry, setRestoreCountry] = useState<CountryEntry>(detectDefaultCountry);
  const [restorePhone, setRestorePhone] = useState('');
  const [restorePin, setRestorePin] = useState('');
  const [showRestorePin, setShowRestorePin] = useState(false);
  const [restorePinError, setRestorePinError] = useState('');
  const [restoreBusy, setRestoreBusy] = useState(false);
  // OTP restore (forgot PIN)
  const [restoreOtpStep, setRestoreOtpStep] = useState<RestoreOtpStep>('phone');
  const [restoreOtpCountry, setRestoreOtpCountry] = useState<CountryEntry>(detectDefaultCountry);
  const [restoreOtpPhone, setRestoreOtpPhone] = useState('');
  const [restoreOtpCode, setRestoreOtpCode] = useState('');
  const [restoreNewPin, setRestoreNewPin] = useState('');
  const [restoreConfirmPin, setRestoreConfirmPin] = useState('');
  const [showRestoreNewPin, setShowRestoreNewPin] = useState(false);
  const [showRestoreConfirmPin, setShowRestoreConfirmPin] = useState(false);
  const [restoreOtpError, setRestoreOtpError] = useState('');
  // After OTP verify, store the profile name+role so we can re-register with the new PIN
  const [verifiedName, setVerifiedName] = useState('');
  const [verifiedRole, setVerifiedRole] = useState<UserRole>('scorer');

  // ── Turnstile (web bot protection) ───────────────────────────────────────
  const [turnstileToken, setTurnstileToken] = useState('');
  const isWeb = Platform.OS === 'web';

  // ── Register warning dialog ───────────────────────────────────────────────
  const [registerWarningVisible, setRegisterWarningVisible] = useState(false);
  // ── Phone number confirmation dialogs ─────────────────────────────────────
  const [showPhoneConfirm, setShowPhoneConfirm] = useState(false);
  const [showRestorePhoneConfirm, setShowRestorePhoneConfirm] = useState(false);
  // ── Existing account detected during registration ─────────────────────────
  const [existingAccountName, setExistingAccountName] = useState('');

  // ── Helpers ───────────────────────────────────────────────────────────────

  function startResendCooldown() {
    setResendCooldown(60);
    resendTimer.current && clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(resendTimer.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setRegStep('phone');
    setRegPhone(''); setRegOtp(''); setRegName('');
    setRegRole('scorer'); setRegPin(''); setRegConfirmPin('');
    setRegError('');
    setLoginPin(''); setLoginError('');
    setRestorePhone(''); setRestorePin(''); setRestorePinError('');
    setRestoreOtpStep('phone'); setRestoreOtpPhone(''); setRestoreOtpCode('');
    setRestoreNewPin(''); setRestoreConfirmPin(''); setRestoreOtpError('');
    setResendCooldown(0);
    setTurnstileToken('');
    clearOtpError();
    resetRestoreStatus();
  }

  // ── Register handlers ─────────────────────────────────────────────────────

  function handleSendOtp() {
    const digits = regPhone.replace(/\D/g, '');
    if (digits.length !== regCountry.digits) {
      setRegError(`Enter a valid ${regCountry.digits}-digit number for ${regCountry.name}`);
      return;
    }
    setRegError('');
    setShowPhoneConfirm(true);
  }

  async function confirmAndSendOtp() {
    setShowPhoneConfirm(false);
    const digits = regPhone.replace(/\D/g, '');
    const fullPhone = `${regCountry.code.replace('+', '')}${digits}`;

    // Check for existing account before sending OTP — no SMS wasted
    const check = await checkPhoneExists(fullPhone);
    if (check.exists) {
      setExistingAccountName(check.name ?? 'You');
      return;
    }

    const ok = await sendOtp(fullPhone, isWeb ? turnstileToken : undefined);
    if (ok) {
      setRegPhone(digits);
      setRegStep('otp');
      setTurnstileToken('');
      startResendCooldown();
    } else {
      setRegError(otpError || 'Unable to send verification code. Please try again.');
      setTurnstileToken('');
    }
  }

  async function handleVerifyRegOtp(code: string) {
    const fullPhone = `${regCountry.code.replace('+', '')}${regPhone}`;
    const result = await verifyOtp(fullPhone, code);
    if (!result.valid) {
      setRegOtp('');
      setRegError(otpError || 'Incorrect code. Please check and try again.');
    } else if (result.name) {
      // Phone is already registered in Supabase — block re-registration
      // and prompt them to sign in to preserve their existing plan and PIN.
      setRegOtp('');
      setExistingAccountName(result.name);
    } else {
      setRegError('');
      setRegStep('name');
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    const fullPhone = `${regCountry.code.replace('+', '')}${regPhone}`;
    const ok = await sendOtp(fullPhone);
    if (ok) {
      setRegOtp('');
      startResendCooldown();
    }
  }

  async function handleFinishRegister() {
    if (regPin.length < 4) { setRegError('PIN must be at least 4 digits'); return; }
    if (regPin !== regConfirmPin) { setRegError('PINs do not match'); return; }
    setRegError('');
    setRegBusy(true);
    const fullPhone = `${regCountry.code.replace('+', '')}${regPhone}`;
    try {
      await register(fullPhone, regName.trim(), regPin, regRole);
    } finally {
      setRegBusy(false);
    }
  }

  // ── Login handler ─────────────────────────────────────────────────────────

  async function handleLogin() {
    if (loginPin.length < 4) { setLoginError('Enter your PIN'); return; }
    setLoginBusy(true);
    try {
      const ok = await login(loginPin);
      if (!ok) setLoginError('Incorrect PIN. Try again.');
    } finally {
      setLoginBusy(false);
    }
  }

  // ── Restore — PIN path handler ────────────────────────────────────────────

  async function handlePinRestore() {
    const cleaned = restorePhone.replace(/\D/g, '');
    if (cleaned.length !== restoreCountry.digits) {
      setRestorePinError(`Enter a valid ${restoreCountry.digits}-digit number`);
      return;
    }
    if (restorePin.length < 4) { setRestorePinError('Enter your PIN'); return; }
    setRestorePinError('');
    setRestoreBusy(true);
    try {
      const fullPhone = `${restoreCountry.code.replace('+', '')}${cleaned}`;
      let ok = await restoreFromCloud(fullPhone, restorePin);
      if (!ok) {
        const { restoreStatus: s, restoreErrorMessage: msg } = useUserAuth.getState();
        if (s === 'not_found') ok = await restoreFromCloud(cleaned, restorePin);
        if (!ok) {
          const { restoreStatus: s2, restoreErrorMessage: msg2 } = useUserAuth.getState();
          if (s2 === 'not_found') setRestorePinError('No account found for this number. Double-check the number and try again.');
          else if (s2 === 'wrong_pin') setRestorePinError('Incorrect PIN. Try again.');
          else setRestorePinError(msg2 || msg || 'Could not restore your account. Check your connection and try again.');
        }
      }
    } finally {
      setRestoreBusy(false);
    }
  }

  // ── Restore — OTP path handlers ───────────────────────────────────────────

  function handleRestoreOtpSend() {
    const digits = restoreOtpPhone.replace(/\D/g, '');
    if (digits.length !== restoreOtpCountry.digits) {
      setRestoreOtpError(`Enter a valid ${restoreOtpCountry.digits}-digit number`);
      return;
    }
    setRestoreOtpError('');
    setShowRestorePhoneConfirm(true);
  }

  async function confirmAndSendRestoreOtp() {
    setShowRestorePhoneConfirm(false);
    const digits = restoreOtpPhone.replace(/\D/g, '');
    const fullPhone = `${restoreOtpCountry.code.replace('+', '')}${digits}`;
    const ok = await sendOtp(fullPhone, isWeb ? turnstileToken : undefined);
    if (ok) {
      setRestoreOtpPhone(digits);
      setRestoreOtpStep('otp');
      setTurnstileToken('');
      startResendCooldown();
    } else {
      setRestoreOtpError(otpError || 'Unable to send verification code. Please try again.');
      setTurnstileToken('');
    }
  }

  async function handleRestoreOtpVerify(code: string) {
    const fullPhone = `${restoreOtpCountry.code.replace('+', '')}${restoreOtpPhone}`;
    const result = await verifyOtp(fullPhone, code);
    if (!result.valid) {
      setRestoreOtpCode('');
      setRestoreOtpError(otpError || 'Incorrect code. Please check and try again.');
    } else {
      if (!result.name) {
        setRestoreOtpError('No account found for this number. Register instead.');
        return;
      }
      setVerifiedName(result.name);
      setVerifiedRole((result.role as UserRole) ?? 'scorer');
      setRestoreOtpError('');
      setRestoreOtpStep('pin');
    }
  }

  async function handleRestoreOtpSetPin() {
    if (restoreNewPin.length < 4) { setRestoreOtpError('PIN must be at least 4 digits'); return; }
    if (restoreNewPin !== restoreConfirmPin) { setRestoreOtpError('PINs do not match'); return; }
    const fullPhone = `${restoreOtpCountry.code.replace('+', '')}${restoreOtpPhone}`;
    setRestoreBusy(true);
    try {
      await register(fullPhone, verifiedName, restoreNewPin, verifiedRole);
    } finally {
      setRestoreBusy(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const regStepIndex = REG_STEPS.indexOf(regStep);

  const subtitle =
    mode === 'login'    ? `Welcome back, ${profile!.name}!` :
    mode === 'restore'  ? 'Recover access to your account' :
                          'Create your player profile';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Phone confirmation — register */}
      <Portal>
        <Dialog visible={showPhoneConfirm} onDismiss={() => setShowPhoneConfirm(false)}>
          <Dialog.Icon icon="message-text-outline" />
          <Dialog.Title>Send verification code?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              We'll send a 6-digit SMS code to{'\n'}
              <Text style={{ fontWeight: '700' }}>{regCountry.code} {regPhone}</Text>
              {'\n\n'}Make sure this number is correct before continuing.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPhoneConfirm(false)}>Change Number</Button>
            <Button onPress={confirmAndSendOtp} loading={otpSending}>Send Code</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Phone confirmation — restore OTP */}
      <Portal>
        <Dialog visible={showRestorePhoneConfirm} onDismiss={() => setShowRestorePhoneConfirm(false)}>
          <Dialog.Icon icon="message-text-outline" />
          <Dialog.Title>Send verification code?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              We'll send a 6-digit SMS code to{'\n'}
              <Text style={{ fontWeight: '700' }}>{restoreOtpCountry.code} {restoreOtpPhone}</Text>
              {'\n\n'}Make sure this number is correct before continuing.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowRestorePhoneConfirm(false)}>Change Number</Button>
            <Button onPress={confirmAndSendRestoreOtp} loading={otpSending}>Send Code</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Existing account detected during registration */}
      <Portal>
        <Dialog visible={!!existingAccountName} onDismiss={() => setExistingAccountName('')}>
          <Dialog.Icon icon="account-check-outline" />
          <Dialog.Title>Account already exists</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              <Text style={{ fontWeight: '700' }}>{existingAccountName}</Text> is already registered with this number.{'\n\n'}Sign in to keep your existing PIN and plan intact.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExistingAccountName('')}>Back</Button>
            <Button
              mode="contained"
              onPress={() => {
                const savedCountry = regCountry;
                const savedPhone = regPhone;
                setExistingAccountName('');
                switchMode('restore');
                // Pre-fill phone so user doesn't have to re-enter it
                setRestoreCountry(savedCountry);
                setRestorePhone(savedPhone);
              }}
            >
              Sign In
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Replace-account warning */}
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

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 28) }]}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* ── REGISTER wizard ── */}
        {mode === 'register' && (
          <View style={styles.form}>
            <StepProgress current={regStepIndex} total={REG_STEPS.length} />

            {/* Step: phone */}
            {regStep === 'phone' && (
              <View style={styles.stepBlock}>
                <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  What's your phone number?
                </Text>
                <CountryPicker value={regCountry} onChange={c => { setRegCountry(c); setRegPhone(''); }} />
                <TextInput
                  label="Phone Number"
                  value={regPhone}
                  onChangeText={t => { setRegPhone(t.replace(/\D/g, '')); setRegError(''); }}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={regCountry.digits}
                  placeholder={`${regCountry.digits}-digit number`}
                  left={<TextInput.Icon icon="phone" />}
                  error={!!regError}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
                {regError ? <HelperText type="error" style={styles.helper}>{regError}</HelperText> : null}
                {isWeb && (
                  <TurnstileWidget
                    onToken={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                  />
                )}
                <Button
                  mode="contained"
                  onPress={handleSendOtp}
                  loading={otpSending}
                  disabled={otpSending || (isWeb && !turnstileToken)}
                  style={[styles.button, { borderRadius: 12 }]}
                  icon="message-text"
                >
                  Send Verification Code
                </Button>
                <Divider style={styles.divider} />
                <Button mode="text" icon="login" onPress={() => switchMode(profile ? 'login' : 'restore')} style={styles.linkBtn}>
                  Already have an account? Sign in
                </Button>
              </View>
            )}

            {/* Step: OTP */}
            {regStep === 'otp' && (
              <View style={styles.stepBlock}>
                <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  Verify your phone number
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 4 }}>
                  We sent a 6-digit SMS code to {regCountry.code} {regPhone}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
                  This one-time code confirms your number — it's not your app PIN.
                </Text>
                {(otpVerifying) ? (
                  <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 24 }} />
                ) : (
                  <OtpInput
                    value={regOtp}
                    onChange={v => { setRegOtp(v); setRegError(''); }}
                    onComplete={handleVerifyRegOtp}
                    disabled={otpVerifying}
                  />
                )}
                {regError ? (
                  <HelperText type="error" style={[styles.helper, { textAlign: 'center' }]}>{regError}</HelperText>
                ) : null}
                <Button
                  mode="text"
                  icon="refresh"
                  onPress={handleResendOtp}
                  disabled={resendCooldown > 0 || otpSending}
                  loading={otpSending}
                  style={styles.linkBtn}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </Button>
                <Button mode="text" icon="arrow-left" onPress={() => { setRegStep('phone'); setRegOtp(''); setRegError(''); clearOtpError(); }} style={styles.linkBtn}>
                  Change number
                </Button>
              </View>
            )}

            {/* Step: name */}
            {regStep === 'name' && (
              <View style={styles.stepBlock}>
                <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  What's your name?
                </Text>
                <TextInput
                  label="Your Name"
                  value={regName}
                  onChangeText={t => { setRegName(t); setRegError(''); }}
                  mode="outlined"
                  style={styles.input}
                  placeholder="e.g., Rohit Sharma"
                  left={<TextInput.Icon icon="account" />}
                  error={!!regError}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (regName.trim()) { setRegStep('role'); setRegError(''); }
                    else setRegError('Name is required');
                  }}
                />
                {regError ? <HelperText type="error" style={styles.helper}>{regError}</HelperText> : null}
                <Button
                  mode="contained"
                  onPress={() => {
                    if (!regName.trim()) { setRegError('Name is required'); return; }
                    setRegError('');
                    setRegStep('role');
                  }}
                  style={[styles.button, { borderRadius: 12 }]}
                  icon="arrow-right"
                >
                  Continue
                </Button>
                <Button mode="text" icon="arrow-left" onPress={() => { setRegStep('otp'); setRegError(''); }} style={[styles.linkBtn, { marginTop: 8 }]}>
                  Back
                </Button>
              </View>
            )}

            {/* Step: role */}
            {regStep === 'role' && (
              <View style={styles.stepBlock}>
                <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  How will you use Inningsly?
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
                    const selected = regRole === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        onPress={() => setRegRole(r.value)}
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
                          size={26}
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
                <Button
                  mode="contained"
                  onPress={() => setRegStep('pin')}
                  style={[styles.button, { borderRadius: 12 }]}
                  icon="arrow-right"
                >
                  Continue
                </Button>
                <Button mode="text" icon="arrow-left" onPress={() => setRegStep('name')} style={[styles.linkBtn, { marginTop: 8 }]}>
                  Back
                </Button>
              </View>
            )}

            {/* Step: pin + confirm (merged) */}
            {regStep === 'pin' && (
              <View style={styles.stepBlock}>
                <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                  Create your app PIN
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 12 }}>
                  You'll enter this PIN every time you open Inningsly.{'\n'}It's separate from the SMS code you just received.
                </Text>
                <TextInput
                  label="Create PIN (4–6 digits)"
                  value={regPin}
                  onChangeText={t => { setRegPin(t.replace(/\D/g, '')); setRegError(''); }}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="numeric"
                  secureTextEntry={!showRegPin}
                  maxLength={6}
                  error={!!regError}
                  left={<TextInput.Icon icon="lock" />}
                  right={<TextInput.Icon icon={showRegPin ? 'eye-off' : 'eye'} onPress={() => setShowRegPin(v => !v)} />}
                  autoFocus
                  returnKeyType="next"
                />
                <PinDots count={regPin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
                <TextInput
                  label="Confirm PIN"
                  value={regConfirmPin}
                  onChangeText={t => { setRegConfirmPin(t.replace(/\D/g, '')); setRegError(''); }}
                  mode="outlined"
                  style={[styles.input, { marginTop: 8 }]}
                  keyboardType="numeric"
                  secureTextEntry={!showRegConfirmPin}
                  maxLength={6}
                  error={!!regError}
                  left={<TextInput.Icon icon="lock-check" />}
                  right={<TextInput.Icon icon={showRegConfirmPin ? 'eye-off' : 'eye'} onPress={() => setShowRegConfirmPin(v => !v)} />}
                  returnKeyType="done"
                  onSubmitEditing={handleFinishRegister}
                />
                <PinDots
                  count={regConfirmPin.length}
                  max={6}
                  color={regConfirmPin.length > 0 && regPin !== regConfirmPin ? theme.colors.error : theme.colors.primary}
                  dimColor={theme.colors.outlineVariant}
                />
                {regError ? <HelperText type="error" style={styles.helper}>{regError}</HelperText> : null}
                <Button
                  mode="contained"
                  onPress={handleFinishRegister}
                  loading={regBusy}
                  disabled={regBusy}
                  style={[styles.button, { borderRadius: 12 }]}
                  icon="account-plus"
                >
                  Create Account
                </Button>
                <Button mode="text" icon="arrow-left" onPress={() => { setRegStep('role'); setRegPin(''); setRegConfirmPin(''); setRegError(''); }} style={[styles.linkBtn, { marginTop: 8 }]}>
                  Back
                </Button>
              </View>
            )}
          </View>
        )}

        {/* ── LOGIN ── */}
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
              value={loginPin}
              onChangeText={t => { setLoginPin(t.replace(/\D/g, '')); setLoginError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry={!showLoginPin}
              maxLength={6}
              error={!!loginError}
              left={<TextInput.Icon icon="lock" />}
              right={<TextInput.Icon icon={showLoginPin ? 'eye-off' : 'eye'} onPress={() => setShowLoginPin(v => !v)} />}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
              autoFocus
            />
            <PinDots count={loginPin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
            {loginError ? <HelperText type="error" style={styles.helper}>{loginError}</HelperText> : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loginBusy}
              disabled={loginBusy}
              style={[styles.button, { borderRadius: 12 }]}
              icon="login"
            >
              Unlock
            </Button>
            <Divider style={styles.divider} />
            <Button mode="contained-tonal" icon="account-switch" onPress={() => { setRestorePhone(''); switchMode('restore'); }} style={{ borderRadius: 10, marginBottom: 4 }}>
              Login as different user
            </Button>
            <Button mode="text" icon="lock-reset" onPress={() => switchMode('restore')} style={styles.linkBtn}>
              Forgot PIN?
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

        {/* ── RESTORE ── */}
        {mode === 'restore' && (
          <View style={styles.form}>
            {/* Tab toggle */}
            <View style={[styles.restoreTabs, { borderColor: theme.colors.outlineVariant }]}>
              {(['pin', 'otp'] as RestoreTab[]).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => { setRestoreTab(tab); setRestoreOtpStep('phone'); setRestoreOtpError(''); clearOtpError(); }}
                  style={[
                    styles.restoreTab,
                    tab === restoreTab && { backgroundColor: theme.colors.primaryContainer },
                  ]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={tab === 'pin' ? 'lock-outline' : 'message-text-outline'}
                    size={16}
                    color={tab === restoreTab ? theme.colors.primary : theme.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="labelMedium"
                    style={{ color: tab === restoreTab ? theme.colors.primary : theme.colors.onSurfaceVariant, marginLeft: 6 }}
                  >
                    {tab === 'pin' ? 'I know my PIN' : 'Forgot PIN? Use OTP'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Restore — PIN sub-form */}
            {restoreTab === 'pin' && (
              <View style={styles.stepBlock}>
                <CountryPicker value={restoreCountry} onChange={c => { setRestoreCountry(c); setRestorePhone(''); }} />
                <TextInput
                  label="Phone Number"
                  value={restorePhone}
                  onChangeText={t => { setRestorePhone(t.replace(/\D/g, '')); setRestorePinError(''); }}
                  mode="outlined"
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={restoreCountry.digits}
                  placeholder={`${restoreCountry.digits}-digit number`}
                  left={<TextInput.Icon icon="phone" />}
                  error={!!restorePinError}
                  autoFocus
                  returnKeyType="next"
                />
                <TextInput
                  label="Enter PIN"
                  value={restorePin}
                  onChangeText={t => { setRestorePin(t.replace(/\D/g, '')); setRestorePinError(''); }}
                  mode="outlined"
                  style={[styles.input, { marginTop: 8 }]}
                  keyboardType="numeric"
                  secureTextEntry={!showRestorePin}
                  maxLength={6}
                  error={!!restorePinError}
                  left={<TextInput.Icon icon="lock" />}
                  right={<TextInput.Icon icon={showRestorePin ? 'eye-off' : 'eye'} onPress={() => setShowRestorePin(v => !v)} />}
                  onSubmitEditing={handlePinRestore}
                  returnKeyType="done"
                />
                <PinDots count={restorePin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
                {restorePinError ? <HelperText type="error" style={styles.helper}>{restorePinError}</HelperText> : null}
                {restoreStatus === 'fetching' && (
                  <HelperText type="info" style={[styles.helper, { color: theme.colors.primary }]}>Connecting to server…</HelperText>
                )}
                <Button
                  mode="contained"
                  onPress={handlePinRestore}
                  loading={restoreBusy}
                  disabled={restoreBusy}
                  style={[styles.button, { borderRadius: 12 }]}
                  icon="cloud-download"
                >
                  Restore Account
                </Button>
              </View>
            )}

            {/* Restore — OTP sub-flow */}
            {restoreTab === 'otp' && (
              <View style={styles.stepBlock}>
                {restoreOtpStep === 'phone' && (
                  <>
                    <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                      Verify your number
                    </Text>
                    <CountryPicker value={restoreOtpCountry} onChange={c => { setRestoreOtpCountry(c); setRestoreOtpPhone(''); }} />
                    <TextInput
                      label="Phone Number"
                      value={restoreOtpPhone}
                      onChangeText={t => { setRestoreOtpPhone(t.replace(/\D/g, '')); setRestoreOtpError(''); }}
                      mode="outlined"
                      style={styles.input}
                      keyboardType="number-pad"
                      maxLength={restoreOtpCountry.digits}
                      placeholder={`${restoreOtpCountry.digits}-digit number`}
                      left={<TextInput.Icon icon="phone" />}
                      error={!!restoreOtpError}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleRestoreOtpSend}
                    />
                    {restoreOtpError ? <HelperText type="error" style={styles.helper}>{restoreOtpError}</HelperText> : null}
                    {isWeb && (
                      <TurnstileWidget
                        onToken={setTurnstileToken}
                        onExpire={() => setTurnstileToken('')}
                      />
                    )}
                    <Button
                      mode="contained"
                      onPress={handleRestoreOtpSend}
                      loading={otpSending}
                      disabled={otpSending || (isWeb && !turnstileToken)}
                      style={[styles.button, { borderRadius: 12 }]}
                      icon="message-text"
                    >
                      Send Verification Code
                    </Button>
                  </>
                )}

                {restoreOtpStep === 'otp' && (
                  <>
                    <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                      Verify your phone number
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 4 }}>
                      We sent a 6-digit SMS code to {restoreOtpCountry.code} {restoreOtpPhone}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
                      This one-time code confirms your number — it's not your app PIN.
                    </Text>
                    {otpVerifying ? (
                      <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 24 }} />
                    ) : (
                      <OtpInput
                        value={restoreOtpCode}
                        onChange={v => { setRestoreOtpCode(v); setRestoreOtpError(''); }}
                        onComplete={handleRestoreOtpVerify}
                        disabled={otpVerifying}
                      />
                    )}
                    {restoreOtpError ? (
                      <HelperText type="error" style={[styles.helper, { textAlign: 'center' }]}>{restoreOtpError}</HelperText>
                    ) : null}
                    <Button
                      mode="text"
                      icon="refresh"
                      onPress={async () => {
                        if (resendCooldown > 0) return;
                        const fullPhone = `${restoreOtpCountry.code.replace('+', '')}${restoreOtpPhone}`;
                        const ok = await sendOtp(fullPhone);
                        if (ok) { setRestoreOtpCode(''); startResendCooldown(); }
                      }}
                      disabled={resendCooldown > 0 || otpSending}
                      loading={otpSending}
                      style={styles.linkBtn}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Button>
                    <Button mode="text" icon="arrow-left" onPress={() => { setRestoreOtpStep('phone'); setRestoreOtpCode(''); setRestoreOtpError(''); clearOtpError(); }} style={styles.linkBtn}>
                      Change number
                    </Button>
                  </>
                )}

                {restoreOtpStep === 'pin' && (
                  <>
                    <Text variant="titleMedium" style={[styles.stepTitle, { color: theme.colors.onSurface }]}>
                      Set a new PIN, {verifiedName}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 12 }}>
                      You'll use this PIN to sign in — it's separate from the SMS code.
                    </Text>
                    <TextInput
                      label="New PIN (4–6 digits)"
                      value={restoreNewPin}
                      onChangeText={t => { setRestoreNewPin(t.replace(/\D/g, '')); setRestoreOtpError(''); }}
                      mode="outlined"
                      style={styles.input}
                      keyboardType="numeric"
                      secureTextEntry={!showRestoreNewPin}
                      maxLength={6}
                      error={!!restoreOtpError}
                      left={<TextInput.Icon icon="lock" />}
                      right={<TextInput.Icon icon={showRestoreNewPin ? 'eye-off' : 'eye'} onPress={() => setShowRestoreNewPin(v => !v)} />}
                      autoFocus
                      returnKeyType="next"
                    />
                    <PinDots count={restoreNewPin.length} max={6} color={theme.colors.primary} dimColor={theme.colors.outlineVariant} />
                    <TextInput
                      label="Confirm PIN"
                      value={restoreConfirmPin}
                      onChangeText={t => { setRestoreConfirmPin(t.replace(/\D/g, '')); setRestoreOtpError(''); }}
                      mode="outlined"
                      style={[styles.input, { marginTop: 8 }]}
                      keyboardType="numeric"
                      secureTextEntry={!showRestoreConfirmPin}
                      maxLength={6}
                      error={!!restoreOtpError}
                      left={<TextInput.Icon icon="lock-check" />}
                      right={<TextInput.Icon icon={showRestoreConfirmPin ? 'eye-off' : 'eye'} onPress={() => setShowRestoreConfirmPin(v => !v)} />}
                      returnKeyType="done"
                      onSubmitEditing={handleRestoreOtpSetPin}
                    />
                    <PinDots
                      count={restoreConfirmPin.length}
                      max={6}
                      color={restoreConfirmPin.length > 0 && restoreNewPin !== restoreConfirmPin ? theme.colors.error : theme.colors.primary}
                      dimColor={theme.colors.outlineVariant}
                    />
                    {restoreOtpError ? <HelperText type="error" style={styles.helper}>{restoreOtpError}</HelperText> : null}
                    <Button
                      mode="contained"
                      onPress={handleRestoreOtpSetPin}
                      loading={restoreBusy}
                      disabled={restoreBusy}
                      style={[styles.button, { borderRadius: 12 }]}
                      icon="lock-reset"
                    >
                      Reset PIN & Sign In
                    </Button>
                  </>
                )}
              </View>
            )}

            <Divider style={styles.divider} />
            <Button mode="text" icon="arrow-left" onPress={() => switchMode(profile ? 'login' : 'register')} style={styles.linkBtn}>
              Back
            </Button>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flexGrow: 1, justifyContent: 'center', padding: 28 },
  header:        { alignItems: 'center', marginBottom: 32 },
  iconWrap:      { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName:       { fontWeight: '900', marginBottom: 8 },
  form:          { gap: 0 },
  stepBlock:     { gap: 0 },
  stepTitle:     { fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  input:         { marginBottom: 0 },
  helper:        { marginBottom: 6, marginTop: -4 },
  button:        { marginTop: 16 },
  divider:       { marginVertical: 20 },
  linkBtn:       { alignSelf: 'center' },
  profileChip:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, marginBottom: 16 },
  roleGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roleCard:      { flex: 1, minWidth: '44%', maxWidth: '48%', borderWidth: 2, borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 },
  pinDots:       { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 6, marginBottom: 10 },
  pinDot:        { width: 10, height: 10, borderRadius: 5 },
  countryRow:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  countryOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  progressWrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 28 },
  progressDot:   { height: 8, borderRadius: 4 },
  restoreTabs:   { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  restoreTab:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8 },
  otpWrap:       { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  otpHidden:     { position: 'absolute', width: 1, height: 1, opacity: 0 },
  otpBox:        { width: 44, height: 54, borderWidth: 2, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
