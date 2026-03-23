import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme, Portal, Dialog } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamStore } from '../../../src/store/team-store';
import { usePrefsStore } from '../../../src/store/prefs-store';
import { useAdminAuth } from '../../../src/hooks/useAdminAuth';

export default function EditTeamScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const updateTeamAction = useTeamStore(s => s.updateTeam);

  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const delegateTeamIds = usePrefsStore(s => s.delegateTeamIds);
  const isAdmin = useAdminAuth(s => s.isAdmin);
  const authenticate = useAdminAuth(s => s.authenticate);

  const team = teams.find(t => t.id === id);

  const isMyTeam = team ? myTeamIds.includes(team.id) : false;
  const isDelegate = team ? delegateTeamIds.includes(team.id) : false;
  const hasEditAccess = isMyTeam || isDelegate;
  const adminUnlocked = isMyTeam && team ? isAdmin(team.id, team.adminPinHash) : false;
  const needsPinUnlock = isMyTeam && !!team?.adminPinHash && !adminUnlocked;

  const [name, setName] = useState(team?.name ?? '');
  const [shortName, setShortName] = useState(team?.shortName ?? '');
  const [error, setError] = useState('');

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handlePinSubmit = async () => {
    if (!team) return;
    const ok = await authenticate(team.id, team.adminPinHash!, pinInput);
    if (ok) {
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  if (!team) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Team not found</Text>
      </View>
    );
  }

  if (!hasEditAccess) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Stack.Screen options={{ headerBackTitle: '', title: 'Edit Team' }} />
        <Text variant="titleMedium" style={{ textAlign: 'center', marginBottom: 12 }}>
          You don&apos;t have permission to edit this team.
        </Text>
        <Button mode="text" onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  if (needsPinUnlock) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Stack.Screen options={{ headerBackTitle: '', title: 'Edit Team' }} />
        <Text variant="titleMedium" style={{ textAlign: 'center', marginBottom: 12 }}>
          Admin PIN required to edit this team.
        </Text>
        <Button mode="contained" onPress={() => setShowPinModal(true)}>Enter PIN</Button>
        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>Go Back</Button>

        <Portal>
          <Dialog visible={showPinModal} onDismiss={() => setShowPinModal(false)}>
            <Dialog.Title>Admin PIN</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="PIN"
                value={pinInput}
                onChangeText={(t) => { setPinInput(t); setPinError(''); }}
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                mode="outlined"
              />
              {pinError ? <Text style={{ color: theme.colors.error, marginTop: 4 }}>{pinError}</Text> : null}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}>Cancel</Button>
              <Button onPress={handlePinSubmit}>Unlock</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Team name is required'); return; }
    if (!shortName.trim()) { setError('Short name is required'); return; }
    await updateTeamAction(id, name.trim(), shortName.trim().toUpperCase());
    router.back();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ headerBackTitle: '', title: `Edit ${team.name}` }} />
      <View style={styles.form}>
        <TextInput
          label="Team Name"
          value={name}
          onChangeText={(t) => { setName(t); setError(''); }}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Short Name"
          value={shortName}
          onChangeText={(t) => { setShortName(t.toUpperCase()); setError(''); }}
          mode="outlined"
          style={styles.input}
          maxLength={5}
        />
        {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
        <Button mode="contained" onPress={handleSave} style={styles.button}>Save Changes</Button>
        <Button mode="text" onPress={() => router.back()} style={styles.button}>Cancel</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 24 },
  input: { marginBottom: 16 },
  button: { marginTop: 8 },
});
