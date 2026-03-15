import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamStore } from '../../../src/store/team-store';

export default function EditTeamScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);
  const updateTeamAction = useTeamStore(s => s.updateTeam);

  const team = teams.find(t => t.id === id);

  const [name, setName] = useState(team?.name ?? '');
  const [shortName, setShortName] = useState(team?.shortName ?? '');
  const [error, setError] = useState('');

  if (!team) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Team not found</Text>
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
      <Stack.Screen options={{ title: `Edit ${team.name}` }} />
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
