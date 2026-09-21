// Pure chart maths: scales, ticks, path building. No React, no theme, no
// analytics — every function here takes numbers and returns numbers or an SVG
// path string, which is what makes them directly testable and reusable by any
// future screen that needs a chart.

export interface Point {
  x: number;
  y: number;
}

export interface ChartBox {
  width: number;
  height: number;
  /** Inner drawing area inset, in px. */
  padding: { top: number; right: number; bottom: number; left: number };
}

export function innerWidth(box: ChartBox): number {
  return Math.max(0, box.width - box.padding.left - box.padding.right);
}

export function innerHeight(box: ChartBox): number {
  return Math.max(0, box.height - box.padding.top - box.padding.bottom);
}

// ---------- scales ----------

/** Smallest and largest finite value, or null when there is nothing to measure. */
export function extent(values: number[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return min === Infinity ? null : { min, max };
}

/**
 * Rounds a maximum up to a readable value — 47 → 50, 230 → 250, 1.8 → 2.
 *
 * Charts scaled to the exact data maximum put the tallest bar flush against the
 * top edge and produce axis labels like "47", which reads as noise. This is what
 * gives a chart headroom and round numbers.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Evenly spaced, round axis values from 0 to a nice maximum.
 * Returns `count + 1` entries (both ends included).
 */
export function niceTicks(max: number, count = 4): number[] {
  const top = niceMax(max);
  const safeCount = Math.max(1, Math.round(count));
  const ticks: number[] = [];
  for (let i = 0; i <= safeCount; i += 1) {
    ticks.push((top / safeCount) * i);
  }
  return ticks;
}

/**
 * Maps values onto the chart box.
 *
 * `maxValue` is accepted rather than derived so a caller can pin the scale — the
 * analytics screen needs this to keep backfilled days (whose first bar carries a
 * whole history in one lump) from flattening every real bar to invisibility.
 *
 * A flat series is given a non-zero span so it renders as a centred line instead
 * of dividing by zero.
 */
export function buildPoints(
  values: number[],
  box: ChartBox,
  opts?: { maxValue?: number; minValue?: number },
): Point[] {
  const count = values.length;
  if (count === 0) return [];

  const w = innerWidth(box);
  const h = innerHeight(box);
  const minValue = opts?.minValue ?? 0;
  const rawMax = opts?.maxValue ?? (extent(values)?.max ?? 0);
  const max = rawMax > minValue ? rawMax : minValue + 1;
  const span = max - minValue;

  return values.map((value, index) => {
    // A single point sits in the middle rather than hugging the left edge.
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const safe = Number.isFinite(value) ? value : minValue;
    const clamped = Math.max(minValue, Math.min(max, safe));
    return {
      x: box.padding.left + ratio * w,
      y: box.padding.top + h - ((clamped - minValue) / span) * h,
    };
  });
}

// ---------- paths ----------

function fmt(value: number): string {
  // SVG path strings are rebuilt on every render; trimming to 2dp keeps them
  // short without any visible difference at screen resolution.
  return (Math.round(value * 100) / 100).toString();
}

/** Straight polyline through the points. */
export function linePath(points: Point[]): string {
  if (!points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${fmt(point.x)} ${fmt(point.y)}`)
    .join(' ');
}

/**
 * Catmull-Rom smoothing converted to cubic béziers.
 *
 * Control points are clamped to each segment's own y-range by default. Plain
 * Catmull-Rom overshoots around sharp changes, which on an area chart of counts
 * draws the fill below the baseline and reads as negative activity that never
 * happened — the clamp costs a little smoothness and buys correctness.
 */
export function smoothPath(points: Point[], opts?: { clampOvershoot?: boolean }): string {
  const count = points.length;
  if (count === 0) return '';
  if (count === 1) return `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (count === 2) return linePath(points);

  const clamp = opts?.clampOvershoot ?? true;
  let d = `M${fmt(points[0].x)} ${fmt(points[0].y)}`;

  for (let i = 0; i < count - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < count ? i + 2 : count - 1];

    let c1y = p1.y + (p2.y - p0.y) / 6;
    let c2y = p2.y - (p3.y - p1.y) / 6;

    if (clamp) {
      const lo = Math.min(p1.y, p2.y);
      const hi = Math.max(p1.y, p2.y);
      c1y = Math.max(lo, Math.min(hi, c1y));
      c2y = Math.max(lo, Math.min(hi, c2y));
    }

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    d += ` C${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2.x)} ${fmt(p2.y)}`;
  }

  return d;
}

/** Closes a line path down to a baseline so it can be filled. */
export function areaPath(points: Point[], baselineY: number, smooth = true): string {
  if (points.length < 2) return '';
  const top = smooth ? smoothPath(points) : linePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${top} L${fmt(last.x)} ${fmt(baselineY)} L${fmt(first.x)} ${fmt(baselineY)} Z`;
}

/**
 * Straight-line length through the points.
 *
 * Used to set up the stroke-dash draw-in animation, which needs a path length
 * up front. react-native-svg can only report the true length of a smoothed path
 * from a ref after layout, which is too late and too fiddly; the polyline
 * slightly UNDER-estimates a curve, so callers pad it — an over-estimate just
 * delays the reveal a touch, whereas an under-estimate would leave the tail of
 * the line permanently clipped.
 */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// ---------- polar ----------

/**
 * Point on a circle. Angles are degrees clockwise from 12 o'clock, which is how
 * a progress ring or a donut is naturally described, rather than the maths
 * convention of counter-clockwise from 3 o'clock.
 */
export function polarPoint(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

export interface DonutSlice {
  value: number;
  /** Degrees clockwise from 12 o'clock. */
  startAngle: number;
  endAngle: number;
  /** Share of the total, 0..1. */
  fraction: number;
}

/**
 * Turns raw values into angular slices, optionally with a gap between them.
 *
 * Slices smaller than the gap would otherwise render inside-out; they are given
 * zero sweep instead so they simply do not draw.
 */
export function donutSlices(values: number[], gapDeg = 0): DonutSlice[] {
  const safe = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return safe.map(() => ({ value: 0, startAngle: 0, endAngle: 0, fraction: 0 }));

  let cursor = 0;
  return safe.map((value) => {
    const fraction = value / total;
    const full = fraction * 360;
    const start = cursor;
    cursor += full;
    const sweep = Math.max(0, full - gapDeg);
    return {
      value,
      fraction,
      startAngle: start + gapDeg / 2,
      endAngle: start + gapDeg / 2 + sweep,
    };
  });
}

/** Closed polygon through one value per axis — the radar outline. */
export function radarPath(
  values: number[],
  maxValue: number,
  cx: number,
  cy: number,
  radius: number,
): string {
  const count = values.length;
  if (count < 3) return '';
  const max = maxValue > 0 ? maxValue : 1;

  const points = values.map((value, index) => {
    const safe = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
    return polarPoint(cx, cy, (safe / max) * radius, (360 / count) * index);
  });

  return `${linePath(points)} Z`;
}

/** The evenly spaced axis endpoints a radar's spokes and labels sit on. */
export function radarAxisPoints(count: number, cx: number, cy: number, radius: number): Point[] {
  if (count < 3) return [];
  return Array.from({ length: count }, (_, index) => polarPoint(cx, cy, radius, (360 / count) * index));
}

// ---------- bars ----------

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
}

/**
 * Evenly distributed bars across the box.
 *
 * Zero values still get a hairline so a day with no activity reads as an empty
 * slot rather than as missing data — an invisible bar and an absent bar look
 * identical, and they mean different things.
 */
export function buildBars(
  values: number[],
  box: ChartBox,
  opts?: { maxValue?: number; gapRatio?: number; minHeight?: number },
): BarRect[] {
  const count = values.length;
  if (count === 0) return [];

  const w = innerWidth(box);
  const h = innerHeight(box);
  const gapRatio = opts?.gapRatio ?? 0.34;
  const minHeight = opts?.minHeight ?? 2;
  const slot = w / count;
  const barWidth = Math.max(1, slot * (1 - gapRatio));

  const rawMax = opts?.maxValue ?? (extent(values)?.max ?? 0);
  const max = rawMax > 0 ? rawMax : 1;

  return values.map((value, index) => {
    const safe = Math.max(0, Number.isFinite(value) ? value : 0);
    const scaled = (Math.min(safe, max) / max) * h;
    const height = safe > 0 ? Math.max(minHeight, scaled) : minHeight;
    return {
      x: box.padding.left + slot * index + (slot - barWidth) / 2,
      y: box.padding.top + h - height,
      width: barWidth,
      height,
      value: safe,
    };
  });
}

// ---------- formatting ----------

/** 1240 → "1.2k", 15300 → "15k". Axis labels have no room for thousands. */
export function compactNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  if (abs >= 1_000_000) return `${(safe / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(safe / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  if (!Number.isInteger(safe)) return safe.toFixed(1);
  return String(safe);
}

/** Seconds → "2h 15m" / "45m" / "3m", matching the leaderboard's stat cells. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
}
