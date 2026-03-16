/**
 * SetAdminPinModal — lets an authenticated admin set, change, or remove the team admin PIN.
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, TextInput, Button, useTheme } from 'react-native-paper';
import { hashAdminPin } from '../hooks/useAdminAuth';
import { useTeamStore } from '../store/team-store';

interface Props {
  visible: boolean;
  teamId: string;
  hasPinAlready: boolean;
  onDone: () => void;
  onDismiss: () => void;
}

export function SetAdminPinModal({ visible, teamId, hasPinAlready, onDone, onDismiss }: Props) {
  const theme = useTheme();
  const setTeamAdminPin = useTeamStore(s => s.setTeamAdminPin);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setPin(''); setConfirm(''); setError(''); };

  const handleSave = async () => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    if (pin !== confirm) { setError('PINs do not match.'); return; }
    setSaving(true);
    const hash = await hashAdminPin(pin);
    await setTeamAdminPin(teamId, hash);
    setSaving(false);
    reset();
    onDone();
  };

  const handleRemove = async () => {
    setSaving(true);
    await setTeamAdminPin(teamId, null);
    setSaving(false);
    reset();
    onDone();
  };

  const handleDismiss = () => { reset(); onDismiss(); };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={[styles.container, { backgroundColor: theme.colors.surface }]}
      >
        <View style={[styles.iconRow, { backgroundColor: theme.colors.primary + '18' }]}>
          <Text style={styles.lockIcon}>{hasPinAlready ? '🔑' : '🛡️'}</Text>
        </View>
        <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          {hasPinAlready ? 'Change Admin PIN' : 'Set Admin PIN'}
        </Text>
        <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Anyone who knows this PIN can manage the team roster and settings.
          {!hasPinAlready ? ' Skip to keep the team open (no PIN).' : ''}
        </Text>

        <TextInput
          label="New PIN (min 4 digits)"
          value={pin}
          onChangeText={t => { setPin(t); setError(''); }}
          mode="outlined"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={12}
          style={styles.input}
          autoFocus
        />
        <TextInput
          label="Confirm PIN"
          value={confirm}
          onChangeText={t => { setConfirm(t); setError(''); }}
          mode="outlined"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={12}
          style={styles.input}
          onSubmitEditing={handleSave}
        />

        {!!error && (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
            {error}
          </Text>
        )}

        <View style={styles.actions}>
          {hasPinAlready && (
            <Button mode="text" textColor={theme.colors.error} onPress={handleRemove} loading={saving}>
              Remove PIN
            </Button>
          )}
          <Button mode="text" onPress={handleDismiss} textColor={theme.colors.onSurfaceVariant}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={!pin || !confirm || saving}
          >
            Save
          </Button>
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
  input: { marginBottom: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8, flexWrap: 'wrap' },
});
