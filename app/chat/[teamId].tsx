import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Linking, Pressable } from 'react-native';
import { Text, TextInput, IconButton, useTheme, Portal, Dialog, Button, ActivityIndicator } from 'react-native-paper';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTeamStore } from '../../src/store/team-store';
import { usePrefsStore } from '../../src/store/prefs-store';
import { useChatStore } from '../../src/store/chat-store';
import { useUserAuth } from '../../src/hooks/useUserAuth';
import { isCloudEnabled } from '../../src/config/supabase';
import * as chatRepo from '../../src/db/repositories/cloud-chat-repo';
import type { ChatMessage } from '../../src/engine/types';
import { getAvatarColor } from '../../src/utils/avatar';
import { filterMessage } from '../../src/utils/content-filter';

function Avatar({ name, isMine, color }: { name: string; isMine: boolean; color: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return (
    <View style={[avatarStyles.circle, { backgroundColor: isMine ? color + '30' : color + '25', borderColor: color + '60', borderWidth: 1.5 }]}>
      <Text style={[avatarStyles.text, { color }]}>{initials}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 11, fontWeight: '900' },
});


export default function ChatScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const teams = useTeamStore(s => s.teams);
  const { messages, identity, loading, loadMessages, loadIdentity, setIdentity, sendMessage, appendMessage } = useChatStore();

  const team = teams.find(t => t.id === teamId);
  const myTeamIds = usePrefsStore(s => s.myTeamIds);
  const playerTeamIds = usePrefsStore(s => s.playerTeamIds);
  const delegateTeamIds = usePrefsStore(s => s.delegateTeamIds);
  const isMember = !!teamId && (
    myTeamIds.includes(teamId) ||
    playerTeamIds.includes(teamId) ||
    delegateTeamIds.includes(teamId)
  );
  const teamMessages = messages[teamId ?? ''] ?? [];
  const myIdentity = identity[teamId ?? ''];
  const { profile: userProfile } = useUserAuth();

  const [text, setText] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [reportMsg, setReportMsg] = useState<ChatMessage | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!teamId || !isCloudEnabled) return;
    loadMessages(teamId);
    loadIdentity(teamId);
  }, [teamId]);

  // Auto-identify: prefer a matching player record; fall back to the logged-in
  // user profile directly (owner/admin who isn't in the player list).
  useEffect(() => {
    if (!teamId || !isCloudEnabled || !team || myIdentity) return;
    if (!userProfile?.phone) return;
    const matchedPlayer = team.players.find(p => p.phoneNumber === userProfile.phone);
    if (matchedPlayer) {
      setIdentity(teamId, matchedPlayer.id, matchedPlayer.name);
    } else {
      // Authenticated but not in player list — use their profile name directly.
      setIdentity(teamId, userProfile.phone, userProfile.name);
    }
  }, [teamId, team, userProfile, myIdentity]);

  useEffect(() => {
    if (!teamId || !isCloudEnabled) return;
    const unsub = chatRepo.subscribeToMessages(teamId, (msg: ChatMessage) => {
      appendMessage(teamId, msg);
    });
    return unsub;
  }, [teamId]);

  useEffect(() => {
    if (teamMessages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [teamMessages.length]);

  // Show identity picker only if unauthenticated and auto-identification didn't work
  useEffect(() => {
    if (isCloudEnabled && team && !myIdentity && !userProfile) {
      setShowPicker(true);
    }
  }, [myIdentity, team, userProfile]);

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || !myIdentity || !teamId) return;
    const check = filterMessage(msg);
    if (!check.ok) {
      setFilterError(check.reason ?? 'Message not allowed.');
      return;
    }
    setFilterError('');
    setText('');
    setSending(true);
    try {
      await sendMessage(teamId, msg);
    } finally {
      setSending(false);
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Team Chat' }} />
        <MaterialCommunityIcons name="cellphone" size={56} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
          App only feature
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          Team Chat is available on the iOS and Android apps.
        </Text>
      </View>
    );
  }

  if (!isCloudEnabled) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Team Chat' }} />
        <MaterialCommunityIcons name="cloud-off-outline" size={56} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
          Chat requires cloud sync
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          Add your Supabase credentials to .env and restart the app to enable team chat.
        </Text>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Team Chat' }} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Team not found</Text>
      </View>
    );
  }

  if (!isMember) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Team Chat' }} />
        <MaterialCommunityIcons name="chat-remove-outline" size={56} color={theme.colors.outlineVariant} />
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}>
          Members only
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          You must be a member of {team.name} to access team chat.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{
        title: `${team.name} Chat`,
        headerRight: () => (
          <IconButton icon="account-circle" iconColor="#FFFFFF" size={22} onPress={() => setShowPicker(true)} />
        ),
      }} />

      {/* Identity picker */}
      <Portal>
        <Dialog visible={showPicker} onDismiss={() => { if (myIdentity) setShowPicker(false); }}>
          <Dialog.Title>Who are you?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
              Select your player name to chat as:
            </Text>
          </Dialog.Content>
          <Dialog.ScrollArea style={{ maxHeight: 320 }}>
            <FlatList
              data={team.players}
              keyExtractor={p => p.id}
              renderItem={({ item }) => (
                <Button
                  mode={myIdentity?.playerId === item.id ? 'contained' : 'text'}
                  onPress={async () => {
                    await setIdentity(teamId!, item.id, item.name);
                    setShowPicker(false);
                  }}
                  style={{ margin: 4 }}
                  icon="account"
                >
                  {item.name}
                </Button>
              )}
              ListEmptyComponent={
                <Text style={{ padding: 16, color: theme.colors.onSurfaceVariant }}>
                  No players in this team yet.
                </Text>
              }
            />
          </Dialog.ScrollArea>
          {myIdentity && (
            <Dialog.Actions>
              <Button onPress={() => setShowPicker(false)}>Cancel</Button>
            </Dialog.Actions>
          )}
        </Dialog>
      </Portal>

      {/* Report dialog */}
      <Portal>
        <Dialog visible={!!reportMsg} onDismiss={() => setReportMsg(null)}>
          <Dialog.Title>Report Message</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              Report this message from {reportMsg?.playerName} as offensive or abusive?
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              This will open an email to our support team with the message details.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReportMsg(null)}>Cancel</Button>
            <Button
              textColor={theme.colors.error}
              onPress={() => {
                if (!reportMsg) return;
                const subject = encodeURIComponent('Chat Report — Inningsly');
                const body = encodeURIComponent(
                  `Team: ${team?.name ?? teamId}\nFrom: ${reportMsg.playerName}\nMessage: ${reportMsg.text}\nTime: ${new Date(reportMsg.createdAt).toISOString()}`
                );
                Linking.openURL(`mailto:support@inningsly.app?subject=${subject}&body=${body}`);
                setReportMsg(null);
              }}
            >
              Report
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Identity bar */}
      {myIdentity && (
        <View style={[styles.identityBar, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="account-circle" size={14} color={theme.colors.primary} />
          <Text variant="bodySmall" style={{ color: theme.colors.primary, fontWeight: '600' }}>
            Chatting as {myIdentity.playerName}
          </Text>
        </View>
      )}

      {/* Messages */}
      {loading && teamMessages.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={teamMessages}
          keyExtractor={m => m.id}
          contentContainerStyle={[styles.messageList, { paddingBottom: insets.bottom + 8 }]}
          ListEmptyComponent={
            <View style={[styles.center, { paddingTop: 48 }]}>
              <MaterialCommunityIcons name="chat-outline" size={40} color={theme.colors.outlineVariant} />
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
                No messages yet. Say hello!
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.playerId === myIdentity?.playerId;
            const color = getAvatarColor(item.playerName);
            const time = new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            return (
              <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                {!isMine && <Avatar name={item.playerName} isMine={false} color={color} />}
                <Pressable
                  onLongPress={() => { if (!isMine) setReportMsg(item); }}
                  delayLongPress={500}
                  style={styles.pressable}
                >
                  <View style={[styles.bubble, isMine ? [styles.bubbleMine, { backgroundColor: theme.colors.primary }] : [styles.bubbleOther, { backgroundColor: theme.colors.surfaceVariant }]]}>
                    {!isMine && (
                      <Text style={[styles.senderName, { color }]}>{item.playerName}</Text>
                    )}
                    <Text style={[styles.msgText, { color: isMine ? '#FFFFFF' : theme.colors.onSurface }]}>
                      {item.text}
                    </Text>
                    <Text style={[styles.msgTime, { color: isMine ? 'rgba(255,255,255,0.6)' : theme.colors.onSurfaceVariant }]}>
                      {time}
                    </Text>
                  </View>
                </Pressable>
                {isMine && <Avatar name={item.playerName} isMine={true} color={color} />}
              </View>
            );
          }}
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { borderTopColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {!!filterError && (
          <Text variant="bodySmall" style={[styles.filterError, { color: theme.colors.error }]}>
            {filterError}
          </Text>
        )}
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={t => { setText(t); if (filterError) setFilterError(''); }}
            placeholder={myIdentity ? 'Type a message…' : 'Select your player first'}
            mode="outlined"
            style={styles.textInput}
            dense
            disabled={!myIdentity}
            right={null}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <IconButton
            icon="send"
            mode="contained"
            containerColor={theme.colors.primary}
            iconColor="#FFFFFF"
            size={22}
            disabled={!text.trim() || !myIdentity || sending}
            onPress={handleSend}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  identityBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 6 },
  messageList: { padding: 12, gap: 10 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4, flex: 1 },
  msgRowMine: { flexDirection: 'row-reverse' },
  pressable: { maxWidth: '75%', flexShrink: 1 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },
  inputBar: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  filterError: { marginBottom: 4, lineHeight: 16 },
  textInput: { flex: 1, fontSize: 14 },
});
