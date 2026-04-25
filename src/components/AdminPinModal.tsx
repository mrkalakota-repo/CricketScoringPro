/**
 * AdminPinModal — prompts the user to enter the team admin PIN.
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, TextInput, Button, useTheme } from 'react-native-paper';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface Props {
  visible: boolean;
  teamId: string;
  adminPinHash: string;
  onSuccess: () => void;
  onDismiss: () => void;
}

export function AdminPinModal({ visible, teamId, adminPinHash, onSuccess, onDismiss }: Props) {
  const theme = useTheme();
  const authenticate = useAdminAuth(s => s.authenticate);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!pin.trim()) return;
    setChecking(true);
    setError('');
    const ok = await authenticate(teamId, adminPinHash, pin);
    setChecking(false);
    if (ok) {
      setPin('');
      onSuccess();
    } else {
      setError('Incorrect PIN. Please try again.');
    }
  };

  const handleDismiss = () => {
    setPin('');
    setError('');
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={[styles.container, { backgroundColor: theme.colors.surface }]}
      >
        <View testID="admin-pin-modal">
        <View style={[styles.iconRow, { backgroundColor: theme.colors.primary + '18' }]}>
          <Text style={[styles.lockIcon]}>🔒</Text>
        </View>
        <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          Admin Access Required
        </Text>
        <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Enter the team admin PIN to continue.
        </Text>

        <TextInput
          testID="admin-pin-input"
          label="Admin PIN"
          value={pin}
          onChangeText={t => { setPin(t); setError(''); }}
          mode="outlined"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={12}
          style={styles.input}
          autoFocus
          onSubmitEditing={handleSubmit}
        />

        {!!error && (
          <Text variant="bodySmall" style={[styles.error, { color: theme.colors.error }]}>
            {error}
          </Text>
        )}

        <View style={styles.actions}>
          <Button mode="text" onPress={handleDismiss} textColor={theme.colors.onSurfaceVariant}>
            Cancel
          </Button>
          <Button
            testID="admin-pin-confirm-btn"
            mode="contained"
            onPress={handleSubmit}
            loading={checking}
            disabled={!pin.trim() || checking}
          >
            Unlock
          </Button>
        </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { margin: 24, borderRadius: 20, padding: 24 },
  iconRow: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 14, alignSelf: 'center' },
  lockIcon: { fontSize: 24 },
  title: { fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { marginBottom: 20, textAlign: 'center', lineHeight: 18 },
  input: { marginBottom: 8 },
  error: { marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
