import { supabase, isCloudEnabled } from '../../config/supabase';

export async function publishDelegateCode(
  teamId: string,
  code: string,
  expiresAt: number,
): Promise<void> {
  if (!isCloudEnabled || !supabase) return;
  const { error } = await supabase.from('delegate_codes').upsert({
    team_id: teamId,
    code,
    expires_at: expiresAt,
  });
  if (error) throw error;
}

export async function fetchAndClaimDelegateCode(
  teamId: string,
  enteredCode: string,
): Promise<boolean> {
  if (!isCloudEnabled || !supabase) return false;
  const { data, error } = await supabase
    .from('delegate_codes')
    .select('*')
    .eq('team_id', teamId)
    .single();

  if (error || !data) return false;
  if (data.code !== enteredCode.toUpperCase()) return false;
  if (Date.now() > data.expires_at) return false;

  // Consume the code — delete it so it can't be reused
  await supabase.from('delegate_codes').delete().eq('team_id', teamId);
  return true;
}
