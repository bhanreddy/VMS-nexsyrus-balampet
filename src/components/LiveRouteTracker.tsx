/**
 * LiveRouteTracker — realtime schematic bus tracker.
 *
 * A schematic alternative to the street map, with UI-thread marker animation.
 * It depicts stop order and journey progress; the background is not geography.
 *
 * Path priority:
 *   1. Real stop lat/lng (geographic projection)
 *   2. Schematic curved path from stop order (when coords are missing)
 * Bus position priority:
 *   1. Real GPS fix on a geo path
 *   2. Journey progress from stop statuses (+ ETA bias) on a schematic path
 *   3. Last completed stop
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hasMapCoordinate } from '../services/transportMapModel';
import Svg, {
  Circle,
  G,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';

export type TrackerStop = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
};

type Props = {
  stops: TrackerStop[];
  bus: { latitude: number; longitude: number; heading?: number | null } | null;
  boardingStopId?: string | null;
  isFresh?: boolean;
  etaMinutes?: number | null;
  height?: number;
  mode?: 'live' | 'preview';
  simulationProgress?: number | null;
  simulationStopCount?: number;
};

const PAD = 30;
const BUS = 42;
const ROUTE_COLOR = '#0F766E';
const ROUTE_LIGHT = '#14B8A6';
const MAP_BG = '#EEF2EF';

type MapPoint = { px: number; py: number };

const served = (s: string) => s === 'completed' || s === 'skipped';

/** Lay stops along a curved schematic path when real lat/lng are missing. */
function schematicLayout(
  stops: TrackerStop[],
  width: number,
  height: number,
): (TrackerStop & { px: number; py: number })[] {
  if (width <= 0 || stops.length === 0) return [];
  const availW = width - 2 * PAD;
  const availH = height - 2 * PAD;
  const denom = Math.max(stops.length - 1, 1);
  return stops.map((stop, i) => {
    const t = stops.length === 1 ? 0.72 : i / denom;
    const px = PAD + t * availW;
    const py = PAD + availH * (0.72 - t * 0.42 - Math.sin(t * Math.PI) * 0.12);
    return { ...stop, px, py };
  });
}

/** Progress index (0..n-1) from stop statuses, biased by ETA / boarding. */
function journeyIndex(
  stops: TrackerStop[],
  boardingStopId?: string | null,
  etaMinutes?: number | null,
): number {
  if (stops.length === 0) return 0;
  if (etaMinutes === 0 && boardingStopId) {
    const boardingIdx = stops.findIndex((s) => s.id === boardingStopId);
    if (boardingIdx >= 0) return boardingIdx;
  }
  let idx = 0;
  for (let i = 0; i < stops.length; i++) {
    if (served(stops[i].status)) idx = Math.min(i + 1, stops.length - 1);
    else {
      idx = i;
      break;
    }
  }
  return idx;
}

function lerpPoint(
  a: { px: number; py: number },
  b: { px: number; py: number },
  t: number,
) {
  const u = Math.max(0, Math.min(1, t));
  return { px: a.px + (b.px - a.px) * u, py: a.py + (b.py - a.py) * u };
}

const pointString = (points: MapPoint[]) =>
  points.map((point) => `${point.px},${point.py}`).join(' ');

function progressedPoints(points: MapPoint[], progress: number): MapPoint[] {
  if (points.length < 2) return [];
  const clamped = Math.max(0, Math.min(points.length - 1, progress));
  const fromIndex = Math.floor(clamped);
  const output = points.slice(0, fromIndex + 1);
  const toIndex = Math.min(points.length - 1, Math.ceil(clamped));
  if (toIndex > fromIndex) {
    output.push(lerpPoint(points[fromIndex], points[toIndex], clamped - fromIndex));
  }
  return output.length >= 2 ? output : [];
}

function shortStopName(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 19 ? `${trimmed.slice(0, 18)}…` : trimmed;
}

export default function LiveRouteTracker({
  stops,
  bus,
  boardingStopId,
  isFresh = true,
  etaMinutes,
  height = 230,
  mode = 'live',
  simulationProgress,
  simulationStopCount = stops.length,
}: Props) {
  const { t } = useTranslation();
  const [w, setW] = useState(0);

  const coordStops = useMemo(
    () => stops.filter(hasMapCoordinate),
    [stops],
  );

  const projectionCoords = useMemo(() => {
    const coords = coordStops.map((stop) => ({
      latitude: Number(stop.latitude),
      longitude: Number(stop.longitude),
    }));
    // A one-stop route can still show the real approach line from the bus to
    // that stop. Scheduled preview never invents a GPS coordinate here.
    if (coords.length === 1 && bus) {
      coords.push({ latitude: bus.latitude, longitude: bus.longitude });
    }
    return coords;
  }, [coordStops, bus]);

  // Stable projection frame comes from route stops. A one-stop live route also
  // includes the real bus fix so the approach can be drawn.
  const project = useMemo(() => {
    if (w === 0 || projectionCoords.length < 2) return null;
    const lats = projectionCoords.map((s) => s.latitude);
    const lngs = projectionCoords.map((s) => s.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const k = Math.cos((midLat * Math.PI) / 180) || 1; // lng→x aspect correction
    const axMin = minLng * k, axMax = maxLng * k;
    const spanX = Math.max(axMax - axMin, 1e-6);
    const spanY = Math.max(maxLat - minLat, 1e-6);
    const availW = w - 2 * PAD, availH = height - 2 * PAD;
    const s = Math.min(availW / spanX, availH / spanY);
    const ox = PAD + (availW - spanX * s) / 2;
    const oy = PAD + (availH - spanY * s) / 2;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    return {
      x: (lng: number) => clamp(ox + (lng * k - axMin) * s, 6, w - 6),
      y: (lat: number) => clamp(height - oy - (lat - minLat) * s, 6, height - 6),
    };
  }, [w, height, projectionCoords]);

  const geoPoints = useMemo(() => {
    if (!project) return [];
    return coordStops.map((s) => ({
      ...s,
      px: project.x(Number(s.longitude)),
      py: project.y(Number(s.latitude)),
    }));
  }, [project, coordStops]);

  // Schematic fallback: drawable from stop order alone when lat/lng are missing.
  const schematicPoints = useMemo(
    () => (geoPoints.length >= 2 ? [] : schematicLayout(stops, w, height)),
    [geoPoints.length, stops, w, height],
  );

  const points = geoPoints.length >= 2 ? geoPoints : schematicPoints;
  const usingSchematic = geoPoints.length < 2 && schematicPoints.length > 0;
  // Where to draw the bus: real GPS on geo path, else journey progress on schematic.
  const busTarget = useMemo(() => {
    if (mode === 'live' && !bus) return null;
    if (project && geoPoints.length >= 1) {
      if (bus) {
        return {
          x: project.x(bus.longitude),
          y: project.y(bus.latitude),
          heading: bus.heading ?? null,
        };
      }
      const done = [...coordStops].reverse().find((s) => s.status === 'completed');
      const at = done || coordStops[0];
      if (!at) return null;
      return {
        x: project.x(Number(at.longitude)),
        y: project.y(Number(at.latitude)),
        heading: null,
      };
    }
    if (schematicPoints.length === 0) return null;
    if (simulationProgress != null) {
      const clamped = Math.max(
        0,
        Math.min(schematicPoints.length - 1, simulationProgress),
      );
      const fromIndex = Math.floor(clamped);
      const toIndex = Math.min(schematicPoints.length - 1, Math.ceil(clamped));
      const point = lerpPoint(
        schematicPoints[fromIndex],
        schematicPoints[toIndex],
        clamped - fromIndex,
      );
      return { x: point.px, y: point.py, heading: null };
    }

    const idx = journeyIndex(stops, boardingStopId, etaMinutes);
    const at = schematicPoints[Math.min(idx, schematicPoints.length - 1)];
    // Soft approach: with an ETA, glide partway from previous stop toward current.
    if (idx > 0 && etaMinutes != null && etaMinutes > 0) {
      const prev = schematicPoints[idx - 1];
      const approach = etaMinutes >= 20 ? 0.25 : etaMinutes >= 8 ? 0.55 : 0.82;
      const mid = lerpPoint(prev, at, approach);
      return { x: mid.px, y: mid.py, heading: null };
    }
    return { x: at.px, y: at.py, heading: null };
  }, [
    mode,
    project,
    geoPoints.length,
    bus,
    coordStops,
    schematicPoints,
    stops,
    boardingStopId,
    etaMinutes,
    simulationProgress,
  ]);

  const displayRoutePoints = useMemo(() => {
    if (points.length >= 2) return points.map((point) => ({ px: point.px, py: point.py }));
    if ((mode === 'live' || usingSchematic) && points.length === 1) {
      // Approach line from a virtual origin toward the sole stop.
      return [
        { px: PAD, py: height - PAD },
        { px: points[0].px, py: points[0].py },
      ];
    }
    return [];
  }, [points, mode, usingSchematic, height]);

  // ── Bus glide + heading (UI thread) ──
  const bx = useSharedValue(0);
  const by = useSharedValue(0);
  const brot = useSharedValue(0);
  const seeded = useRef(false);
  const prev = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!busTarget) return;
    let rot = 0;
    if (busTarget.heading != null) {
      rot = busTarget.heading;
    } else if (prev.current) {
      const dx = busTarget.x - prev.current.x;
      const dy = busTarget.y - prev.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) rot = (Math.atan2(dx, -dy) * 180) / Math.PI;
      else rot = brot.value;
    }
    if (!seeded.current) {
      bx.value = busTarget.x;
      by.value = busTarget.y;
      brot.value = rot;
      seeded.current = true;
    } else {
      bx.value = withTiming(busTarget.x, { duration: 1200, easing: Easing.inOut(Easing.ease) });
      by.value = withTiming(busTarget.y, { duration: 1200, easing: Easing.inOut(Easing.ease) });
      brot.value = withTiming(rot, { duration: 600 });
    }
    prev.current = { x: busTarget.x, y: busTarget.y };
  }, [busTarget, brot, bx, by]);

  // ── Pulse (UI thread, only while fresh) ──
  const pulse = useSharedValue(1);
  const hasBusTarget = busTarget != null;
  useEffect(() => {
    if (isFresh && hasBusTarget) {
      pulse.value = withRepeat(withTiming(2.4, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    } else {
      pulse.value = withTiming(1);
    }
  }, [isFresh, hasBusTarget, pulse]);

  const busWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bx.value - BUS / 2 }, { translateY: by.value - BUS / 2 }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${brot.value}deg` }] }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 2.4], [0.45, 0]),
  }));

  const accent = ROUTE_COLOR;
  const fresh = isFresh ? accent : '#94A3B8';
  const simulationFraction = simulationProgress != null && simulationStopCount > 1
    ? Math.max(0, Math.min(1, simulationProgress / (simulationStopCount - 1)))
    : 0;

  // Traveled polyline. Simulation mode draws fractional progress rather than
  // jumping an entire segment when the next stop changes.
  const traveledPts = useMemo(() => {
    if (simulationProgress != null) {
      return progressedPoints(points, simulationProgress);
    }
    const out: typeof points = [];
    for (const p of points) {
      out.push(p);
      if (!served(p.status)) break;
    }
    return out.length >= 2 ? out : [];
  }, [points, simulationProgress]);

  const showPath = displayRoutePoints.length >= 2;
  const notablePoints = points.filter(
    (point, index) =>
      index === 0
      || index === points.length - 1
      || point.id === boardingStopId,
  );

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {showPath ? (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: MAP_BG }]} />
          <Svg width={w} height={height}>
            {/* Route casing + pending route, like a navigation app. */}
            <Polyline
              points={pointString(displayRoutePoints)}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={pointString(displayRoutePoints)}
              fill="none"
              stroke="#9BAEB0"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.82}
            />

            {/* Continuously growing traveled route. */}
            {traveledPts.length >= 2 && (
              <>
                <Polyline
                  points={pointString(traveledPts)}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={pointString(traveledPts)}
                  fill="none"
                  stroke={ROUTE_LIGHT}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Route stops with stronger start/end hierarchy. */}
            {points.map((p, index) => {
              const isBoarding = p.id === boardingStopId;
              const done = served(p.status);
              const isStart = index === 0;
              const isEnd = index === points.length - 1;
              const fill = done ? ROUTE_LIGHT : isBoarding ? ROUTE_COLOR : '#FFFFFF';
              const stroke = done || isBoarding ? ROUTE_COLOR : isEnd ? '#0F172A' : '#82999E';
              const radius = isBoarding ? 8 : isStart || isEnd ? 6.5 : 5;
              return (
                <G key={p.id}>
                  {isBoarding && <Circle cx={p.px} cy={p.py} r={15} fill={ROUTE_LIGHT} opacity={0.17} />}
                  <Circle cx={p.px} cy={p.py} r={radius + 2.5} fill="#FFFFFF" opacity={0.95} />
                  <Circle cx={p.px} cy={p.py} r={radius} fill={fill} stroke={stroke} strokeWidth={2.2} />
                  {(isStart || isEnd) && (
                    <Circle cx={p.px} cy={p.py} r={2.1} fill={isEnd ? '#0F172A' : ROUTE_COLOR} />
                  )}
                </G>
              );
            })}

            {/* Label only important stops to keep the map readable. */}
            {notablePoints.map((point) => {
              const label = shortStopName(point.name);
              const labelWidth = Math.max(58, Math.min(142, label.length * 6.5 + 16));
              const labelX = Math.max(7, Math.min(w - labelWidth - 7, point.px - labelWidth / 2));
              const above = point.py > 42;
              const labelY = above ? point.py - 32 : point.py + 14;
              return (
                <G key={`label-${point.id}`}>
                  <Rect
                    x={labelX}
                    y={labelY}
                    width={labelWidth}
                    height={22}
                    rx={8}
                    fill="rgba(255,255,255,0.96)"
                    stroke={point.id === boardingStopId ? ROUTE_LIGHT : '#D9E2E1'}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={labelX + 8}
                    y={labelY + 14.5}
                    fill={point.id === boardingStopId ? ROUTE_COLOR : '#334155'}
                    fontSize={9.5}
                    fontWeight="700"
                  >
                    {label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {/* Bus marker (Reanimated overlay) */}
          {busTarget && (
            <Animated.View pointerEvents="none" style={[styles.busWrap, busWrapStyle]}>
              <Animated.View style={[styles.pulseRing, { backgroundColor: fresh }, pulseStyle]} />
              {(bus?.heading != null || prev.current) && (
                <Animated.View style={[styles.arrowWrap, arrowStyle]}>
                  <View style={[styles.arrow, { borderBottomColor: fresh }]} />
                </Animated.View>
              )}
              <View style={styles.busShadow} />
              <View style={[styles.busBadge, { backgroundColor: fresh, shadowColor: fresh }]}>
                <Ionicons name="bus" size={18} color="#FFFFFF" />
                <View style={styles.vehicleSignalDot} />
              </View>
            </Animated.View>
          )}

          {/* Your-stop label pill */}
          {boardingStopId && (
            <View style={[styles.legend, { borderColor: accent }]}>
              <View style={[styles.legendDot, { backgroundColor: accent }]} />
              <Text style={[styles.legendText, { color: accent }]}>{t('busTracker.your_stop')}</Text>
            </View>
          )}

          <View style={styles.motionStatus} pointerEvents="none">
            <View style={[styles.motionStatusDot, { backgroundColor: isFresh ? ROUTE_LIGHT : '#F59E0B' }]} />
            <Text style={styles.motionStatusText}>
              {simulationProgress != null
                ? t('busTracker.route_simulation')
                : mode === 'preview'
                  ? t('busTracker.route_preview')
                  : isFresh && bus
                    ? t('busTracker.live_gps_active')
                    : bus ? t('busTracker.last_known_position') : t('busTracker.waiting_gps_signal')}
            </Text>
            {etaMinutes != null && (
              <Text style={styles.motionEta}>
                {etaMinutes === 0
                  ? t('busTracker.arriving_now')
                  : t('busTracker.eta_min', { min: etaMinutes })}
              </Text>
            )}
          </View>

          <View style={styles.compass} pointerEvents="none">
            <Ionicons name="navigate" size={17} color={ROUTE_COLOR} />
          </View>
        </>
      ) : (
        mode === 'preview' ? (
          <View style={styles.previewFallback}>
            <Svg width={w || 640} height={height} style={StyleSheet.absoluteFill}>
              <Line x1={-20} y1={height * 0.25} x2={(w || 640) + 20} y2={height * 0.48} stroke="#E2E8F0" strokeWidth={18} />
              <Line x1={(w || 640) * 0.28} y1={-20} x2={(w || 640) * 0.46} y2={height + 20} stroke="#E7ECF1" strokeWidth={11} />
              <Line x1={(w || 640) * 0.76} y1={-20} x2={(w || 640) * 0.61} y2={height + 20} stroke="#E7ECF1" strokeWidth={9} />
              <Polyline
                points={`${(w || 640) * 0.2},${height * 0.7} ${(w || 640) * 0.45},${height * 0.55} ${(w || 640) * 0.76},${height * 0.34}`}
                fill="none"
                stroke="#94A3B8"
                strokeWidth={5}
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
              <Circle cx={(w || 640) * 0.76} cy={height * 0.34} r={11} fill={accent} opacity={0.16} />
              <Circle cx={(w || 640) * 0.76} cy={height * 0.34} r={7} fill={accent} stroke="#FFFFFF" strokeWidth={2} />
            </Svg>
            <View
              style={[
                styles.previewBus,
                { backgroundColor: simulationProgress != null ? '#0F766E' : '#111827' },
                simulationProgress != null && {
                  left: `${18 + simulationFraction * 56}%`,
                  top: `${64 - simulationFraction * 36}%`,
                },
              ]}
            >
              <Ionicons name="bus" size={17} color="#FFFFFF" />
            </View>
            <View style={styles.previewBadge}>
              <View style={simulationProgress != null ? styles.simulationDot : undefined} />
              <Text style={styles.previewBadgeText}>
                {simulationProgress != null
                  ? t('busTracker.route_simulation')
                  : t('busTracker.route_preview')}
              </Text>
            </View>
            <View style={styles.previewStopLabel}>
              <Text style={[styles.previewStopText, { color: accent }]} numberOfLines={1}>
                {stops.find((stop) => stop.id === boardingStopId)?.name || t('busTracker.your_stop_fallback')}
              </Text>
            </View>
          </View>
        ) : (
          // Only when there are no stops at all — waiting for route data.
          <View style={styles.fallback}>
            <View style={[styles.fallbackPulseWrap]}>
              <Animated.View style={[styles.pulseRing, { backgroundColor: fresh, position: 'absolute' }, pulseStyle]} />
              <View style={[styles.busBadge, { backgroundColor: fresh, shadowColor: fresh }]}>
                <Ionicons name="bus" size={16} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.fallbackTitle}>
              {isFresh ? t('busTracker.live_gps_active') : t('busTracker.waiting_gps_signal')}
            </Text>
            <Text style={styles.fallbackSub}>
              {etaMinutes != null
                ? etaMinutes === 0
                  ? t('busTracker.arriving_at_stop')
                  : t('busTracker.eta_to_stop', { min: etaMinutes })
                : t('busTracker.stops_coords_needed')}
            </Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: MAP_BG,
    borderWidth: 1,
    borderColor: '#D7E0DC',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  busWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BUS,
    height: BUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: BUS,
    height: BUS,
    borderRadius: BUS / 2,
  },
  busBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 7,
  },
  busShadow: {
    position: 'absolute',
    bottom: 2,
    width: 30,
    height: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(15,23,42,0.17)',
    transform: [{ scaleX: 1.25 }],
  },
  vehicleSignalDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#34D399',
  },
  arrowWrap: {
    position: 'absolute',
    width: BUS,
    height: BUS,
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -5,
  },
  legend: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '700' },
  motionStatus: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.9)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
  },
  motionStatusDot: { width: 7, height: 7, borderRadius: 4 },
  motionStatusText: {
    maxWidth: 150,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  motionEta: {
    paddingLeft: 7,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.25)',
    color: '#99F6E4',
    fontSize: 10,
    fontWeight: '800',
  },
  compass: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#D8E1DE',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  previewFallback: {
    flex: 1,
    overflow: 'hidden',
  },
  previewBus: {
    position: 'absolute',
    left: '18%',
    top: '64%',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 5,
  },
  previewBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  simulationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#14B8A6' },
  previewBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#64748B' },
  previewStopLabel: {
    position: 'absolute',
    right: '18%',
    top: '23%',
    maxWidth: 160,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  previewStopText: { fontSize: 11, fontWeight: '800' },
  fallbackPulseWrap: {
    width: BUS,
    height: BUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  fallbackTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  fallbackSub: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
});
