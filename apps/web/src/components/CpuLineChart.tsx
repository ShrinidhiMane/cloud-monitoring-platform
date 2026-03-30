import { useId } from "react";
import type { CpuUsagePoint } from "api-client";

interface CpuLineChartProps {
  data: CpuUsagePoint[];
  height?: number;
}

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 220;
const CHART_PADDING = {
  top: 18,
  right: 18,
  bottom: 30,
  left: 18,
};
const GRID_VALUES = [100, 50, 0];

function clampCpuValue(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function CpuLineChart({
  data,
  height = VIEWBOX_HEIGHT,
}: CpuLineChartProps) {
  const gradientId = useId();

  if (!data.length) {
    return <div className="cpu-chart-empty">No CPU samples yet.</div>;
  }

  const chartWidth = VIEWBOX_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const chartHeight = VIEWBOX_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
  const baselineY = CHART_PADDING.top + chartHeight;
  const points = data.map((point, index) => {
    const x =
      CHART_PADDING.left + (chartWidth * index) / Math.max(data.length - 1, 1);
    const y = baselineY - (chartHeight * clampCpuValue(point.value)) / 100;

    return {
      ...point,
      x,
      y,
    };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  const middlePoint = points[Math.floor(points.length / 2)];
  const axisLabels = [
    points[0].label,
    middlePoint.label,
    points[points.length - 1].label,
  ];
  const latestPoint = points[points.length - 1];

  return (
    <div className="cpu-chart-shell" style={{ height }}>
      <svg
        className="cpu-chart-svg"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="CPU utilization chart"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(28, 139, 122, 0.35)" />
            <stop offset="100%" stopColor="rgba(28, 139, 122, 0.04)" />
          </linearGradient>
        </defs>
        {GRID_VALUES.map((value) => {
          const y = baselineY - (chartHeight * value) / 100;

          return (
            <g key={value}>
              <line
                className="cpu-chart-grid-line"
                x1={CHART_PADDING.left}
                y1={y}
                x2={VIEWBOX_WIDTH - CHART_PADDING.right}
                y2={y}
              />
              <text
                className="cpu-chart-grid-label"
                x={VIEWBOX_WIDTH - CHART_PADDING.right}
                y={y - 6}
                textAnchor="end"
              >
                {value}%
              </text>
            </g>
          );
        })}
        <path
          className="cpu-chart-area"
          d={areaPath}
          fill={`url(#${gradientId})`}
        />
        <path className="cpu-chart-line" d={linePath} />
        <circle
          className="cpu-chart-dot"
          cx={latestPoint.x}
          cy={latestPoint.y}
          r="5"
        />
      </svg>

      <div className="cpu-chart-axis" aria-hidden="true">
        {axisLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
