/**
 * AdminPinModal — prompts the user to enter the team admin PIN.
 *
 * Usage:
 *   <AdminPinModal
 *     visible={showPin}
 *     teamId={team.id}
 *     adminPinHash={team.adminPinHash}
 *     onSuccess={() => setShowPin(false)}
 *     onDismiss={() => setShowPin(false)}
 *   />
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
        <Text variant="titleMedium" style={styles.title}>Admin Access Required</Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          Enter the team admin PIN to continue.
        </Text>

        <TextInput
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
          <Button mode="text" onPress={handleDismiss}>Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={checking}
            disabled={!pin.trim() || checking}
          >
            Unlock
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: { margin: 24, borderRadius: 16, padding: 24 },
  title: { fontWeight: 'bold', marginBottom: 4 },
  subtitle: { color: '#666', marginBottom: 16 },
  input: { marginBottom: 8 },
  error: { marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
});
