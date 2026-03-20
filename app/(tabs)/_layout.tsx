import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APP_NAME = 'Gully Cricket Scorer';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({ name, activeName, color, size, focused }: {
  name: IconName; activeName: IconName; color: string; size: number; focused: boolean;
}) {
  return <MaterialCommunityIcons name={focused ? activeName : name} size={size} color={color} />;
}

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const tabBarHeight = 60 + Math.max(insets.bottom, 4);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800', fontSize: 17, letterSpacing: 0.3 },
        tabBarStyle: {
          borderTopWidth: 0,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          height: tabBarHeight,
          backgroundColor: theme.colors.surface,
          elevation: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.10,
          shadowRadius: 8,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: APP_NAME,
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home-outline" activeName="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="trophy-outline" activeName="trophy" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="shield-account-outline" activeName="shield-account" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="chat-outline" activeName="chat" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'Leagues',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="tournament" activeName="tournament" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="chart-bar" activeName="chart-bar" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
