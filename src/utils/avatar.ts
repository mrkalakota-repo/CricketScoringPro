export const AVATAR_COLORS = [
  '#1B5E20', '#0D47A1', '#4A148C', '#BF360C',
  '#006064', '#E65100', '#37474F', '#880E4F',
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
