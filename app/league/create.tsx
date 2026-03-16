import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { useLeagueStore } from '../../src/store/league-store';

const MAX_LEN = 50;
const MAX_SHORT = 8;

export default function CreateLeagueScreen() {
  const router = useRouter();
  const theme = useTheme();
  const createLeague = useLeagueStore(s => s.createLeague);

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const n = name.trim();
    const s = shortName.trim().toUpperCase();
    if (!n) { setError('League name is required'); return; }
    if (!s) { setError('Short name is required'); return; }
    setSaving(true);
    try {
      const league = await createLeague(n, s);
      router.replace(`/league/${league.id}`);
    } catch {
      setError('Could not create league. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'New League' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          label="League Name"
          value={name}
          onChangeText={t => { setName(t.substring(0, MAX_LEN)); setError(''); }}
          mode="outlined"
          style={styles.input}
          autoFocus
          maxLength={MAX_LEN}
          placeholder="e.g. Summer T20 League 2026"
        />
        <TextInput
          label="Short Name"
          value={shortName}
          onChangeText={t => { setShortName(t.substring(0, MAX_SHORT).toUpperCase()); setError(''); }}
          mode="outlined"
          style={styles.input}
          maxLength={MAX_SHORT}
          placeholder="e.g. STL26"
          autoCapitalize="characters"
        />
        {!!error && (
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>
        )}
        <Button
          mode="contained"
          onPress={handleCreate}
          loading={saving}
          disabled={!name.trim() || !shortName.trim() || saving}
          style={styles.button}
        >
          Create League
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 4 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 20 },
});
