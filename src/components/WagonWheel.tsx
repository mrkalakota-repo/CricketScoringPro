import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import type { BallOutcome } from '../engine/types';

/**
 * Zone definitions — 8 x 45° segments, starting at straight (top = 0°).
 * Index 0 = straight/long-on side, increasing clockwise.
 *
 * Zone labels (for a right-handed batter looking down the pitch):
 *   0 = Straight / Long-on
 *   1 = Mid-wicket
 *   2 = Square leg / Deep square
 *   3 = Fine leg
 *   4 = Third man / Fine off
 *   5 = Point / Cover-point
 *   6 = Cover / Extra cover
 *   7 = Mid-off / Long-off
 */
export const ZONE_LABELS = [
  'Straight',
  'Mid-wicket',
  'Square leg',
  'Fine leg',
  'Third man',
  'Point',
  'Cover',
  'Mid-off',
];

/** Colour per shot type */
const SHOT_COLORS: Record<string, string> = {
  six: '#E65100',
  four: '#1B6B28',
  other: '#1565C0',
};

interface WagonWheelProps {
  balls: BallOutcome[];
  size?: number;
}

function shotColor(ball: BallOutcome): string {
  const total = ball.runs + ball.extras.reduce((s, e) => s + e.runs, 0);
  if (total >= 6) return SHOT_COLORS.six;
  if (total >= 4 || ball.isBoundary) return SHOT_COLORS.four;
  return SHOT_COLORS.other;
}

/** Convert a zone index (0–7) to the angle in radians from the top, clockwise. */
function zoneToAngle(zone: number): number {
  // Each zone is 45°, zone 0 starts at -90° (straight ahead from batter = top of circle)
  const deg = zone * 45 - 90 + 22.5; // centre of each segment
  return (deg * Math.PI) / 180;
}

/**
 * Draw a line from the centre to a point on the boundary representing the shot zone.
 * Shots are spread randomly within the 45° segment for visual variety.
 */
function shotEndpoint(zone: number, r: number, seed: number): { x: number; y: number } {
  const baseAngle = zone * 45 - 90; // degrees, clockwise from top
  // Spread ±17° within the 45° segment using the ball id seed
  const spread = ((seed % 34) - 17) * (Math.PI / 180);
  const angle = (baseAngle * Math.PI) / 180 + spread;
  return {
    x: r * Math.cos(angle),
    y: r * Math.sin(angle),
  };
}

/** Simple integer hash of a string (for pseudo-random spread). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function WagonWheel({ balls, size = 220 }: WagonWheelProps) {
  const theme = useTheme();

  // Only balls with a scoringZone AND at least 1 run off the bat
  const shotBalls = balls.filter(
    b => b.scoringZone !== undefined && b.runs > 0 && !b.dismissal,
  );

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.25; // inner pitch circle

  // Build zone segment paths (8 × 45° arcs)
  const zonePaths = Array.from({ length: 8 }, (_, i) => {
    const startDeg = i * 45 - 90;
    const endDeg = startDeg + 45;
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(s);
    const y1 = cy + outerR * Math.sin(s);
    const x2 = cx + outerR * Math.cos(e);
    const y2 = cy + outerR * Math.sin(e);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} Z`;
  });

  const borderColor = theme.colors.outlineVariant;
  const zoneLineColor = theme.colors.outlineVariant;
  const pitchColor = theme.colors.primaryContainer;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Outer field boundary */}
        <Circle cx={cx} cy={cy} r={outerR} fill={theme.colors.surfaceVariant} stroke={borderColor} strokeWidth={1.5} />

        {/* Zone dividing lines (8 spokes) */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = ((i * 45 - 90) * Math.PI) / 180;
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + outerR * Math.cos(angle)}
              y2={cy + outerR * Math.sin(angle)}
              stroke={zoneLineColor}
              strokeWidth={0.8}
              strokeDasharray="3,3"
            />
          );
        })}

        {/* Inner circle (pitch) */}
        <Circle cx={cx} cy={cy} r={innerR} fill={pitchColor} stroke={borderColor} strokeWidth={1} />

        {/* Shot lines */}
        {shotBalls.map(ball => {
          const zone = ball.scoringZone!;
          const seed = hashStr(ball.id);
          const lineR = outerR * (0.55 + ((seed % 30) / 100)); // vary length 55–85%
          const ep = shotEndpoint(zone, lineR, seed);
          const color = shotColor(ball);
          const strokeW = ball.runs >= 6 ? 2.5 : ball.isBoundary ? 2 : 1.5;
          return (
            <Line
              key={ball.id}
              x1={cx}
              y1={cy}
              x2={cx + ep.x}
              y2={cy + ep.y}
              stroke={color}
              strokeWidth={strokeW}
              strokeOpacity={0.85}
            />
          );
        })}

        {/* Centre dot */}
        <Circle cx={cx} cy={cy} r={4} fill={theme.colors.primary} />
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: SHOT_COLORS.six, label: '6s' },
          { color: SHOT_COLORS.four, label: '4s' },
          { color: SHOT_COLORS.other, label: '1s / 2s / 3s' },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
          </View>
        ))}
      </View>

      {shotBalls.length === 0 && (
        <Text variant="bodySmall" style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>
          No zone data recorded yet
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  empty: {
    marginTop: 4,
    fontStyle: 'italic',
  },
});
