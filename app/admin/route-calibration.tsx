import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AdminHeader from '../../src/components/AdminHeader';
import { Map, Camera, GeoJSONSource, Layer, Marker } from '../../src/components/MapWrapper';
import { api } from '../../src/services/apiClient';
import { useTheme } from '../../src/hooks/useTheme';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Elevation, Radii, Spacing } from '../../src/theme/themes';

type LegName = 'morning' | 'evening';

type CalibrationStop = {
  stop_id: string;
  name: string;
  stop_order: number;
  latitude: number | string | null;
  longitude: number | string | null;
  radius_m: number | string | null;
  sample_count: number;
  last_accuracy_m: number | string | null;
  locked: boolean;
  updated_at: string | null;
};

type CalibrationSegment = {
  from_stop_id: string;
  from_stop_name: string;
  to_stop_id: string;
  to_stop_name: string;
  ewma_seconds: number | string;
  ewvar_seconds: number | string;
  sample_count: number;
};

type CalibrationLeg = {
  trip_direction: LegName;
  is_calibrated: boolean;
  stops_total: number;
  stops_calibrated: number;
  segments_total: number;
  segments_learned: number;
  clean_trip_count: number;
  stops: CalibrationStop[];
  segments: CalibrationSegment[];
};

type CalibrationReview = {
  route: { id: string; name: string; direction?: string | null };
  legs: CalibrationLeg[];
};

const OSM_STYLE = JSON.stringify({
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
});

function PressScale({ children, onPress, disabled = false }: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.97, { duration: 90 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 110 }); }}
      hitSlop={6}
    >
      <Animated.View style={[animated, disabled && styles.disabled]}>{children}</Animated.View>
    </Pressable>
  );
}

const numberOrNull = (value: number | string | null) => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDuration = (seconds: number | string) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
};

export default function RouteCalibrationScreen() {
  const { theme, isDark } = useTheme();
  const params = useLocalSearchParams<{ routeId?: string; routeName?: string }>();
  const routeId = String(params.routeId || '');
  const routeName = params.routeName ? decodeURIComponent(String(params.routeName)) : 'Route calibration';

  const [review, setReview] = useState<CalibrationReview | null>(null);
  const [activeLeg, setActiveLeg] = useState<LegName>('morning');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CalibrationStop | null>(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locked, setLocked] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!routeId) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.get<CalibrationReview>(`/transport/routes/${routeId}/calibration`);
      setReview(data);
    } catch (error: any) {
      alertCompat('Could not load calibration', error?.message || 'Try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId]);

  useEffect(() => { void load(); }, [load]);

  const leg = review?.legs.find((item) => item.trip_direction === activeLeg) ?? null;
  const locatedStops = useMemo(
    () => (leg?.stops ?? []).filter((stop) => numberOrNull(stop.latitude) != null && numberOrNull(stop.longitude) != null),
    [leg?.stops],
  );

  const bounds = useMemo(() => {
    if (!locatedStops.length) return null;
    const lats = locatedStops.map((stop) => Number(stop.latitude));
    const lngs = locatedStops.map((stop) => Number(stop.longitude));
    const pad = 0.004;
    return [
      Math.min(...lngs) - pad,
      Math.min(...lats) - pad,
      Math.max(...lngs) + pad,
      Math.max(...lats) + pad,
    ] as [number, number, number, number];
  }, [locatedStops]);

  const routeLine = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: locatedStops.length > 1 ? [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: locatedStops.map((stop) => [Number(stop.longitude), Number(stop.latitude)]),
      },
    }] : [],
  }), [locatedStops]);

  const openEditor = (stop: CalibrationStop) => {
    if (numberOrNull(stop.latitude) == null || numberOrNull(stop.longitude) == null) return;
    setEditing(stop);
    setLatitude(Number(stop.latitude).toFixed(7));
    setLongitude(Number(stop.longitude).toFixed(7));
    setLocked(stop.locked);
  };

  const saveOverride = async () => {
    if (!editing) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      alertCompat('Check coordinates', 'Latitude must be -90…90 and longitude -180…180.');
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/transport/stops/${editing.stop_id}/geo`, {
        trip_direction: activeLeg,
        latitude: lat,
        longitude: lng,
        locked,
      });
      setEditing(null);
      await load(true);
      alertCompat('Saved', locked ? 'Coordinate saved and locked.' : 'Coordinate saved and left adaptive.');
    } catch (error: any) {
      alertCompat('Could not save', error?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLock = async (stop: CalibrationStop) => {
    try {
      setSaving(true);
      await api.patch(`/transport/stops/${stop.stop_id}/geo`, {
        trip_direction: activeLeg,
        locked: !stop.locked,
      });
      await load(true);
    } catch (error: any) {
      alertCompat('Could not update lock', error?.message || 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmReset = () => {
    const label = activeLeg === 'morning' ? 'Morning' : 'Evening';
    alertCompat(
      `Reset ${label} calibration?`,
      'This deletes learned stop coordinates and segment times for this leg. Drivers must complete calibration trips again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await api.post(`/transport/routes/${routeId}/calibration/reset?trip_direction=${activeLeg}`);
              await load(true);
              alertCompat('Reset complete', `${label} leg returned to calibration mode.`);
            } catch (error: any) {
              alertCompat('Reset failed', error?.message || 'Try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const background = theme.colors.background;
  const surface = theme.colors.surface;
  const mutedSurface = theme.colors.borderLight;

  if (loading && !review) {
    return (
      <View style={[styles.screen, { backgroundColor: background }]}>
        <AdminHeader title={routeName} showBackButton showProfileButton={false} />
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading learned route…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AdminHeader title="Calibration review" showBackButton showProfileButton={false} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(280)} style={[styles.hero, { backgroundColor: surface }, Elevation.level1]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.navPill }]}>
            <Ionicons name="analytics-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>LEARNED ROUTE</Text>
            <Text style={[styles.heroTitle, { color: theme.colors.textStrong }]} numberOfLines={2}>
              {review?.route.name || routeName}
            </Text>
            <Text style={[styles.heroBody, { color: theme.colors.textSecondary }]}>Review the coordinates the driver taught the system.</Text>
          </View>
        </Animated.View>

        <View style={[styles.segmented, { backgroundColor: mutedSurface }]}>
          {(['morning', 'evening'] as LegName[]).map((item) => {
            const selected = activeLeg === item;
            return (
              <Pressable
                key={item}
                onPress={() => setActiveLeg(item)}
                style={[styles.segmentButton, selected && { backgroundColor: surface, ...Elevation.level1 }]}
              >
                <Ionicons
                  name={item === 'morning' ? 'sunny-outline' : 'moon-outline'}
                  size={17}
                  color={selected ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={[styles.segmentLabel, { color: selected ? theme.colors.textStrong : theme.colors.textSecondary }]}>
                  {item === 'morning' ? 'Morning' : 'Evening'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {leg && (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.statValue, { color: theme.colors.textStrong }]}>{leg.stops_calibrated}/{leg.stops_total}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Stops learned</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.statValue, { color: theme.colors.textStrong }]}>{leg.clean_trip_count}/4</Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Clean trips</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: leg.is_calibrated ? theme.colors.success : theme.colors.warning }]} />
                <Text style={[styles.statLabelStrong, { color: theme.colors.textStrong }]}>{leg.is_calibrated ? 'Auto mode' : 'Learning'}</Text>
              </View>
            </View>

            {Platform.OS !== 'web' && bounds ? (
              <View style={[styles.mapCard, { backgroundColor: surface, borderColor: theme.colors.border }]}>
                <Map style={StyleSheet.absoluteFillObject} mapStyle={OSM_STYLE} logo={false} attribution={false}>
                  <Camera bounds={bounds} />
                  {locatedStops.length > 1 && (
                    <GeoJSONSource id={`calibration-route-${activeLeg}`} data={routeLine}>
                      <Layer
                        id={`calibration-line-${activeLeg}`}
                        type="line"
                        paint={{ 'line-color': theme.colors.primary, 'line-width': 4, 'line-opacity': 0.78 }}
                        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                      />
                    </GeoJSONSource>
                  )}
                  {locatedStops.map((stop) => (
                    <Marker key={stop.stop_id} id={`calibration-${activeLeg}-${stop.stop_id}`} lngLat={[Number(stop.longitude), Number(stop.latitude)]}>
                      <Pressable onPress={() => openEditor(stop)} style={[styles.mapPin, { backgroundColor: stop.locked ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.primary }]}>
                        <Text style={[styles.mapPinText, { color: stop.locked ? '#FFFFFF' : theme.colors.primary }]}>{stop.stop_order}</Text>
                        {stop.locked && <Ionicons name="lock-closed" size={8} color="#FFFFFF" style={styles.mapPinLock} />}
                      </Pressable>
                    </Marker>
                  ))}
                </Map>
                <Text style={styles.attribution}>© OpenStreetMap</Text>
              </View>
            ) : Platform.OS !== 'web' ? (
              <View style={[styles.emptyMap, { backgroundColor: mutedSurface }]}>
                <Ionicons name="map-outline" size={28} color={theme.colors.textMuted} />
                <Text style={[styles.emptyMapText, { color: theme.colors.textSecondary }]}>No learned coordinates for this leg yet.</Text>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.textStrong }]}>{Platform.OS === 'web' ? 'Learned coordinates' : 'Stops & controls'}</Text>
                <Text style={[styles.sectionSub, { color: theme.colors.textSecondary }]}>Locked rows are protected from automatic refinement.</Text>
              </View>
              <View style={[styles.lockCount, { backgroundColor: theme.colors.navPill }]}>
                <Ionicons name="lock-closed-outline" size={13} color={theme.colors.primary} />
                <Text style={[styles.lockCountText, { color: theme.colors.primary }]}>{leg.stops.filter((stop) => stop.locked).length}</Text>
              </View>
            </View>

            {leg.stops.map((stop) => {
              const hasGeo = numberOrNull(stop.latitude) != null && numberOrNull(stop.longitude) != null;
              return (
                <View key={stop.stop_id} style={[styles.stopRow, { backgroundColor: surface, borderColor: theme.colors.border }]}>
                  <View style={[styles.orderBadge, { backgroundColor: hasGeo ? theme.colors.navPill : mutedSurface }]}>
                    <Text style={[styles.orderText, { color: hasGeo ? theme.colors.primary : theme.colors.textMuted }]}>{stop.stop_order}</Text>
                  </View>
                  <View style={styles.stopCopy}>
                    <View style={styles.stopTitleRow}>
                      <Text style={[styles.stopName, { color: theme.colors.textStrong }]} numberOfLines={1}>{stop.name}</Text>
                      {stop.locked && <Ionicons name="lock-closed" size={13} color={theme.colors.primary} />}
                    </View>
                    <Text selectable style={[styles.coordinates, { color: hasGeo ? theme.colors.textSecondary : theme.colors.textMuted }]}>
                      {hasGeo
                        ? `${Number(stop.latitude).toFixed(6)}, ${Number(stop.longitude).toFixed(6)}`
                        : 'Waiting for a clean driver sample'}
                    </Text>
                    {hasGeo && (
                      <Text style={[styles.stopMeta, { color: theme.colors.textMuted }]}>
                        {Math.round(Number(stop.radius_m) || 0)}m radius · {stop.sample_count} sample{stop.sample_count === 1 ? '' : 's'}
                      </Text>
                    )}
                  </View>
                  {hasGeo && (
                    <View style={styles.rowActions}>
                      <PressScale onPress={() => openEditor(stop)} disabled={saving}>
                        <View style={[styles.iconButton, { backgroundColor: mutedSurface }]}>
                          <Ionicons name="locate-outline" size={18} color={theme.colors.primary} />
                        </View>
                      </PressScale>
                      <PressScale onPress={() => toggleLock(stop)} disabled={saving}>
                        <View style={[styles.iconButton, { backgroundColor: stop.locked ? theme.colors.navPill : mutedSurface }]}>
                          <Ionicons name={stop.locked ? 'lock-closed' : 'lock-open-outline'} size={17} color={stop.locked ? theme.colors.primary : theme.colors.textSecondary} />
                        </View>
                      </PressScale>
                    </View>
                  )}
                </View>
              );
            })}

            <Text style={[styles.sectionTitle, styles.segmentSectionTitle, { color: theme.colors.textStrong }]}>Learned segment times</Text>
            {leg.segments.length ? leg.segments.map((segment) => (
              <View key={`${segment.from_stop_id}-${segment.to_stop_id}`} style={[styles.segmentRow, { borderColor: theme.colors.border }]}>
                <View style={[styles.segmentIcon, { backgroundColor: theme.colors.navPill }]}>
                  <Ionicons name="time-outline" size={17} color={theme.colors.primary} />
                </View>
                <View style={styles.segmentCopy}>
                  <Text style={[styles.segmentName, { color: theme.colors.textStrong }]} numberOfLines={1}>{segment.from_stop_name} → {segment.to_stop_name}</Text>
                  <Text style={[styles.segmentMeta, { color: theme.colors.textSecondary }]}>{segment.sample_count} timing samples</Text>
                </View>
                <Text style={[styles.segmentTime, { color: theme.colors.primary }]}>{formatDuration(segment.ewma_seconds)}</Text>
              </View>
            )) : (
              <Text style={[styles.emptySegments, { color: theme.colors.textMuted }]}>No segment timings learned yet.</Text>
            )}

            <PressScale onPress={confirmReset} disabled={saving}>
              <View style={[styles.resetButton, { backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : '#FEF2F2', borderColor: isDark ? 'rgba(248,113,113,0.28)' : '#FECACA' }]}>
                <Ionicons name="refresh-circle-outline" size={20} color={theme.colors.danger} />
                <Text style={[styles.resetText, { color: theme.colors.danger }]}>Reset {activeLeg} calibration</Text>
              </View>
            </PressScale>
          </>
        )}
      </ScrollView>

      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && setEditing(null)} />
          <View style={[styles.modalCard, { backgroundColor: surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: theme.colors.primary }]}>ADMIN OVERRIDE</Text>
                <Text style={[styles.modalTitle, { color: theme.colors.textStrong }]}>{editing?.name}</Text>
              </View>
              <Pressable onPress={() => setEditing(null)} style={[styles.modalClose, { backgroundColor: mutedSurface }]} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Latitude</Text>
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numbers-and-punctuation"
              selectTextOnFocus
              style={[styles.field, { color: theme.colors.textStrong, backgroundColor: background, borderColor: theme.colors.border }]}
            />
            <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>Longitude</Text>
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numbers-and-punctuation"
              selectTextOnFocus
              style={[styles.field, { color: theme.colors.textStrong, backgroundColor: background, borderColor: theme.colors.border }]}
            />

            <View style={[styles.lockToggleRow, { backgroundColor: mutedSurface }]}>
              <View style={styles.lockToggleCopy}>
                <Text style={[styles.lockToggleTitle, { color: theme.colors.textStrong }]}>Lock this coordinate</Text>
                <Text style={[styles.lockToggleBody, { color: theme.colors.textSecondary }]}>Driver samples will not move it.</Text>
              </View>
              <Switch value={locked} onValueChange={setLocked} trackColor={{ false: theme.colors.border, true: theme.colors.primaryLight }} thumbColor={locked ? theme.colors.primary : '#FFFFFF'} />
            </View>

            <PressScale onPress={saveOverride} disabled={saving}>
              <View style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />}
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save coordinate'}</Text>
              </View>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 56, width: '100%', maxWidth: 980, alignSelf: 'center' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { fontSize: 14, fontWeight: '500' },
  hero: { borderRadius: Radii.xxl, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 3 },
  heroBody: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: Radii.lg, marginTop: Spacing.md },
  segmentButton: { flex: 1, height: 44, borderRadius: Radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentLabel: { fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  statCard: { flex: 1, minHeight: 82, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.sm, justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  statLabelStrong: { fontSize: 13, fontWeight: '700', marginTop: 7 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  mapCard: { height: 320, borderRadius: Radii.xl, overflow: 'hidden', borderWidth: 1, marginTop: Spacing.md },
  mapPin: { minWidth: 32, height: 32, paddingHorizontal: 7, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mapPinText: { fontSize: 12, fontWeight: '800' },
  mapPinLock: { position: 'absolute', right: 3, bottom: 2 },
  attribution: { position: 'absolute', right: 8, bottom: 5, fontSize: 9, color: '#64748B' },
  emptyMap: { minHeight: 180, borderRadius: Radii.xl, marginTop: Spacing.md, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, padding: Spacing.md },
  emptyMapText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  sectionHeader: { marginTop: Spacing.lg, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  lockCount: { minWidth: 42, height: 30, borderRadius: 15, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  lockCountText: { fontSize: 12, fontWeight: '800' },
  stopRow: { minHeight: 86, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.sm, flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  orderBadge: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 14, fontWeight: '800' },
  stopCopy: { flex: 1, minWidth: 0, marginLeft: Spacing.sm },
  stopTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stopName: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  coordinates: { fontSize: 12, fontVariant: ['tabular-nums'], marginTop: 4 },
  stopMeta: { fontSize: 11, marginTop: 3 },
  rowActions: { flexDirection: 'row', gap: 6, marginLeft: Spacing.xs },
  iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentSectionTitle: { marginTop: Spacing.lg, marginBottom: Spacing.sm },
  segmentRow: { minHeight: 66, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  segmentIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  segmentCopy: { flex: 1, minWidth: 0, marginHorizontal: Spacing.sm },
  segmentName: { fontSize: 14, fontWeight: '700' },
  segmentMeta: { fontSize: 11, marginTop: 3 },
  segmentTime: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  emptySegments: { fontSize: 13, paddingVertical: Spacing.lg, textAlign: 'center' },
  resetButton: { minHeight: 52, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resetText: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,14,28,0.52)', justifyContent: 'center', padding: Spacing.md },
  modalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', borderRadius: 26, padding: Spacing.lg, ...Elevation.level2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  modalEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  modalClose: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  field: { height: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: Spacing.md, fontSize: 16, fontVariant: ['tabular-nums'], marginBottom: Spacing.md },
  lockToggleRow: { minHeight: 68, borderRadius: Radii.lg, padding: Spacing.sm, flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  lockToggleCopy: { flex: 1, marginRight: Spacing.sm },
  lockToggleTitle: { fontSize: 14, fontWeight: '700' },
  lockToggleBody: { fontSize: 12, marginTop: 3 },
  saveButton: { height: 52, borderRadius: Radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
