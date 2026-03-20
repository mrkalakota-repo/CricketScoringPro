import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BowlingStyle, BattingStyle } from '../engine/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export function bowlingIcon(style: BowlingStyle): { icon: IconName; color: string } {
  if (style === 'none') return { icon: 'minus-circle-outline', color: '#9E9E9E' };
  if (style.includes('fast')) return { icon: 'lightning-bolt', color: '#E65100' };
  if (style.includes('medium')) return { icon: 'weather-windy', color: '#1565C0' };
  if (style.includes('off-break') || style.includes('orthodox')) return { icon: 'rotate-right', color: '#6A1B9A' };
  if (style.includes('leg-break') || style.includes('chinaman')) return { icon: 'rotate-left', color: '#00695C' };
  return { icon: 'cricket', color: '#9E9E9E' };
}

export function battingIcon(style: BattingStyle): { icon: IconName; color: string } {
  return style === 'right'
    ? { icon: 'alpha-r-circle', color: '#1B6B28' }
    : { icon: 'alpha-l-circle', color: '#E65100' };
}
