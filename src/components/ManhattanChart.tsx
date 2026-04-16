import { useWindowDimensions, View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import type { OverSummary } from '../engine/types';

interface ManhattanChartProps {
  overs: OverSummary[];
}

const CHART_H = 180;
const PAD_L = 32;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 24;

export default function ManhattanChart({ overs }: ManhattanChartProps) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  if (overs.length === 0) return null;

  const chartWidth = screenWidth - 48;
  const plotW = chartWidth - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;

  const maxRuns = Math.max(...overs.map(o => o.runs), 1);
  const yMax = Math.max(Math.ceil(maxRuns / 5) * 5, 10);
  const yTicks = [0, 1, 2, 3, 4].map(i => Math.round((i * yMax) / 4));

  const numOvers = overs.length;
  const slotW = plotW / numOvers;
  const barW = Math.max(3, slotW * 0.75);

  const xInterval = numOvers <= 10 ? 2 : numOvers <= 20 ? 5 : 10;

  const barFill = (over: OverSummary): string => {
    if (over.wickets >= 2) return '#C62828';
    if (over.wickets === 1) return '#E65100';
    return theme.colors.primary as string;
  };

  return (
    <View>
      <Svg width={chartWidth} height={CHART_H}>
        {/* Y axis line */}
        <Line
          x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH}
          stroke={theme.colors.outline as string} strokeWidth={1}
        />

        {/* Y gridlines + labels */}
        {yTicks.map(tick => {
          const y = PAD_T + plotH - (tick / yMax) * plotH;
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

        {/* Bars */}
        {overs.map((over, i) => {
          const barH = Math.max((over.runs / yMax) * plotH, over.runs > 0 ? 2 : 0);
          const x = PAD_L + i * slotW + (slotW - barW) / 2;
          const y = PAD_T + plotH - barH;
          const showXLabel = i === 0 || i === numOvers - 1 || (i + 1) % xInterval === 0;

          return (
            <G key={over.number}>
              {barH > 0 && (
                <Rect x={x} y={y} width={barW} height={barH} fill={barFill(over)} rx={2} />
              )}
              {/* Wicket count inside bar */}
              {over.wickets > 0 && barH >= 14 && (
                <SvgText
                  x={x + barW / 2} y={y + 11}
                  textAnchor="middle" fontSize={8}
                  fill="#FFF" fontWeight="bold"
                >
                  {over.wickets}W
                </SvgText>
              )}
              {/* X-axis over number */}
              {showXLabel && (
                <SvgText
                  x={x + barW / 2} y={CHART_H - 4}
                  textAnchor="middle" fontSize={9}
                  fill={theme.colors.onSurfaceVariant as string}
                >
                  {over.number + 1}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {([
          { color: theme.colors.primary as string, label: '0 wkts' },
          { color: '#E65100', label: '1 wkt' },
          { color: '#C62828', label: '2+ wkts' },
        ] as { color: string; label: string }[]).map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
