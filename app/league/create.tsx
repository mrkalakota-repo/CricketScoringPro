import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, useTheme, SegmentedButtons, Card } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLeagueStore } from '../../src/store/league-store';
import type { LeagueFormat } from '../../src/engine/types';

const MAX_LEN = 50;
const MAX_SHORT = 8;

export default function CreateLeagueScreen() {
  const router = useRouter();
  const theme = useTheme();
  const createLeague = useLeagueStore(s => s.createLeague);

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [format, setFormat] = useState<LeagueFormat>('round_robin');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const n = name.trim();
    const s = shortName.trim().toUpperCase();
    if (!n) { setError('League name is required'); return; }
    if (!s) { setError('Short name is required'); return; }
    setSaving(true);
    try {
      const league = await createLeague(n, s, format);
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

        <Text variant="labelLarge" style={{ color: theme.colors.onSurface, marginBottom: 8, marginTop: 4 }}>Format</Text>
        <SegmentedButtons
          value={format}
          onValueChange={v => setFormat(v as LeagueFormat)}
          buttons={[
            { value: 'round_robin', label: 'Round Robin', icon: 'autorenew' },
            { value: 'knockout', label: 'Knockout', icon: 'tournament' },
          ]}
          style={{ marginBottom: 12 }}
        />

        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Card.Content style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <MaterialCommunityIcons
              name={format === 'knockout' ? 'tournament' : 'autorenew'}
              size={20}
              color={theme.colors.primary}
              style={{ marginTop: 2 }}
            />
            <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
              {format === 'round_robin'
                ? 'Every team plays every other team. Points table with NRR determines the winner.'
                : 'Single-elimination bracket. Winners advance automatically. Losers are eliminated.'}
            </Text>
          </Card.Content>
        </Card>

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
