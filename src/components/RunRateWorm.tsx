import { useWindowDimensions, View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Polyline, Line, G, Text as SvgText } from 'react-native-svg';
import type { Innings } from '../engine/types';

interface RunRateWormProps {
  /** Up to 2 innings in batting order. */
  innings: Innings[];
  /** Short team names aligned with `innings` array. */
  teamNames: string[];
}

const LINE_COLORS: string[] = ['#1B6B28', '#E65100'];
const TARGET_COLOR = '#9E9E9E';
const CHART_H = 180;
const PAD_L = 38;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 24;

export default function RunRateWorm({ innings, teamNames }: RunRateWormProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const populated = innings.filter(inn => inn.overs.length > 0);
  if (populated.length === 0) return null;

  const chartWidth = screenWidth - 48;
  const plotW = chartWidth - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  // Cumulative runs after each over for each innings
  const series = innings.map(inn => {
    let cum = 0;
    const pts: { over: number; runs: number }[] = [{ over: 0, runs: 0 }];
    for (const ov of inn.overs) {
      cum += ov.runs;
      pts.push({ over: ov.number + 1, runs: cum });
    }
    return pts;
  });

  const maxOver = Math.max(...series.map(s => s[s.length - 1]?.over ?? 0), 1);

  const target = innings[1]?.target ?? null;
  const maxRuns = Math.max(
    ...series.flatMap(s => s.map(p => p.runs)),
    target ?? 0,
    1,
  );

  const yMax = Math.max(Math.ceil(maxRuns / 10) * 10, 10);
  const yTicks = [0, 1, 2, 3, 4].map(i => Math.round((i * yMax) / 4));

  const xInterval = maxOver <= 10 ? 2 : maxOver <= 20 ? 5 : 10;

  const toX = (over: number) => PAD_L + (over / maxOver) * plotW;
  const toY = (runs: number) => PAD_T + plotH - (Math.min(runs, yMax) / yMax) * plotH;

  return (
    <View>
      <Svg width={chartWidth} height={CHART_H}>
        {/* Y axis */}
        <Line
          x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH}
          stroke={theme.colors.outline as string} strokeWidth={1}
        />

        {/* Y gridlines + labels */}
        {yTicks.map(tick => {
          const y = toY(tick);
          return (
            <G key={tick}>
              <Line
                x1={PAD_L} y1={y} x2={PAD_L + plotW} y2={y}
                stroke={tick === 0 ? (theme.colors.outline as string) : (theme.colors.outlineVariant as string)}
                strokeWidth={tick === 0 ? 1 : 0.5}
                strokeDasharray={tick === 0 ? undefined : '3,3'}
              />
              <SvgText
                x={PAD_L - 4} y={y + 4}
                textAnchor="end" fontSize={9}
                fill={theme.colors.onSurfaceVariant as string}
              >
                {tick}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis labels */}
        {Array.from({ length: Math.floor(maxOver / xInterval) + 1 }, (_, k) => k * xInterval)
          .filter(ov => ov <= maxOver)
          .map(ov => (
            <SvgText
              key={ov}
              x={toX(ov)} y={CHART_H - 4}
              textAnchor="middle" fontSize={9}
              fill={theme.colors.onSurfaceVariant as string}
            >
              {ov}
            </SvgText>
          ))}

        {/* X baseline */}
        <Line
          x1={PAD_L} y1={PAD_T + plotH} x2={PAD_L + plotW} y2={PAD_T + plotH}
          stroke={theme.colors.outline as string} strokeWidth={1}
        />

        {/* Target dashed line */}
        {target !== null && target <= yMax && (
          <Line
            x1={PAD_L} y1={toY(target)} x2={PAD_L + plotW} y2={toY(target)}
            stroke={TARGET_COLOR} strokeWidth={1.5} strokeDasharray="6,4"
          />
        )}

        {/* Worm lines */}
        {series.map((pts, si) => {
          if (pts.length < 2) return null;
          const pointsStr = pts.map(p => `${toX(p.over)},${toY(p.runs)}`).join(' ');
          return (
            <Polyline
              key={si}
              points={pointsStr}
              fill="none"
              stroke={LINE_COLORS[si] ?? '#888'}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {innings.map((_, si) => (
          <View key={si} style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: LINE_COLORS[si] ?? '#888' }]} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {teamNames[si] ?? `Inn ${si + 1}`}
            </Text>
          </View>
        ))}
        {target !== null && (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: TARGET_COLOR }]} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Target ({target})
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
});
