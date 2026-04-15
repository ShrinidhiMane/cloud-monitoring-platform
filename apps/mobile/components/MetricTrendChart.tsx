import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { MonitoringMetricPoint } from "api-client";

interface MetricTrendChartProps {
  accessibilityLabel: string;
  accentColor: string;
  averageValue?: number;
  data: MonitoringMetricPoint[];
  emptyLabel?: string;
  height?: number;
  suggestedMax?: number;
  tickFormatter?: (value?: number) => string;
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

interface ChartSegment {
  angle: number;
  centerX: number;
  centerY: number;
  length: number;
}

const CHART_VERTICAL_PADDING = 14;
const CHART_HORIZONTAL_PADDING = 14;
const GRID_LINE_COUNT = 4;
const DEFAULT_SCALE_PADDING = 1;
const LINE_THICKNESS = 3;
const POINT_SIZE = 8;
const ACTIVE_POINT_SIZE = 12;
const ACTIVE_HALO_SIZE = 22;

function getScaledDomain(
  values: number[],
  suggestedMax?: number,
): { max: number; min: number } {
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const shouldClampToSuggestedMax =
    typeof suggestedMax === "number" && rawMax <= suggestedMax;

  if (rawMin === rawMax) {
    const constantPadding = Math.max(
      Math.abs(rawMax) * 0.18,
      suggestedMax ? suggestedMax * 0.04 : DEFAULT_SCALE_PADDING,
      DEFAULT_SCALE_PADDING,
    );
    const min = Math.max(0, rawMin - constantPadding);
    const max = rawMax + constantPadding;

    return {
      min,
      max: shouldClampToSuggestedMax
        ? Math.min(suggestedMax, Math.max(max, min + DEFAULT_SCALE_PADDING))
        : Math.max(max, min + DEFAULT_SCALE_PADDING),
    };
  }

  const scalePadding = Math.max((rawMax - rawMin) * 0.18, DEFAULT_SCALE_PADDING);
  const min = Math.max(0, rawMin - scalePadding);
  const max = rawMax + scalePadding;

  return {
    min,
    max: shouldClampToSuggestedMax
      ? Math.min(suggestedMax, Math.max(max, min + DEFAULT_SCALE_PADDING))
      : Math.max(max, min + DEFAULT_SCALE_PADDING),
  };
}

function formatScaleLabel(
  value: number,
  tickFormatter?: (value?: number) => string,
): string {
  if (tickFormatter) {
    return tickFormatter(value);
  }

  return `${Number(value.toFixed(2))}`;
}

export const MetricTrendChart = React.memo(function MetricTrendChart({
  accessibilityLabel,
  accentColor,
  averageValue,
  data,
  emptyLabel = "No samples",
  height = 108,
  suggestedMax,
  tickFormatter,
}: MetricTrendChartProps) {
  const [chartWidth, setChartWidth] = React.useState(0);

  if (!data.length) {
    return (
      <View style={[styles.shell, styles.emptyShell, { height }]}>
        <Text style={styles.emptyLabel}>{emptyLabel}</Text>
      </View>
    );
  }

  const values = data.map((point) => point.value);
  const domain = getScaledDomain(values, suggestedMax);
  const domainSpan = Math.max(domain.max - domain.min, DEFAULT_SCALE_PADDING);
  const drawableHeight = Math.max(height - CHART_VERTICAL_PADDING * 2, 1);
  const innerWidth = Math.max(chartWidth - CHART_HORIZONTAL_PADDING * 2, 1);
  const firstLabel = data[0].label;
  const lastLabel = data[data.length - 1].label;
  const averageLineOffset =
    typeof averageValue === "number" && averageValue >= domain.min
      ? CHART_VERTICAL_PADDING +
        (1 - (averageValue - domain.min) / domainSpan) * drawableHeight
      : null;

  const chartPoints: ChartPoint[] =
    chartWidth > 0
      ? data.map((point, index) => {
          const x =
            data.length === 1
              ? CHART_HORIZONTAL_PADDING + innerWidth / 2
              : CHART_HORIZONTAL_PADDING +
                (index / (data.length - 1)) * innerWidth;
          const y =
            CHART_VERTICAL_PADDING +
            (1 - (point.value - domain.min) / domainSpan) * drawableHeight;

          return { x, y, value: point.value };
        })
      : [];

  const chartSegments: ChartSegment[] = [];
  for (let index = 1; index < chartPoints.length; index += 1) {
    const previousPoint = chartPoints[index - 1];
    const nextPoint = chartPoints[index];
    const deltaX = nextPoint.x - previousPoint.x;
    const deltaY = nextPoint.y - previousPoint.y;
    const length = Math.hypot(deltaX, deltaY);

    if (length <= 0) {
      continue;
    }

    chartSegments.push({
      angle: (Math.atan2(deltaY, deltaX) * 180) / Math.PI,
      centerX: (previousPoint.x + nextPoint.x) / 2,
      centerY: (previousPoint.y + nextPoint.y) / 2,
      length,
    });
  }

  return (
    <View>
      <View
        accessibilityLabel={accessibilityLabel}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Math.abs(nextWidth - chartWidth) > 1) {
            setChartWidth(nextWidth);
          }
        }}
        style={[styles.shell, { height }]}
      >
        {[0, 1, 2, 3].map((index) => {
          const ratio = index / (GRID_LINE_COUNT - 1);

          return (
            <View
              key={ratio}
              style={[
                styles.gridLine,
                {
                  top: CHART_VERTICAL_PADDING + drawableHeight * ratio,
                },
              ]}
            />
          );
        })}

        {averageLineOffset !== null ? (
          <View
            style={[
              styles.averageLine,
              {
                backgroundColor: accentColor,
                top: averageLineOffset,
              },
            ]}
          />
        ) : null}

        {chartSegments.map((segment, index) => (
          <View
            key={`${segment.centerX}-${segment.centerY}-${index}`}
            style={[
              styles.lineSegment,
              {
                backgroundColor: accentColor,
                left: segment.centerX - segment.length / 2,
                top: segment.centerY - LINE_THICKNESS / 2,
                width: segment.length,
                transform: [{ rotateZ: `${segment.angle}deg` }],
              },
            ]}
          />
        ))}

        {chartPoints.map((point, index) => {
          const isLastPoint = index === chartPoints.length - 1;
          const pointSize = isLastPoint ? ACTIVE_POINT_SIZE : POINT_SIZE;

          return (
            <React.Fragment
              key={`${data[index].timestamp ?? data[index].label}-${index}`}
            >
              {isLastPoint ? (
                <View
                  style={[
                    styles.activePointHalo,
                    {
                      backgroundColor: accentColor,
                      left: point.x - ACTIVE_HALO_SIZE / 2,
                      top: point.y - ACTIVE_HALO_SIZE / 2,
                    },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.point,
                  {
                    borderColor: accentColor,
                    left: point.x - pointSize / 2,
                    top: point.y - pointSize / 2,
                    width: pointSize,
                    height: pointSize,
                    borderRadius: pointSize / 2,
                  },
                  isLastPoint && {
                    backgroundColor: accentColor,
                  },
                ]}
              />
            </React.Fragment>
          );
        })}

        <View pointerEvents="none" style={styles.scaleOverlay}>
          <View style={styles.scaleChip}>
            <Text style={styles.scaleLabel}>
              {formatScaleLabel(domain.max, tickFormatter)}
            </Text>
          </View>
          <View style={styles.scaleChip}>
            <Text style={styles.scaleLabel}>
              {formatScaleLabel(domain.min, tickFormatter)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{firstLabel}</Text>
        <Text style={styles.axisLabel}>{lastLabel}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    position: "relative",
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  emptyShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyLabel: {
    fontSize: 12,
    color: "#94A3B8",
  },
  gridLine: {
    position: "absolute",
    left: CHART_HORIZONTAL_PADDING,
    right: CHART_HORIZONTAL_PADDING,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  averageLine: {
    position: "absolute",
    left: CHART_HORIZONTAL_PADDING,
    right: CHART_HORIZONTAL_PADDING,
    height: 2,
    opacity: 0.26,
    borderRadius: 999,
  },
  lineSegment: {
    position: "absolute",
    height: LINE_THICKNESS,
    borderRadius: 999,
  },
  point: {
    position: "absolute",
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
  },
  activePointHalo: {
    position: "absolute",
    width: ACTIVE_HALO_SIZE,
    height: ACTIVE_HALO_SIZE,
    borderRadius: ACTIVE_HALO_SIZE / 2,
    opacity: 0.14,
  },
  scaleOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    bottom: 8,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  scaleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scaleLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
  },
  axisRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  axisLabel: {
    fontSize: 11,
    color: "#64748B",
  },
});
