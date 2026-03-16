/**
 * Find My Profile — players enter their 6-character player code to jump to their
 * profile screen. Admins share this code with each player (visible on the player
 * card when the roster is open).
 *
 * Since Gully Cricket Scorer is a local-first app, profiles live on the device
 * that manages the team. Players can view and update their batting/bowling
 * preferences by entering their code on that same device (or any device where
 * the team has been set up).
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, useTheme, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTeamStore } from '../src/store/team-store';
import { getPlayerCode } from '../src/utils/player-code';

export default function FindProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const teams = useTeamStore(s => s.teams);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleFind = () => {
    const entered = code.trim().toUpperCase();
    if (entered.length !== 6) {
      setError('Player code must be exactly 6 characters.');
      return;
    }

    for (const team of teams) {
      for (const player of team.players) {
        if (getPlayerCode(player.id) === entered) {
          router.push(`/player/${player.id}`);
          return;
        }
      }
    }

    setError('No player found with that code. Make sure the code is correct and the team has been set up on this device.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }]}>
      <View style={styles.inner}>
        <MaterialCommunityIcons name="account-search" size={64} color={theme.colors.primary} />
        <Text variant="headlineSmall" style={[styles.title, { color: '#1A1A1A' }]}>Find My Profile</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Enter the 6-character player code your team admin shared with you to view your profile and stats.
        </Text>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <TextInput
            label="Player Code"
            value={code}
            onChangeText={t => { setCode(t.toUpperCase()); setError(''); }}
            mode="outlined"
            autoCapitalize="characters"
            maxLength={6}
            style={styles.input}
            autoFocus
            onSubmitEditing={handleFind}
            placeholder="e.g. A1B2C3"
          />
          {!!error && (
            <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
              {error}
            </Text>
          )}
          <Button
            mode="contained"
            onPress={handleFind}
            disabled={code.trim().length !== 6}
            icon="account-search"
          >
            Find My Profile
          </Button>
        </Surface>

        <Text variant="bodySmall" style={styles.hint}>
          {'Your player code is shown on your player card in the team roster. Ask your team admin to share it with you.'}
        </Text>

        <Button mode="text" onPress={() => router.back()} style={{ marginTop: 8 }}>
          Go Back
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', padding: 24 },
  title: { fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  subtitle: { color: '#555', textAlign: 'center', marginBottom: 24 },
  card: { width: '100%', padding: 16, borderRadius: 16 },
  input: { marginBottom: 12 },
  hint: { color: '#999', textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
});
