import { View, StyleSheet } from 'react-native';
import { Text, useTheme, Chip } from 'react-native-paper';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTeamStore } from '../../src/store/team-store';

export default function PlayerProfileScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useTeamStore(s => s.teams);

  let player = null;
  let team = null;
  for (const t of teams) {
    const p = t.players.find(p => p.id === id);
    if (p) { player = p; team = t; break; }
  }

  if (!player || !team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Player not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: player.name }} />
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text variant="headlineSmall" style={{ color: '#FFF', fontWeight: 'bold' }}>{player.name}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{team.name}</Text>
        <View style={styles.chips}>
          {player.isWicketKeeper && (
            <Chip style={styles.chip} textStyle={{ color: '#FFF', fontSize: 11 }}>Wicket Keeper</Chip>
          )}
          {player.isAllRounder && (
            <Chip style={[styles.chip, { backgroundColor: '#A5D6A7' }]} textStyle={{ color: '#1B5E20', fontSize: 11 }}>All-Rounder</Chip>
          )}
        </View>
      </View>
      <View style={styles.content}>
        <Text variant="labelMedium" style={styles.fieldLabel}>BATTING</Text>
        <Text variant="bodyLarge">{player.battingStyle === 'right' ? 'Right Hand' : 'Left Hand'}</Text>

        <Text variant="labelMedium" style={[styles.fieldLabel, { marginTop: 16 }]}>BOWLING</Text>
        <Text variant="bodyLarge">{player.bowlingStyle === 'none' ? 'Does not bowl' : player.bowlingStyle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  chip: { backgroundColor: 'rgba(255,255,255,0.25)' },
  content: { padding: 24 },
  fieldLabel: { color: '#888', letterSpacing: 1 },
});
