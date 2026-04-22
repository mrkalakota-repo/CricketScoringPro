import { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, useTheme, Divider, HelperText, Portal, Dialog } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUserAuth } from '../src/hooks/useUserAuth';
import { useRole } from '../src/hooks/useRole';
import { usePlan, PLAN_LABELS } from '../src/hooks/usePlan';
import type { UserRole } from '../src/engine/types';

const ROLE_OPTIONS: { value: UserRole; label: string; icon: string; color: string; desc: string }[] = [
  { value: 'viewer',       label: 'Viewer',       icon: 'eye-outline',        color: '#6D4C41', desc: 'Follow matches & live scores' },
  { value: 'scorer',       label: 'Scorer',       icon: 'scoreboard-outline', color: '#2E7D32', desc: 'Score live matches' },
  { value: 'team_admin',   label: 'Team Admin',   icon: 'shield-account',     color: '#1565C0', desc: 'Manage teams & players' },
  { value: 'league_admin', label: 'League Admin', icon: 'shield-crown',       color: '#7B1FA2', desc: 'Run tournaments' },
];

const ROLE_RANK: Record<UserRole, number> = {
  viewer: 0,
  scorer: 1,
  team_admin: 2,
  league_admin: 3,
};

export default function MyProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile, logout, deleteAccount } = useUserAuth();
  const { roleLabel, roleIcon, roleColor } = useRole();
  const { plan, isFree } = usePlan();

  const [name, setName] = useState(profile?.name ?? '');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  // Change PIN
  const [showPinSection, setShowPinSection] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Change Role
  const [showRoleSection, setShowRoleSection] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole>(profile?.role ?? 'scorer');

  // Logout confirm
  const [logoutVisible, setLogoutVisible] = useState(false);

  // Delete account confirm
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Role downgrade confirm
  const [downgradeVisible, setDowngradeVisible] = useState(false);

  if (!profile) {
    return null; // shouldn't reach here — _layout guards auth
  }

  const handleSaveName = async () => {
    if (!name.trim()) { setNameError('Name is required'); return; }
    setSaving(true);
    try {
      await updateProfile(name.trim());
      setSavedMsg('Name updated!');
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    setPinError('');
    if (currentPin.length < 4) { setPinError('Enter your current PIN'); return; }
    if (newPin.length < 4) { setPinError('New PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { setPinError('New PINs do not match'); return; }

    // Verify current PIN by hashing locally
    const { isAuthenticated } = useUserAuth.getState();
    if (!isAuthenticated) { setPinError('Not authenticated'); return; }

    setSaving(true);
    try {
      // Re-use login to verify current PIN
      const { login } = useUserAuth.getState();
      const ok = await login(currentPin);
      if (!ok) { setPinError('Current PIN is incorrect'); setSaving(false); return; }
      await updateProfile(name.trim(), newPin);
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
      setShowPinSection(false);
      setSavedMsg('PIN changed!');
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const isDowngrade = ROLE_RANK[pendingRole] < ROLE_RANK[profile.role];

  const handleSaveRole = async () => {
    if (isDowngrade && !downgradeVisible) {
      setDowngradeVisible(true);
      return;
    }
    setDowngradeVisible(false);
    setSaving(true);
    try {
      await updateProfile(profile.name, undefined, pendingRole);
      setShowRoleSection(false);
      setSavedMsg('Role updated!');
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutVisible(false);
    await logout();
    router.replace('/');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      router.replace('/');
    } finally {
      setDeleting(false);
      setDeleteVisible(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
    >
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <MaterialCommunityIcons name="account-circle" size={52} color="#FFFFFF" />
        </View>
        <Text variant="titleLarge" style={styles.headerName}>{profile.name}</Text>
        <View style={styles.rolePill}>
          <MaterialCommunityIcons name={roleIcon as any} size={14} color={roleColor} />
          <Text style={[styles.rolePillText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
        <Text style={styles.headerPhone}>{profile.phone}</Text>
      </View>

      <View style={styles.body}>
        {/* Update Name */}
        <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
          Display Name
        </Text>
        <TextInput
          value={name}
          onChangeText={t => { setName(t); setNameError(''); setSavedMsg(''); }}
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="account-edit" />}
          error={!!nameError}
        />
        {nameError ? <HelperText type="error">{nameError}</HelperText> : null}
        {savedMsg ? (
          <HelperText type="info" style={{ color: theme.colors.primary }}>{savedMsg}</HelperText>
        ) : null}
        <Button
          mode="contained"
          onPress={handleSaveName}
          loading={saving && !showPinSection}
          disabled={saving || name.trim() === profile.name}
          style={styles.button}
          icon="content-save"
        >
          Save Name
        </Button>

        <Divider style={styles.divider} />

        {/* Change PIN */}
        {!showPinSection ? (
          <Button
            mode="outlined"
            icon="lock-reset"
            onPress={() => setShowPinSection(true)}
            style={styles.button}
          >
            Change PIN
          </Button>
        ) : (
          <>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
              Change PIN
            </Text>
            <TextInput
              label="Current PIN"
              value={currentPin}
              onChangeText={t => { setCurrentPin(t.replace(/\D/g, '')); setPinError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              left={<TextInput.Icon icon="lock" />}
            />
            <TextInput
              label="New PIN (4–6 digits)"
              value={newPin}
              onChangeText={t => { setNewPin(t.replace(/\D/g, '')); setPinError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              left={<TextInput.Icon icon="lock-plus" />}
            />
            <TextInput
              label="Confirm New PIN"
              value={confirmPin}
              onChangeText={t => { setConfirmPin(t.replace(/\D/g, '')); setPinError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
              left={<TextInput.Icon icon="lock-check" />}
              error={confirmPin.length > 0 && newPin !== confirmPin}
            />
            {pinError ? <HelperText type="error">{pinError}</HelperText> : null}
            <View style={styles.row}>
              <Button
                mode="contained"
                onPress={handleChangePin}
                loading={saving && showPinSection}
                disabled={saving}
                style={[styles.button, { flex: 1 }]}
                icon="lock-reset"
              >
                Update PIN
              </Button>
              <Button
                mode="outlined"
                onPress={() => { setShowPinSection(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                style={[styles.button, { flex: 1 }]}
              >
                Cancel
              </Button>
            </View>
          </>
        )}

        <Divider style={styles.divider} />

        {/* Change Role */}
        {!showRoleSection ? (
          <Button
            mode="outlined"
            icon="account-convert"
            onPress={() => { setPendingRole(profile.role); setShowRoleSection(true); }}
            style={styles.button}
          >
            Change Role
          </Button>
        ) : (
          <>
            <Text variant="labelLarge" style={[styles.sectionLabel, { color: theme.colors.onSurface }]}>
              Change Role
            </Text>
            <View style={styles.roleGrid}>
              {ROLE_OPTIONS.map(r => {
                const selected = pendingRole === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setPendingRole(r.value)}
                    style={[
                      styles.roleCard,
                      {
                        borderColor: selected ? r.color : theme.colors.outlineVariant,
                        backgroundColor: selected ? r.color + '18' : theme.colors.surface,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={r.icon as any} size={22} color={selected ? r.color : theme.colors.onSurfaceVariant} />
                    <Text variant="labelMedium" style={{ color: selected ? r.color : theme.colors.onSurface, fontWeight: '700', textAlign: 'center' }}>
                      {r.label}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', fontSize: 10 }} numberOfLines={2}>
                      {r.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.row}>
              <Button
                mode="contained"
                onPress={handleSaveRole}
                loading={saving}
                disabled={saving || pendingRole === profile.role}
                style={[styles.button, { flex: 1 }]}
                icon="content-save"
              >
                Save Role
              </Button>
              <Button
                mode="outlined"
                onPress={() => setShowRoleSection(false)}
                style={[styles.button, { flex: 1 }]}
              >
                Cancel
              </Button>
            </View>
          </>
        )}

        <Divider style={styles.divider} />

        {/* Privacy Policy */}
        <Button
          mode="text"
          icon="shield-account-outline"
          textColor={theme.colors.onSurfaceVariant}
          style={styles.button}
          onPress={() => router.push('/privacy')}
        >
          Privacy Policy
        </Button>

        <Divider style={styles.divider} />

        {/* Upgrade / Manage Plan */}
        <Button
          mode={isFree ? 'contained' : 'outlined'}
          icon="crown-outline"
          style={styles.button}
          onPress={() => router.push('/upgrade')}
        >
          {isFree ? 'Upgrade Plan' : `${PLAN_LABELS[plan]} — Manage Plan`}
        </Button>

        <Divider style={styles.divider} />

        {/* Logout */}
        <Button
          mode="outlined"
          icon="logout"
          textColor={theme.colors.error}
          style={[styles.button, { borderColor: theme.colors.error }]}
          onPress={() => setLogoutVisible(true)}
        >
          Sign Out
        </Button>

        <Divider style={styles.divider} />

        {/* Delete Account */}
        <Button
          mode="text"
          icon="delete-forever-outline"
          textColor={theme.colors.error}
          style={styles.button}
          onPress={() => setDeleteVisible(true)}
        >
          Delete Account
        </Button>
      </View>

      {/* Role downgrade warning dialog */}
      <Portal>
        <Dialog visible={downgradeVisible} onDismiss={() => setDowngradeVisible(false)}>
          <Dialog.Title>Reduce permissions?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Changing to <Text style={{ fontWeight: '700' }}>{ROLE_OPTIONS.find(r => r.value === pendingRole)?.label}</Text> will
              remove some of your current capabilities. You can change your role again later.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDowngradeVisible(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleSaveRole}>Confirm</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Logout confirm dialog */}
      <Portal>
        <Dialog visible={logoutVisible} onDismiss={() => setLogoutVisible(false)}>
          <Dialog.Title>Sign Out?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Your profile and data stay on this device. You'll need your PIN to sign back in.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutVisible(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleLogout}>Sign Out</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete account confirm dialog */}
      <Portal>
        <Dialog visible={deleteVisible} onDismiss={() => { if (!deleting) setDeleteVisible(false); }}>
          <Dialog.Title>Delete Account?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              This permanently deletes your account and removes your profile from our servers.
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              Your local match history and team data on this device will remain. This cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteVisible(false)} disabled={deleting}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              onPress={handleDeleteAccount}
              loading={deleting}
              disabled={deleting}
            >
              Delete Account
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    padding: 28,
    paddingTop: 36,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 6,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  headerName: { color: '#FFFFFF', fontWeight: '900' },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  headerPhone: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  body: { padding: 20, gap: 4 },
  sectionLabel: { fontWeight: '700', marginBottom: 4, marginTop: 8 },
  input: { marginBottom: 6 },
  button: { marginTop: 6 },
  divider: { marginVertical: 20 },
  row: { flexDirection: 'row', gap: 8 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  roleCard: { flex: 1, minWidth: '44%', maxWidth: '48%', borderWidth: 2, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
});
