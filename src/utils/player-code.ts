/**
 * Derives a short, shareable 6-character player code from the player's UUID.
 * Used so admins can share a code with each player so they can access their own profile.
 */
export function getPlayerCode(playerId: string): string {
  return playerId.replace(/-/g, '').slice(0, 6).toUpperCase();
}
