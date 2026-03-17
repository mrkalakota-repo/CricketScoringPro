import { supabase, isCloudEnabled } from '../../config/supabase';
import type { ChatMessage } from '../../engine/types';

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    teamId: row.team_id,
    playerId: row.player_id,
    playerName: row.player_name,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function fetchRecentMessages(teamId: string, limit = 50): Promise<ChatMessage[]> {
  if (!isCloudEnabled || !supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('[cloud-chat-repo] fetchRecentMessages failed:', error.message); return []; }
  return (data ?? []).map(rowToMessage).reverse();
}

export async function sendMessage(
  teamId: string,
  playerId: string,
  playerName: string,
  text: string,
): Promise<ChatMessage | null> {
  if (!isCloudEnabled || !supabase) return null;
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ team_id: teamId, player_id: playerId, player_name: playerName, text, created_at: Date.now() })
    .select()
    .single();

  if (error) { console.error('[cloud-chat-repo] sendMessage failed:', error.message); return null; }
  return rowToMessage(data);
}

export function subscribeToMessages(
  teamId: string,
  callback: (msg: ChatMessage) => void,
): () => void {
  if (!isCloudEnabled || !supabase) return () => {};

  const channel = supabase
    .channel(`chat:${teamId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `team_id=eq.${teamId}` },
      (payload) => callback(rowToMessage(payload.new)),
    )
    .subscribe();

  return () => { supabase!.removeChannel(channel); };
}
