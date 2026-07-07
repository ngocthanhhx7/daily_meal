import React from "react";
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import Svg, { Circle, Line as SvgLine, Polygon, Polyline, Rect } from "react-native-svg";
import { AppText } from "../AppText";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

type ChartPoint = {
  value?: number;
  label?: string;
  frontColor?: string;
  color?: string;
  text?: string;
  stacks?: Array<{ value: number; color: string }>;
};

type ChartShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  legend?: Array<{ label: string; color: string }>;
};

type SeriesChartProps = {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  color?: string;
  type?: "line" | "area" | "bar";
  height?: number;
};

type DonutChartProps = {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  centerLabel?: string;
  legend?: Array<{ label: string; color: string }>;
};

type StackedBarChartProps = {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  legend?: Array<{ label: string; color: string }>;
};

function hasData(data: ChartPoint[]) {
  return data.some((item) => Number(item.value ?? 0) > 0 || item.stacks?.some((stack) => stack.value > 0));
}

function chartWidth(windowWidth: number) {
  return Math.max(260, Math.min(560, windowWidth - 92));
}

function maxValue(data: ChartPoint[]) {
  return Math.max(1, ...data.map((item) => Number(item.value ?? 0)), ...data.flatMap((item) => item.stacks?.map((stack) => stack.value) ?? []));
}

function formatTick(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function WebSeriesChart({ data, color, type, height, width }: { data: ChartPoint[]; color: string; type: "line" | "area" | "bar"; height: number; width: number }) {
  const chartHeight = height + 40;
  const plotTop = 10;
  const plotHeight = height - 22;
  const plotLeft = 38;
  const plotWidth = Math.max(220, width - plotLeft - 8);
  const max = maxValue(data);
  const pointGap = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
  const points = data.map((item, index) => {
    const x = plotLeft + index * pointGap;
    const y = plotTop + plotHeight - (Number(item.value ?? 0) / max) * plotHeight;
    return { x, y, value: Number(item.value ?? 0), label: item.label ?? "" };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = `${plotLeft},${plotTop + plotHeight} ${path} ${plotLeft + plotWidth},${plotTop + plotHeight}`;
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({ y: plotTop + plotHeight * ratio, value: max * (1 - ratio) }));

  if (type === "bar") {
    const barWidth = Math.max(8, Math.min(22, plotWidth / Math.max(1, data.length) - 8));
    return (
      <View style={[styles.webChart, { width, height: chartHeight }]}>
        {ticks.map((tick) => (
          <View key={`tick-${tick.y}`} style={[styles.webRule, { top: tick.y }]}>
            <AppText variant="caption" muted style={styles.webTick}>
              {formatTick(tick.value)}
            </AppText>
          </View>
        ))}
        <Svg width={width} height={chartHeight}>
          {points.map((point) => (
            <Rect
              key={`${point.label}-${point.x}`}
              x={point.x - barWidth / 2}
              y={point.y}
              width={barWidth}
              height={plotTop + plotHeight - point.y}
              rx={4}
              fill={color}
            />
          ))}
        </Svg>
        <View style={[styles.webLabels, { left: plotLeft, width: plotWidth }]}>
          {data.map((item, index) => (
            <AppText key={`${item.label}-${index}`} variant="caption" muted style={styles.webLabel}>
              {item.label}
            </AppText>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.webChart, { width, height: chartHeight }]}>
      {ticks.map((tick) => (
        <View key={`tick-${tick.y}`} style={[styles.webRule, { top: tick.y }]}>
          <AppText variant="caption" muted style={styles.webTick}>
            {formatTick(tick.value)}
          </AppText>
        </View>
      ))}
      <Svg width={width} height={chartHeight}>
        {type === "area" ? <Polygon points={areaPath} fill={color} opacity={0.14} /> : null}
        <Polyline points={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => (
          <Circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r={3.5} fill={color} />
        ))}
      </Svg>
      <View style={[styles.webLabels, { left: plotLeft, width: plotWidth }]}>
        {data.map((item, index) => (
          <AppText key={`${item.label}-${index}`} variant="caption" muted style={styles.webLabel}>
            {item.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function WebStackedChart({ data, width, height = 170 }: { data: ChartPoint[]; width: number; height?: number }) {
  const plotTop = 10;
  const plotHeight = height - 22;
  const plotLeft = 38;
  const plotWidth = Math.max(220, width - plotLeft - 8);
  const max = Math.max(1, ...data.map((item) => item.stacks?.reduce((sum, stack) => sum + stack.value, 0) ?? 0));
  const barWidth = Math.max(8, Math.min(22, plotWidth / Math.max(1, data.length) - 8));
  const gap = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;

  return (
    <View style={[styles.webChart, { width, height: height + 40 }]}>
      <Svg width={width} height={height + 40}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = plotTop + plotHeight * ratio;
          return <SvgLine key={`rule-${ratio}`} x1={plotLeft} x2={plotLeft + plotWidth} y1={y} y2={y} stroke={colors.line} strokeWidth={1} />;
        })}
        {data.map((item, index) => {
          const x = plotLeft + index * gap - barWidth / 2;
          let yCursor = plotTop + plotHeight;
          return (item.stacks ?? []).map((stack, stackIndex) => {
            const segmentHeight = (stack.value / max) * plotHeight;
            yCursor -= segmentHeight;
            return (
              <Rect
                key={`${item.label}-${stackIndex}`}
                x={x}
                y={yCursor}
                width={barWidth}
                height={segmentHeight}
                rx={stackIndex === 0 ? 4 : 0}
                fill={stack.color}
              />
            );
          });
        })}
      </Svg>
      <View style={[styles.webLabels, { left: plotLeft, width: plotWidth }]}>
        {data.map((item, index) => (
          <AppText key={`${item.label}-${index}`} variant="caption" muted style={styles.webLabel}>
            {item.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

function WebDonutChart({ data, centerLabel }: { data: ChartPoint[]; centerLabel?: string }) {
  const total = data.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <View style={styles.webDonutWrap}>
      <View style={styles.webDonutCenter}>
        <AppText variant="button" style={styles.centerLabelText}>
          {centerLabel ?? total}
        </AppText>
      </View>
      <View style={styles.webDonutBar}>
        {data.map((item) => (
          <View
            key={`${item.label}-${item.color}`}
            style={[
              styles.webDonutSegment,
              {
                backgroundColor: item.color ?? colors.greenDark,
                flexGrow: Number(item.value ?? 0)
              }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function AdminChartShell({ title, subtitle, children, legend }: ChartShellProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="subtitle" style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" muted>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {legend?.length ? (
          <View style={styles.legend}>
            {legend.map((item) => (
              <View key={`${title}-${item.label}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <AppText variant="caption" muted>
                  {item.label}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function AdminSeriesChart({ title, subtitle, data, color = colors.greenDark, type = "bar", height = 170 }: SeriesChartProps) {
  const { width } = useWindowDimensions();
  const boundedWidth = chartWidth(width);

  return (
    <AdminChartShell title={title} subtitle={subtitle}>
      {hasData(data) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroller}>
          {Platform.OS === "web" ? (
            <WebSeriesChart data={data} color={color} type={type} height={height} width={boundedWidth} />
          ) : type === "bar" ? (
            <BarChart
              data={data.map((item) => ({ ...item, frontColor: color }))}
              width={boundedWidth}
              height={height}
              barWidth={18}
              spacing={18}
              roundedTop
              hideRules={false}
              noOfSections={4}
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              xAxisColor={colors.line}
              yAxisColor={colors.line}
            />
          ) : (
            <LineChart
              data={data}
              width={boundedWidth}
              height={height}
              color={color}
              dataPointsColor={color}
              areaChart={type === "area"}
              startFillColor={color}
              endFillColor="rgba(139,165,138,0.04)"
              startOpacity={0.28}
              endOpacity={0.02}
              thickness={3}
              hideRules={false}
              noOfSections={4}
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              xAxisColor={colors.line}
              yAxisColor={colors.line}
            />
          )}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <AppText variant="button" style={styles.emptyTitle}>
            Chưa có dữ liệu
          </AppText>
          <AppText variant="caption" muted>
            Đổi bộ lọc thời gian hoặc làm mới dữ liệu.
          </AppText>
        </View>
      )}
    </AdminChartShell>
  );
}

export function AdminStackedBarChart({ title, subtitle, data, legend }: StackedBarChartProps) {
  const { width } = useWindowDimensions();

  return (
    <AdminChartShell title={title} subtitle={subtitle} legend={legend}>
      {hasData(data) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroller}>
          {Platform.OS === "web" ? (
            <WebStackedChart data={data} width={chartWidth(width)} />
          ) : (
            <BarChart
              stackData={data as any}
              width={chartWidth(width)}
              height={170}
              barWidth={18}
              spacing={18}
              roundedTop
              noOfSections={4}
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              xAxisColor={colors.line}
              yAxisColor={colors.line}
            />
          )}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <AppText variant="button" style={styles.emptyTitle}>
            Chưa có tương tác
          </AppText>
        </View>
      )}
    </AdminChartShell>
  );
}

export function AdminDonutChart({ title, subtitle, data, centerLabel, legend }: DonutChartProps) {
  const donutData = data
    .filter((item) => Number(item.value ?? 0) > 0)
    .map((item) => ({ ...item, value: Number(item.value ?? 0) }));

  return (
    <AdminChartShell title={title} subtitle={subtitle} legend={legend}>
      {donutData.length ? (
        <View style={styles.donutWrap}>
          {Platform.OS === "web" ? (
            <WebDonutChart data={donutData} centerLabel={centerLabel} />
          ) : (
            <PieChart
              data={donutData}
              donut
              radius={76}
              innerRadius={46}
              centerLabelComponent={() => (
                <View style={styles.centerLabel}>
                  <AppText variant="button" style={styles.centerLabelText}>
                    {centerLabel ?? donutData.reduce((sum, item) => sum + item.value, 0)}
                  </AppText>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        <View style={styles.empty}>
          <AppText variant="button" style={styles.emptyTitle}>
            Chưa có dữ liệu
          </AppText>
        </View>
      )}
    </AdminChartShell>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 260,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 16,
    gap: 14
  },
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap"
  },
  title: { fontFamily: fonts.bold, color: colors.ink, fontSize: 15 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  chartScroller: { paddingRight: 12, paddingTop: 6, paddingBottom: 2 },
  axisText: { color: colors.muted, fontSize: 9, fontFamily: fonts.medium },
  empty: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.canvasStrong
  },
  emptyTitle: { color: colors.ink, fontFamily: fonts.semibold },
  donutWrap: { alignItems: "center", justifyContent: "center", minHeight: 180 },
  centerLabel: { alignItems: "center", justifyContent: "center" },
  centerLabelText: { color: colors.ink, fontFamily: fonts.bold, fontVariant: ["tabular-nums"] },
  webChart: { position: "relative" },
  webRule: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderColor: colors.line
  },
  webTick: {
    width: 34,
    textAlign: "right",
    transform: [{ translateY: -8 }]
  },
  webLabels: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  webLabel: {
    width: 34,
    textAlign: "center",
    fontSize: 9
  },
  webDonutWrap: {
    width: "100%",
    alignItems: "center",
    gap: 14
  },
  webDonutCenter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 14,
    borderColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  webDonutBar: {
    width: "88%",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: colors.canvasStrong
  },
  webDonutSegment: {
    minWidth: 4,
    height: "100%"
  }
});
