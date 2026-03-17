import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserAuth } from '../src/hooks/useUserAuth';

/**
 * Shown on first launch (register) or on return (enter PIN to unlock).
 * Parent (_layout) decides which mode to render based on whether a profile exists.
 */
export default function LoginScreen() {
  const theme = useTheme();
  const { profile, register, login } = useUserAuth();

  const isRegistering = !profile;

  // Shared
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Registration only
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const pinMismatch = isRegistering && confirmPin.length > 0 && pin !== confirmPin;

  const handleSubmit = async () => {
    setError('');
    if (isRegistering) {
      if (!phone.trim()) { setError('Phone number is required'); return; }
      if (!/^\+?[0-9]{7,15}$/.test(phone.replace(/\s/g, ''))) { setError('Enter a valid phone number'); return; }
      if (!name.trim()) { setError('Your name is required'); return; }
      if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
      if (pin !== confirmPin) { setError('PINs do not match'); return; }
      setBusy(true);
      try {
        await register(phone.trim(), name.trim(), pin);
      } finally {
        setBusy(false);
      }
    } else {
      if (pin.length < 4) { setError('Enter your PIN'); return; }
      setBusy(true);
      try {
        const ok = await login(pin);
        if (!ok) setError('Incorrect PIN. Try again.');
      } finally {
        setBusy(false);
      }
    }
  };

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
            {isRegistering ? 'Create your player profile to get started' : `Welcome back, ${profile!.name}!`}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {isRegistering && (
            <>
              <TextInput
                label="Phone Number"
                value={phone}
                onChangeText={t => { setPhone(t); setError(''); }}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                placeholder="+91 98765 43210"
                left={<TextInput.Icon icon="phone" />}
                autoFocus
              />
              <TextInput
                label="Your Name"
                value={name}
                onChangeText={t => { setName(t); setError(''); }}
                mode="outlined"
                style={styles.input}
                placeholder="e.g., Rohit Sharma"
                left={<TextInput.Icon icon="account" />}
              />
            </>
          )}

          {!isRegistering && (
            <View style={[styles.profileChip, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name="phone" size={16} color={theme.colors.onPrimaryContainer} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600' }}>
                {profile!.phone}
              </Text>
            </View>
          )}

          <TextInput
            label={isRegistering ? 'Create PIN (4–6 digits)' : 'Enter PIN'}
            value={pin}
            onChangeText={t => { setPin(t.replace(/[^0-9]/g, '')); setError(''); }}
            mode="outlined"
            style={styles.input}
            keyboardType="numeric"
            secureTextEntry
            maxLength={6}
            left={<TextInput.Icon icon="lock" />}
            onSubmitEditing={isRegistering ? undefined : handleSubmit}
            returnKeyType={isRegistering ? 'next' : 'done'}
          />

          {isRegistering && (
            <>
              <TextInput
                label="Confirm PIN"
                value={confirmPin}
                onChangeText={t => { setConfirmPin(t.replace(/[^0-9]/g, '')); setError(''); }}
                mode="outlined"
                style={styles.input}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                error={pinMismatch}
                left={<TextInput.Icon icon="lock-check" />}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
              />
              {pinMismatch && <HelperText type="error">PINs do not match</HelperText>}
            </>
          )}

          {error ? (
            <HelperText type="error" style={styles.errorText}>{error}</HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={busy}
            disabled={busy}
            style={[styles.button, { borderRadius: 12 }]}
            icon={isRegistering ? 'account-plus' : 'login'}
          >
            {isRegistering ? 'Create Account' : 'Unlock'}
          </Button>
        </View>
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
});
