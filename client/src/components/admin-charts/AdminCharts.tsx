import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Circle, Line as SvgLine, Polygon, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { AppText } from "../AppText";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

type ChartPoint = {
  value?: number;
  hour?: number;
  label?: string;
  frontColor?: string;
  color?: string;
  text?: string;
  stacks?: Array<{ value: number; color: string }>;
};

type LegendItem = { label: string; color: string };
type HighlightRange = { start: number; end: number };

type ChartShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  legend?: LegendItem[];
};

type SeriesChartProps = {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  color?: string;
  type?: "line" | "area" | "bar";
  height?: number;
  valueFormatter?: (value: number) => string;
  axisNote?: string;
  highlightRanges?: HighlightRange[];
  highlightLabel?: string;
};

type DonutChartProps = {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  centerLabel?: string;
  legend?: LegendItem[];
};

type StackedBarChartProps = {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  legend?: LegendItem[];
  valueFormatter?: (value: number) => string;
  axisNote?: string;
  highlightRanges?: HighlightRange[];
  highlightLabel?: string;
};

type ChartGeometry = {
  svgHeight: number;
  plotTop: number;
  plotLeft: number;
  plotWidth: number;
  plotHeight: number;
  baseline: number;
};

const GRID_SECTIONS = 4;

function hasData(data: ChartPoint[]) {
  return data.some((item) => Number(item.value ?? 0) > 0 || item.stacks?.some((stack) => stack.value > 0));
}

function compactNumber(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function niceMaximum(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const roughStep = value / GRID_SECTIONS;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return niceFactor * magnitude * GRID_SECTIONS;
}

function geometry(width: number, height: number): ChartGeometry {
  const svgHeight = height + 38;
  const plotTop = 14;
  const plotLeft = width < 390 ? 46 : 54;
  const plotRight = 18;
  const plotBottom = 32;
  const plotWidth = Math.max(190, width - plotLeft - plotRight);
  const plotHeight = svgHeight - plotTop - plotBottom;

  return {
    svgHeight,
    plotTop,
    plotLeft,
    plotWidth,
    plotHeight,
    baseline: plotTop + plotHeight
  };
}

function pointX(index: number, length: number, chart: ChartGeometry, barMode: boolean) {
  if (barMode) {
    const step = chart.plotWidth / Math.max(1, length);
    return chart.plotLeft + step * (index + 0.5);
  }
  if (length <= 1) return chart.plotLeft + chart.plotWidth / 2;
  return chart.plotLeft + (index / (length - 1)) * chart.plotWidth;
}

function pointHour(item: ChartPoint) {
  if (typeof item.hour === "number") return item.hour;
  const match = item.label?.match(/^(\d{1,2})(?::\d{2})?/);
  return match ? Number(match[1]) : undefined;
}

function xLabel(label?: string) {
  if (!label) return "";
  const hour = label.match(/^(\d{1,2}):00$/);
  return hour ? `${hour[1].padStart(2, "0")}h` : label;
}

function visibleLabelIndices(length: number, plotWidth: number) {
  if (length <= 1) return [0];
  const maxLabels = Math.max(2, Math.floor(plotWidth / 52));
  const step = Math.max(1, Math.ceil((length - 1) / (maxLabels - 1)));
  const indices: number[] = [];
  for (let index = 0; index < length; index += step) indices.push(index);
  if (indices.at(-1) !== length - 1) indices.push(length - 1);
  return indices;
}

function highlightBands(data: ChartPoint[], ranges: HighlightRange[], chart: ChartGeometry, barMode: boolean) {
  if (!data.length || !ranges.length) return [];
  const step = barMode
    ? chart.plotWidth / data.length
    : data.length > 1
      ? chart.plotWidth / (data.length - 1)
      : chart.plotWidth;

  return ranges.flatMap((range) => {
    const startIndex = data.findIndex((item) => {
      const hour = pointHour(item);
      return typeof hour === "number" && hour >= range.start;
    });
    let endIndex = -1;
    for (let index = data.length - 1; index >= 0; index -= 1) {
      const hour = pointHour(data[index]);
      if (typeof hour === "number" && hour <= range.end) {
        endIndex = index;
        break;
      }
    }
    if (startIndex < 0 || endIndex < startIndex) return [];

    const startCenter = pointX(startIndex, data.length, chart, barMode);
    const endCenter = pointX(endIndex, data.length, chart, barMode);
    const x = Math.max(chart.plotLeft, startCenter - step / 2);
    const right = Math.min(chart.plotLeft + chart.plotWidth, endCenter + step / 2);
    return [{ x, width: Math.max(0, right - x) }];
  });
}

function ResponsiveChartViewport({
  height,
  children
}: {
  height: number;
  children: (width: number) => React.ReactNode;
}) {
  const [width, setWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) setWidth(nextWidth);
  }

  return (
    <View style={styles.chartViewport} onLayout={handleLayout}>
      {width > 0 ? children(width) : <View style={{ height: height + 38 }} />}
    </View>
  );
}

function ChartGrid({
  chart,
  maximum,
  valueFormatter
}: {
  chart: ChartGeometry;
  maximum: number;
  valueFormatter: (value: number) => string;
}) {
  return (
    <>
      {Array.from({ length: GRID_SECTIONS + 1 }, (_, index) => {
        const ratio = index / GRID_SECTIONS;
        const y = chart.plotTop + chart.plotHeight * ratio;
        const value = maximum * (1 - ratio);
        return (
          <React.Fragment key={`grid-${index}`}>
            <SvgLine
              x1={chart.plotLeft}
              x2={chart.plotLeft + chart.plotWidth}
              y1={y}
              y2={y}
              stroke={index === GRID_SECTIONS ? "#D8D4C9" : colors.line}
              strokeWidth={1}
            />
            <SvgText
              x={chart.plotLeft - 8}
              y={y + 3.5}
              fill={colors.muted}
              fontFamily={fonts.medium}
              fontSize={9}
              textAnchor="end"
            >
              {valueFormatter(value)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </>
  );
}

function ChartXAxis({
  data,
  chart,
  barMode
}: {
  data: ChartPoint[];
  chart: ChartGeometry;
  barMode: boolean;
}) {
  const indices = visibleLabelIndices(data.length, chart.plotWidth);
  return (
    <>
      {indices.map((index) => (
        <SvgText
          key={`label-${index}-${data[index]?.label}`}
          x={pointX(index, data.length, chart, barMode)}
          y={chart.svgHeight - 8}
          fill={colors.muted}
          fontFamily={fonts.medium}
          fontSize={9}
          textAnchor="middle"
        >
          {xLabel(data[index]?.label)}
        </SvgText>
      ))}
    </>
  );
}

function SeriesSvg({
  data,
  color,
  type,
  height,
  width,
  valueFormatter,
  highlightRanges = []
}: {
  data: ChartPoint[];
  color: string;
  type: "line" | "area" | "bar";
  height: number;
  width: number;
  valueFormatter: (value: number) => string;
  highlightRanges?: HighlightRange[];
}) {
  const chart = geometry(width, height);
  const barMode = type === "bar";
  const rawMaximum = Math.max(...data.map((item) => Number(item.value ?? 0)));
  const maximum = niceMaximum(rawMaximum * (barMode ? 1.12 : 1));
  const points = data.map((item, index) => {
    const value = Number(item.value ?? 0);
    return {
      x: pointX(index, data.length, chart, barMode),
      y: chart.baseline - (value / maximum) * chart.plotHeight,
      value,
      label: item.label ?? "",
      color: item.frontColor ?? item.color ?? color
    };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `${points[0].x},${chart.baseline} ${polyline} ${points.at(-1)?.x ?? chart.plotLeft},${chart.baseline}`
    : "";
  const step = chart.plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(8, Math.min(24, step * 0.56));
  const valueLabelSize = step < 20 ? 7 : step < 30 ? 8 : 9;
  const bands = highlightBands(data, highlightRanges, chart, barMode);

  return (
    <Svg width={width} height={chart.svgHeight} accessibilityLabel="Biểu đồ dữ liệu quản trị">
      {bands.map((band, index) => (
        <Rect
          key={`highlight-${index}`}
          x={band.x}
          y={chart.plotTop}
          width={band.width}
          height={chart.plotHeight}
          rx={6}
          fill="#F6DE68"
          opacity={0.16}
        />
      ))}
      <ChartGrid chart={chart} maximum={maximum} valueFormatter={valueFormatter} />
      {barMode ? (
        points.map((point, index) => {
          const barHeight = chart.baseline - point.y;
          return barHeight > 0 ? (
            <Rect
              key={`${point.label}-${index}`}
              testID="admin-chart-bar-fill"
              x={point.x - barWidth / 2}
              y={point.y}
              width={barWidth}
              height={barHeight}
              rx={Math.min(5, barWidth / 3)}
              fill={point.color}
            />
          ) : null;
        })
      ) : (
        <>
          {type === "area" ? <Polygon points={area} fill={color} opacity={0.13} /> : null}
          <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <Circle
              key={`${point.label}-${index}`}
              cx={point.x}
              cy={point.y}
              r={3.2}
              fill={colors.surface}
              stroke={color}
              strokeWidth={2.2}
            />
          ))}
        </>
      )}
      {barMode
        ? points.map((point, index) => (
            <SvgText
              key={`value-${point.label}-${index}`}
              x={point.x}
              y={Math.max(chart.plotTop + valueLabelSize, point.y - 6)}
              fill={point.value > 0 ? colors.ink : colors.muted}
              fontFamily={fonts.bold}
              fontSize={valueLabelSize}
              textAnchor="middle"
            >
              {valueFormatter(point.value)}
            </SvgText>
          ))
        : null}
      <ChartXAxis data={data} chart={chart} barMode={barMode} />
    </Svg>
  );
}

function StackedSvg({
  data,
  width,
  height,
  valueFormatter,
  highlightRanges = []
}: {
  data: ChartPoint[];
  width: number;
  height: number;
  valueFormatter: (value: number) => string;
  highlightRanges?: HighlightRange[];
}) {
  const chart = geometry(width, height);
  const totals = data.map((item) => item.stacks?.reduce((sum, stack) => sum + Number(stack.value ?? 0), 0) ?? 0);
  const maximum = niceMaximum(Math.max(...totals) * 1.12);
  const step = chart.plotWidth / Math.max(1, data.length);
  const barWidth = Math.max(8, Math.min(24, step * 0.56));
  const valueLabelSize = step < 20 ? 7 : step < 30 ? 8 : 9;
  const bands = highlightBands(data, highlightRanges, chart, true);

  return (
    <Svg width={width} height={chart.svgHeight} accessibilityLabel="Biểu đồ tương tác theo giờ">
      {bands.map((band, index) => (
        <Rect
          key={`highlight-${index}`}
          x={band.x}
          y={chart.plotTop}
          width={band.width}
          height={chart.plotHeight}
          rx={6}
          fill="#F6DE68"
          opacity={0.16}
        />
      ))}
      <ChartGrid chart={chart} maximum={maximum} valueFormatter={valueFormatter} />
      {data.flatMap((item, index) => {
        const stacks = item.stacks ?? [];
        const x = pointX(index, data.length, chart, true) - barWidth / 2;
        let cursor = chart.baseline;
        return stacks.map((stack, stackIndex) => {
          const segmentHeight = (Number(stack.value ?? 0) / maximum) * chart.plotHeight;
          cursor -= segmentHeight;
          return segmentHeight > 0 ? (
            <Rect
              key={`${item.label}-${stackIndex}`}
              testID="admin-chart-bar-fill"
              x={x}
              y={cursor}
              width={barWidth}
              height={segmentHeight}
              rx={0}
              fill={stack.color}
            />
          ) : null;
        });
      })}
      {totals.map((total, index) => (
          <SvgText
            key={`stack-value-${data[index]?.label}-${index}`}
            x={pointX(index, data.length, chart, true)}
            y={Math.max(chart.plotTop + valueLabelSize, chart.baseline - (total / maximum) * chart.plotHeight - 6)}
            fill={total > 0 ? colors.ink : colors.muted}
            fontFamily={fonts.bold}
            fontSize={valueLabelSize}
            textAnchor="middle"
          >
            {valueFormatter(total)}
          </SvgText>
      ))}
      <ChartXAxis data={data} chart={chart} barMode />
    </Svg>
  );
}

function DonutGraphic({ data, centerLabel }: { data: ChartPoint[]; centerLabel?: string }) {
  const total = data.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  const size = 154;
  const center = size / 2;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const label = centerLabel ?? compactNumber(total);

  return (
    <Svg width={size} height={size} accessibilityLabel={`Tổng ${label}`}>
      <Circle cx={center} cy={center} r={radius} fill="none" stroke={colors.canvasStrong} strokeWidth={18} />
      {data.map((item, index) => {
        const segmentLength = total > 0 ? (Number(item.value ?? 0) / total) * circumference : 0;
        const visibleLength = Math.max(0, segmentLength - Math.min(2.5, segmentLength * 0.18));
        const dashOffset = -offset;
        offset += segmentLength;
        return (
          <Circle
            key={`${item.text ?? item.label}-${index}`}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={item.color ?? colors.greenDark}
            strokeWidth={18}
            strokeLinecap="butt"
            strokeDasharray={[visibleLength, Math.max(0, circumference - visibleLength)]}
            strokeDashoffset={dashOffset}
            rotation={-90}
            origin={`${center}, ${center}`}
          />
        );
      })}
      <SvgText x={center} y={center - 7} fill={colors.muted} fontFamily={fonts.medium} fontSize={9} textAnchor="middle">
        TỔNG
      </SvgText>
      <SvgText
        x={center}
        y={center + 13}
        fill={colors.ink}
        fontFamily={fonts.bold}
        fontSize={label.length > 8 ? 12 : 15}
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </Svg>
  );
}

function PeakSummary({
  value,
  label,
  valueFormatter,
  highlightLabel,
  axisNote
}: {
  value: number;
  label?: string;
  valueFormatter: (value: number) => string;
  highlightLabel?: string;
  axisNote?: string;
}) {
  return (
    <View style={styles.chartMeta}>
      <View style={styles.metaPill}>
        <View style={styles.peakDot} />
        <AppText variant="caption" muted>
          Đỉnh <AppText variant="caption" style={styles.metaStrong}>{valueFormatter(value)}</AppText>{label ? ` · ${label}` : ""}
        </AppText>
      </View>
      {highlightLabel ? (
        <View style={[styles.metaPill, styles.highlightPill]}>
          <View style={styles.highlightDot} />
          <AppText variant="caption" style={styles.highlightText}>{highlightLabel}</AppText>
        </View>
      ) : null}
      {axisNote ? <AppText variant="caption" muted style={styles.axisNote}>{axisNote}</AppText> : null}
    </View>
  );
}

export function AdminChartShell({ title, subtitle, children, legend }: ChartShellProps) {
  return (
    <View style={styles.card} testID="admin-animate-card">
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.title}>{title}</AppText>
          {subtitle ? <AppText variant="caption" muted style={styles.subtitle}>{subtitle}</AppText> : null}
        </View>
        {legend?.length ? (
          <View style={styles.legend}>
            {legend.map((item) => (
              <View key={`${title}-${item.label}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <AppText variant="caption" muted>{item.label}</AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function AdminSeriesChart({
  title,
  subtitle,
  data,
  color = colors.greenDark,
  type = "bar",
  height = 184,
  valueFormatter = compactNumber,
  axisNote,
  highlightRanges,
  highlightLabel
}: SeriesChartProps) {
  const peak = useMemo(
    () => data.reduce((best, item) => (Number(item.value ?? 0) > Number(best.value ?? 0) ? item : best), data[0] ?? {}),
    [data]
  );

  return (
    <AdminChartShell title={title} subtitle={subtitle}>
      {hasData(data) ? (
        <>
          <ResponsiveChartViewport height={height}>
            {(width) => (
              <SeriesSvg
                data={data}
                color={color}
                type={type}
                height={height}
                width={width}
                valueFormatter={valueFormatter}
                highlightRanges={highlightRanges}
              />
            )}
          </ResponsiveChartViewport>
          <PeakSummary
            value={Number(peak.value ?? 0)}
            label={peak.label}
            valueFormatter={valueFormatter}
            highlightLabel={highlightLabel}
            axisNote={axisNote}
          />
        </>
      ) : (
        <View style={styles.empty}>
          <AppText variant="button" style={styles.emptyTitle}>Chưa có dữ liệu</AppText>
          <AppText variant="caption" muted>Đổi bộ lọc thời gian hoặc làm mới dữ liệu.</AppText>
        </View>
      )}
    </AdminChartShell>
  );
}

export function AdminStackedBarChart({
  title,
  subtitle,
  data,
  legend,
  valueFormatter = compactNumber,
  axisNote,
  highlightRanges,
  highlightLabel
}: StackedBarChartProps) {
  const totals = useMemo(
    () => data.map((item) => ({ item, total: item.stacks?.reduce((sum, stack) => sum + Number(stack.value ?? 0), 0) ?? 0 })),
    [data]
  );
  const peak = totals.reduce((best, item) => (item.total > best.total ? item : best), totals[0] ?? { item: {}, total: 0 });

  return (
    <AdminChartShell title={title} subtitle={subtitle} legend={legend}>
      {hasData(data) ? (
        <>
          <ResponsiveChartViewport height={184}>
            {(width) => (
              <StackedSvg
                data={data}
                width={width}
                height={184}
                valueFormatter={valueFormatter}
                highlightRanges={highlightRanges}
              />
            )}
          </ResponsiveChartViewport>
          <PeakSummary
            value={peak.total}
            label={peak.item.label}
            valueFormatter={valueFormatter}
            highlightLabel={highlightLabel}
            axisNote={axisNote}
          />
        </>
      ) : (
        <View style={styles.empty}>
          <AppText variant="button" style={styles.emptyTitle}>Chưa có tương tác</AppText>
          <AppText variant="caption" muted>Không có like, save hoặc bình luận trong khoảng lọc.</AppText>
        </View>
      )}
    </AdminChartShell>
  );
}

export function AdminDonutChart({ title, subtitle, data, centerLabel, legend }: DonutChartProps) {
  const donutData = data
    .filter((item) => Number(item.value ?? 0) > 0)
    .map((item) => ({ ...item, value: Number(item.value ?? 0) }));
  const total = donutData.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <AdminChartShell title={title} subtitle={subtitle}>
      {donutData.length ? (
        <View style={styles.donutContent}>
          <View style={styles.donutGraphic}>
            <DonutGraphic data={donutData} centerLabel={centerLabel} />
          </View>
          <View style={styles.donutBreakdown}>
            {donutData.map((item, index) => {
              const value = Number(item.value ?? 0);
              const percent = total > 0 ? (value / total) * 100 : 0;
              const legendLabel = legend?.find((entry) => entry.color === item.color)?.label;
              return (
                <View key={`${item.text ?? item.label}-${index}`} style={styles.donutRow}>
                  <View style={styles.donutRowHeader}>
                    <View style={styles.donutRowLabel}>
                      <View style={[styles.legendDot, { backgroundColor: item.color ?? colors.greenDark }]} />
                      <AppText variant="caption" style={styles.donutLabel} numberOfLines={1}>
                        {legendLabel ?? item.text ?? item.label ?? "Khác"}
                      </AppText>
                    </View>
                    <AppText variant="caption" style={styles.donutValue}>
                      {compactNumber(value)} · {percent.toFixed(percent >= 10 ? 0 : 1)}%
                    </AppText>
                  </View>
                  <View style={styles.donutTrack}>
                    <View
                      testID="admin-chart-bar-fill"
                      style={[
                        styles.donutFill,
                        {
                          width: `${Math.max(2, percent)}%`,
                          backgroundColor: item.color ?? colors.greenDark
                        }
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.empty}>
          <AppText variant="button" style={styles.emptyTitle}>Chưa có dữ liệu</AppText>
          <AppText variant="caption" muted>Không có dữ liệu tỷ trọng trong khoảng lọc.</AppText>
        </View>
      )}
    </AdminChartShell>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 316,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1
  },
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap"
  },
  title: { fontFamily: fonts.bold, color: colors.ink, fontSize: 15 },
  subtitle: { marginTop: 3, lineHeight: 17 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  chartViewport: { width: "100%", minWidth: 0, overflow: "hidden" },
  chartMeta: {
    minHeight: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingTop: 2
  },
  metaPill: {
    minHeight: 26,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metaStrong: { color: colors.ink, fontFamily: fonts.bold },
  peakDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.greenDark },
  highlightPill: { backgroundColor: "rgba(246,222,104,0.16)", borderColor: "rgba(201,169,31,0.26)" },
  highlightDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: colors.yellow },
  highlightText: { color: "#6F5A00", fontFamily: fonts.medium },
  axisNote: { marginLeft: "auto", fontSize: 9 },
  empty: {
    minHeight: 214,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.canvas
  },
  emptyTitle: { color: colors.ink, fontFamily: fonts.semibold },
  donutContent: {
    minHeight: 220,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 20
  },
  donutGraphic: { alignItems: "center", justifyContent: "center" },
  donutBreakdown: { flex: 1, minWidth: 190, maxWidth: 380, gap: 12 },
  donutRow: { gap: 6 },
  donutRowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  donutRowLabel: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  donutLabel: { flex: 1, color: colors.ink, fontFamily: fonts.medium, textTransform: "capitalize" },
  donutValue: { color: colors.ink, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  donutTrack: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.canvasStrong },
  donutFill: { height: "100%", borderRadius: 3 }
});
