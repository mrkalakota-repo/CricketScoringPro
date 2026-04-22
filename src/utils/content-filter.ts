/**
 * Client-side content filter for team chat.
 * Normalizes text before matching to catch common evasions (l33tspeak, repeated
 * chars, spacing tricks). Not exhaustive — server-side or moderation reports
 * are the second layer.
 */

const BLOCKLIST: string[] = [
  // General profanity
  'fuck', 'f u c k', 'fck', 'fuk',
  'shit', 'sh1t', 'sht',
  'asshole', 'arsehole',
  'bitch', 'b1tch', 'btch',
  'bastard',
  'cunt',
  'dick', 'd1ck',
  'cocksucker',
  'pussy',
  'piss',
  'whore',
  'slut',
  'twat',
  'wank', 'wanker',
  'bollocks',

  // Slurs (racial, ethnic, gender, sexuality)
  'nigger', 'nigga',
  'faggot',
  'dyke',
  'tranny',
  'chink',
  'spick',
  'kike',
  'wetback',
  'raghead',
  'retard',

  // Threats / harassment
  'kill yourself', 'kys',
  'i will kill',
  'go die',
  'kill you',
];

/** Normalise text to collapse common evasion patterns before matching. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    // common leet substitutions
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    // collapse repeated characters (fuuuck → fuck)
    .replace(/(.)\1{2,}/g, '$1$1')
    // remove zero-width / invisible chars and extra spaces
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FilterResult {
  ok: boolean;
  /** Human-readable reason shown inline to the user when ok === false. */
  reason?: string;
}

/**
 * Returns `{ ok: true }` when the message is clean.
 * Returns `{ ok: false, reason }` when a blocked term is detected.
 */
export function filterMessage(text: string): FilterResult {
  const normalised = normalise(text);

  for (const term of BLOCKLIST) {
    // Substring match — catches derived forms (fucking, shitty, etc.)
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(escaped, 'i').test(normalised)) {
      return { ok: false, reason: 'Your message contains language that isn\'t allowed in team chat. Please keep it respectful.' };
    }
  }

  return { ok: true };
}
