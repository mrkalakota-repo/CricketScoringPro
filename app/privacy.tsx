import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Divider } from 'react-native-paper';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Body({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: theme.colors.primary }]}>{'\u2022'}</Text>
      <Text variant="bodyMedium" style={[styles.bulletText, { color: theme.colors.onSurfaceVariant }]}>
        {children}
      </Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 16) + 20 }}
    >
      <Stack.Screen options={{ title: 'Privacy Policy' }} />

      <Text variant="headlineSmall" style={[styles.heading, { color: theme.colors.onSurface }]}>
        Privacy Policy
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 24 }}>
        Last updated: April 7, 2026
      </Text>

      <Body>
        Inningsly ("we", "our", or "us") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding your data.
      </Body>

      <Divider style={styles.divider} />

      <Section title="1. Information We Collect">
        <Body>We collect only what is necessary to provide the app's features:</Body>
        <Bullet>Phone number — used as your account identifier for registration and cross-device restore.</Bullet>
        <Bullet>Display name — shown in team chats and match scoring screens.</Bullet>
        <Bullet>Role — your selected role (Viewer, Scorer, Team Admin, League Admin).</Bullet>
        <Bullet>Team and match data — teams you create, player rosters, and match scores you record.</Bullet>
        <Bullet>Approximate location — used only on the Teams tab to discover nearby teams within 50 miles. Never stored on our servers.</Bullet>
        <Bullet>Chat messages — messages sent in team chats are stored to enable real-time communication within your team.</Bullet>
      </Section>

      <Divider style={styles.divider} />

      <Section title="2. How We Use Your Information">
        <Bullet>To create and restore your account across devices.</Bullet>
        <Bullet>To enable team discovery for users in your area.</Bullet>
        <Bullet>To power real-time team chat between team members.</Bullet>
        <Bullet>To sync your teams, rosters, and match data when cloud sync is enabled.</Bullet>
        <Body>We do not use your data for advertising or sell it to third parties.</Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="3. Data Storage & Security">
        <Body>
          Your data is stored locally on your device (SQLite) and, when cloud sync is enabled, on Supabase — a secure, SOC 2 compliant cloud platform. PINs are never stored in plain text; they are hashed using SHA-256 before being saved locally or verified server-side.
        </Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="4. Third-Party Services">
        <Body>We use the following third-party services:</Body>
        <Bullet>Supabase — cloud database and real-time sync (supabase.com).</Bullet>
        <Bullet>Twilio Verify — SMS one-time passwords for account verification (twilio.com).</Bullet>
        <Body>
          These services process only the minimum data required (phone number for OTP, encrypted credentials for sync). Please review their respective privacy policies for details.
        </Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="5. Data Retention">
        <Body>
          Your profile and team data are retained for as long as your account is active. You may delete your account data at any time by signing out and uninstalling the app. Cloud data (profile, teams, chat messages) can be removed by contacting us at the address below.
        </Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="6. Children's Privacy">
        <Body>
          Inningsly is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.
        </Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="7. Your Rights">
        <Body>You have the right to:</Body>
        <Bullet>Access the personal data we hold about you.</Bullet>
        <Bullet>Request correction of inaccurate data.</Bullet>
        <Bullet>Request deletion of your data.</Bullet>
        <Body>
          To exercise any of these rights, contact us at the address below. We will respond within 30 days.
        </Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="8. Changes to This Policy">
        <Body>
          We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the date at the top of this page. Continued use of the app after changes constitutes acceptance of the updated policy.
        </Body>
      </Section>

      <Divider style={styles.divider} />

      <Section title="9. Contact Us">
        <Body>
          If you have questions or requests regarding this policy, please contact us at:
        </Body>
        <Text
          variant="bodyMedium"
          style={[styles.contactEmail, { color: theme.colors.primary }]}
        >
          support@inningsly.app
        </Text>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontWeight: '900', marginBottom: 4 },
  section: { gap: 8 },
  sectionTitle: { fontWeight: '800', marginBottom: 2 },
  body: { lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bulletDot: { fontSize: 16, lineHeight: 24, width: 14 },
  bulletText: { flex: 1, lineHeight: 22 },
  divider: { marginVertical: 20 },
  contactEmail: { fontWeight: '700' },
});
