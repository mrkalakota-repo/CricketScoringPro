import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTeamStore } from '../../src/store/team-store';

export default function CreateTeamScreen() {
  const router = useRouter();
  const theme = useTheme();
  const createTeam = useTeamStore(s => s.createTeam);

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }
    if (!shortName.trim()) {
      setError('Short name is required');
      return;
    }
    if (shortName.length > 5) {
      setError('Short name must be 5 characters or less');
      return;
    }

    const team = await createTeam(name.trim(), shortName.trim().toUpperCase());
    router.replace(`/team/${team.id}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.form}>
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.primary }]}>
          Create New Team
        </Text>

        <TextInput
          label="Team Name"
          value={name}
          onChangeText={(t) => { setName(t); setError(''); }}
          mode="outlined"
          style={styles.input}
          placeholder="e.g., Mumbai Indians"
        />

        <TextInput
          label="Short Name"
          value={shortName}
          onChangeText={(t) => { setShortName(t.toUpperCase()); setError(''); }}
          mode="outlined"
          style={styles.input}
          placeholder="e.g., MI"
          maxLength={5}
          autoCapitalize="characters"
        />

        {error ? (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
            {error}
          </Text>
        ) : null}

        <Button mode="contained" onPress={handleCreate} style={styles.button}>
          Create Team
        </Button>

        <Button mode="text" onPress={() => router.back()} style={styles.button}>
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  form: { padding: 24 },
  title: { fontWeight: 'bold', marginBottom: 24 },
  input: { marginBottom: 16 },
  button: { marginTop: 8 },
});
