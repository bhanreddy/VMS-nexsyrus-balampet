import { TourTarget, TourScrollView } from '@/src/features/app-tour';
import { useTransportPolling } from '../../src/hooks/useTransportPolling';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import AdminHeader from '../../src/components/AdminHeader';
import LiveBusMap, { LiveStop } from '../../src/components/LiveBusMap';
import LogoLoader from '../../src/components/LogoLoader';
import { api } from '../../src/services/apiClient';
import { useTheme } from '../../src/hooks/useTheme';
import { fixAgeSeconds, hasMapCoordinate } from '../../src/services/transportMapModel';

type FleetRoute = { route_id: string; route_name: string; status: string | null; driver_name?: string | null };
type Location = { latitude: number; longitude: number; speed: number | null; heading: number | null; accuracy?: number | null; recorded_at: string; is_fresh: boolean };
type LiveRoute = {
  route: string;
  trip: { id: string; ui_status?: string; status?: string; driver_name?: string | null; trip_direction?: string } | null;
  stops: (LiveStop & { arrival_time?: string | null; departure_time?: string | null })[];
  location: Location | null;
  tracking_health?: { automatic_stops_enabled: boolean; pending_notifications: number; failed_notifications: number; oldest_pending_seconds: number | null; heartbeat_age_seconds?: number | null } | null;
};
const active = (status?: string | null) => status === 'in_progress' || status === 'active';
const served = (status: string) => status === 'completed' || status === 'skipped';
const ageLabel = (seconds: number | null) => seconds == null ? 'No GPS fix' : seconds < 10 ? 'Just now' : seconds < 60 ? `${Math.floor(seconds)}s ago` : `${Math.floor(seconds / 60)}m ago`;
const timeLabel = (value?: string | null) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : null;

/** Read-only operations view. The authenticated transport API owns every location and stop status. */
export default function AdminLiveBusTracking() {
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const { theme } = useTheme();
  const wide = useWindowDimensions().width >= 1050;
  const [selected, setSelected] = useState<string | null>(routeId || null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const request = useRef(0);
  const [fleet, setFleet] = useState<FleetRoute[]>([]);
  const [data, setData] = useState<LiveRoute | null>(null);
  const [query, setQuery] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [receivedAt, setReceivedAt] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (routeId) setSelected(routeId); }, [routeId]);
  useEffect(() => { setData(null); setSelectedStop(null); setLoading(true); }, [selected]);

  const load = useCallback(async () => {
    const token = ++request.current;
    const route = selected;
    try {
      const [routes, detail] = await Promise.allSettled([
        api.get<FleetRoute[]>('/transport/live-today', { limit: 200 }, { silent: true }),
        route ? api.get<LiveRoute>(`/transport/routes/${encodeURIComponent(route)}/live`, undefined, { silent: true }) : Promise.resolve(null),
      ]);
      if (token !== request.current || selectedRef.current !== route) return;
      if (routes.status === 'fulfilled') {
        setFleet(routes.value);
        if (!route && routes.value.length) setSelected((routes.value.find(item => active(item.status)) || routes.value[0]).route_id);
      }
      if (detail.status === 'fulfilled') { setData(detail.value); setReceivedAt(Date.now()); }
      setError(routes.status === 'rejected' || detail.status === 'rejected'
        ? 'Connection interrupted. Last received information is shown; location age continues to update.' : null);
    } catch {
      if (token === request.current && selectedRef.current === route) setError('Connection interrupted. Last received information is shown; location age continues to update.');
    } finally {
      if (token === request.current && selectedRef.current === route) { setLoading(false); setRefreshing(false); }
    }
  }, [selected]);
  useTransportPolling(load, 3000, selected || 'fleet');
  useEffect(() => () => { request.current++; }, []);

  const isLive = active(data?.trip?.ui_status || data?.trip?.status);
  const age = fixAgeSeconds(data?.location?.recorded_at, now);
  const location = hasMapCoordinate(data?.location) ? data.location : null;
  const fresh = isLive && !!location?.is_fresh && age != null && age <= 30;
  const health = data?.tracking_health;
  const heartbeatAge = health?.heartbeat_age_seconds == null ? null : health.heartbeat_age_seconds + Math.max(0, (now - receivedAt) / 1000);
  const stops = data?.stops || [];
  const finished = stops.filter(stop => served(stop.status)).length;
  const next = stops.find(stop => stop.status === 'arrived') || stops.find(stop => !served(stop.status));
  const liveCount = fleet.filter(item => active(item.status)).length;
  const visibleRoutes = fleet.filter(item => (filter === 'all' || active(item.status)) && `${item.route_name} ${item.driver_name || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const surface = { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderLight };
  const ink = { color: theme.colors.textStrong };
  const muted = { color: theme.colors.textSecondary };
  const primary = theme.colors.primary;
  const statusLabel = fresh ? 'Live GPS' : isLive ? location ? 'Signal delayed' : 'Waiting for GPS' : data?.trip?.status === 'completed' ? 'Trip completed' : 'Not started';

  return <TourTarget id="screen.admin-live-bus-tracking.workspace" native><View style={[s.page, { backgroundColor: theme.colors.background }]}>
    <TourTarget id="screen.admin-live-bus-tracking.overview"><AdminHeader title="Bus tracking" showBackButton /></TourTarget>
    <TourScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={primary} />}>
      <View style={s.titleRow}>
        <View style={{ flex: 1 }}><Text style={[s.eyebrow, { color: primary }]}>TRANSPORT OPERATIONS</Text><Text style={[s.title, ink]}>Today’s bus journeys</Text><Text style={[s.subtitle, muted]}>Monitor today’s journeys, stops and tracking health.</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh tracking" onPress={() => void load()} style={[s.refresh, surface]}><Ionicons name="refresh-outline" size={18} color={primary} /><Text style={[s.refreshText, ink]}>Refresh</Text></TouchableOpacity>
      </View>
      <View style={s.summaryRow}>
        {[{ label: 'Routes today', value: fleet.length, icon: 'git-branch-outline' }, { label: 'On the road', value: liveCount, icon: 'navigate-outline' }, { label: 'Completed', value: fleet.filter(item => item.status === 'completed').length, icon: 'checkmark-circle-outline' }].map(item => <View key={item.label} style={[s.summary, surface]}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={primary} /><View><Text style={[s.summaryValue, ink]}>{item.value}</Text><Text style={[s.small, muted]}>{item.label}</Text></View></View>)}
      </View>
      {error && <View style={s.warning} accessibilityLiveRegion="polite"><Ionicons name="cloud-offline-outline" size={18} color="#92400E" /><Text style={s.warningText}>{error}</Text></View>}
      <View style={[s.workspace, wide && s.workspaceWide]}>
        <View style={[s.fleet, surface, wide && { width: 280 }]}>
          <View style={s.sectionHeading}><Text style={[s.sectionTitle, ink]}>Route directory</Text><Text style={[s.small, muted]}>{fleet.length} routes</Text></View>
          {!wide && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change route" accessibilityState={{ expanded: directoryOpen }} onPress={() => setDirectoryOpen(value => !value)} style={[s.routePicker, { backgroundColor: theme.colors.background }]}><Ionicons name="bus-outline" size={20} color={primary} /><Text numberOfLines={1} style={[s.routeName, ink, { flex: 1 }]}>{fleet.find(item => item.route_id === selected)?.route_name || 'Choose a route'}</Text><Ionicons name={directoryOpen ? 'chevron-up' : 'chevron-down'} size={16} color={primary} /></TouchableOpacity>}
          {(wide || directoryOpen) && <>
          <View style={[s.search, { backgroundColor: theme.colors.background }]}><Ionicons name="search-outline" size={17} color={theme.colors.textSecondary} /><TextInput accessibilityLabel="Search routes or drivers" placeholder="Search route or driver" placeholderTextColor={theme.colors.textSecondary} value={query} onChangeText={setQuery} style={[s.searchInput, ink]} /></View>
          <View style={s.filters}>{(['all', 'active'] as const).map(value => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.filter, filter === value && { backgroundColor: primary }]}><Text style={[s.filterText, { color: filter === value ? '#FFF' : theme.colors.textSecondary }]}>{value === 'all' ? 'All routes' : 'On the road'}</Text></TouchableOpacity>)}</View>
          <ScrollView style={{ maxHeight: wide ? 550 : 205 }} nestedScrollEnabled>
            {visibleRoutes.map(item => <TouchableOpacity key={item.route_id} accessibilityRole="button" accessibilityState={{ selected: selected === item.route_id }} onPress={() => { setSelected(item.route_id); setDirectoryOpen(false); }} style={[s.routeItem, { borderColor: selected === item.route_id ? primary : 'transparent', backgroundColor: selected === item.route_id ? `${primary}0D` : 'transparent' }]}>
              <View style={[s.routeIcon, { backgroundColor: active(item.status) ? '#DCFCE7' : theme.colors.background }]}><Ionicons name="bus-outline" size={19} color={active(item.status) ? '#047857' : theme.colors.textSecondary} /></View>
              <View style={{ flex: 1 }}><Text numberOfLines={1} style={[s.routeName, ink]}>{item.route_name}</Text><Text numberOfLines={1} style={[s.small, muted]}>{item.driver_name || 'Driver not assigned'}</Text><Text style={[s.routeStatus, { color: active(item.status) ? '#059669' : theme.colors.textSecondary }]}>{active(item.status) ? 'On the road' : item.status === 'completed' ? 'Completed' : 'Not started'}</Text></View>
              {selected === item.route_id && <Ionicons name="chevron-forward" size={16} color={primary} />}
            </TouchableOpacity>)}
            {!visibleRoutes.length && <Text style={[s.emptyText, muted]}>{fleet.length ? 'No matching routes.' : loading ? 'Loading routes…' : 'No routes available.'}</Text>}
          </ScrollView>
          </>}
        </View>
        <View style={s.detail}>
          {loading && !data ? <View style={[s.loading, surface]}><LogoLoader size={48} color={primary} /></View> : !data ? <View style={[s.loading, surface]}><Ionicons name="map-outline" size={40} color={primary} /><Text style={[s.sectionTitle, ink]}>Choose a route</Text><Text style={[s.small, muted]}>Its journey and live location will appear here.</Text></View> : <>
            <View style={[s.mapCard, surface]}>
              <View style={s.mapHeading}><View style={{ flex: 1 }}><Text style={[s.eyebrow, muted]}>{data.trip?.trip_direction === 'evening' ? 'AFTERNOON JOURNEY' : 'TODAY’S JOURNEY'}</Text><Text style={[s.routeTitle, ink]}>{data.route}</Text><Text style={[s.small, muted]}>{data.trip?.driver_name || 'Driver not assigned'} · {ageLabel(age)}</Text></View><View style={[s.statusBadge, { backgroundColor: fresh ? '#DCFCE7' : isLive ? '#FEF3C7' : theme.colors.background }]}><View style={[s.dot, { backgroundColor: fresh ? '#059669' : isLive ? '#D97706' : '#94A3B8' }]} /><Text style={[s.statusText, { color: fresh ? '#047857' : isLive ? '#92400E' : theme.colors.textSecondary }]}>{statusLabel}</Text></View></View>
              <LiveBusMap key={selected} stops={stops} busLocation={location} heading={location?.heading} speed={location?.speed} accuracy={location?.accuracy} isFresh={fresh} selectedStopId={selectedStop} height={wide ? 420 : 340} />
              <View style={s.mapFooter}><Ionicons name="information-circle-outline" size={15} color={theme.colors.textSecondary} /><Text style={[s.mapNote, muted]}>Lines connect stops in travel order. They are not road directions.</Text></View>
            </View>
            <View style={[s.progressCard, surface]}>
              <View style={s.sectionHeading}><View><Text style={[s.eyebrow, muted]}>JOURNEY PROGRESS</Text><Text style={[s.sectionTitle, ink]}>{finished} of {stops.length} stops resolved</Text></View><Text style={[s.progressPercent, { color: primary }]}>{stops.length ? Math.round(finished / stops.length * 100) : 0}%</Text></View>
              <View style={[s.progressTrack, { backgroundColor: theme.colors.background }]}><View style={[s.progressFill, { width: `${stops.length ? finished / stops.length * 100 : 0}%`, backgroundColor: primary }]} /></View>
              <View style={s.nextRow}><Ionicons name="navigate-circle" size={30} color={primary} /><View style={{ flex: 1 }}><Text style={[s.eyebrow, muted]}>{!isLive ? data.trip?.status === 'completed' ? 'JOURNEY ENDED' : 'FIRST STOP' : next?.status === 'arrived' ? 'AT STOP' : 'UP NEXT'}</Text><Text style={[s.routeName, ink]}>{next?.name || (stops.length ? 'All stops resolved' : 'Stops not configured')}</Text></View><Text style={[s.small, muted]}>{fresh && location?.speed != null ? `${Math.round(location.speed)} km/h` : 'Speed unavailable'}</Text></View>
            </View>
            <View style={[s.lowerRow, wide && { flexDirection: 'row', alignItems: 'flex-start' }]}>
              <View style={[s.stopCard, surface, { flex: 1 }]}><View style={s.sectionHeading}><Text style={[s.sectionTitle, ink]}>Stop timeline</Text>{selectedStop && <TouchableOpacity accessibilityRole="button" onPress={() => setSelectedStop(null)}><Text style={{ color: primary, fontSize: 12, fontWeight: '700' }}>Show route</Text></TouchableOpacity>}</View>
                {stops.map((stop, index) => { const done = served(stop.status); const current = isLive && next?.id === stop.id; const located = hasMapCoordinate(stop); return <TouchableOpacity key={stop.id} accessibilityRole="button" accessibilityLabel={`${stop.name}, ${stop.status}${located ? ', show on map' : ', coordinates unavailable'}`} disabled={!located} onPress={() => setSelectedStop(stop.id === selectedStop ? null : stop.id)} style={[s.stopRow, { borderColor: theme.colors.borderLight }, current && { backgroundColor: `${primary}0A` }]}><View style={[s.stopNumber, { backgroundColor: done ? theme.colors.background : current ? primary : theme.colors.surface, borderColor: current ? primary : theme.colors.borderLight }]}>{stop.status === 'completed' ? <Ionicons name="checkmark" size={14} color="#059669" /> : <Text style={{ fontSize: 11, fontWeight: '800', color: current ? '#FFF' : theme.colors.textSecondary }}>{index + 1}</Text>}</View><View style={{ flex: 1 }}><Text style={[s.routeName, ink]}>{stop.name}</Text><Text style={[s.small, muted]}>{stop.status === 'skipped' ? 'Skipped' : stop.status === 'completed' ? 'Departed' : stop.status === 'arrived' ? 'At stop' : 'Upcoming'}{!located ? ' · No coordinates' : ''}</Text></View><Text style={[s.small, muted]}>{timeLabel(stop.departure_time || stop.arrival_time) || (located ? '↗' : '—')}</Text></TouchableOpacity>; })}
                {!stops.length && <Text style={[s.emptyText, muted]}>Add route stops to see the journey timeline.</Text>}
              </View>
              <View style={[s.healthCard, surface, wide && { width: 260 }]}><Text style={[s.sectionTitle, ink]}>Tracking health</Text>
                <HealthRow icon="radio-outline" label="GPS signal" value={fresh ? 'Receiving location' : location ? 'Last known location' : 'No location yet'} color={fresh ? '#059669' : '#D97706'} />
                <HealthRow icon="phone-portrait-outline" label="Driver connection" value={heartbeatAge == null ? 'Not available' : heartbeatAge <= 120 ? 'Recently connected' : 'Connection delayed'} color={heartbeatAge != null && heartbeatAge <= 120 ? '#059669' : '#64748B'} />
                <HealthRow icon="git-branch-outline" label="Stop updates" value={!isLive ? 'Available during a trip' : health?.automatic_stops_enabled ? 'Automatic GPS updates' : 'Driver confirmations'} color={primary} />
                <HealthRow icon="notifications-outline" label="Parent notifications" value={health ? `${health.pending_notifications} pending · ${health.failed_notifications} failed` : 'No active delivery data'} color={health && (health.failed_notifications > 0 || (health.oldest_pending_seconds || 0) > 120) ? '#D97706' : '#64748B'} />
                <Text style={[s.healthNote, muted]}>{!isLive ? 'Live tracking starts when the driver begins a trip.' : fresh ? 'Tracking refreshes every 3 seconds.' : 'Check the driver’s connection if updates remain delayed.'}</Text>
              </View>
            </View>
          </>}
        </View>
      </View>
    </TourScrollView>
  </View></TourTarget>;
}
function HealthRow({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  const { theme } = useTheme();
  return <View style={s.healthRow}><Ionicons name={icon} size={18} color={color} /><View style={{ flex: 1 }}><Text style={[s.small, { color: theme.colors.textSecondary }]}>{label}</Text><Text style={[s.healthValue, { color: theme.colors.textStrong }]}>{value}</Text></View></View>;
}
const s = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 20, gap: 18, paddingBottom: 40, maxWidth: 1600, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 }, title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 }, subtitle: { fontSize: 13, marginTop: 6, lineHeight: 19 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 44 }, refreshText: { fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 10 }, summary: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, borderWidth: 1 }, summaryValue: { fontSize: 23, fontWeight: '800' }, small: { fontSize: 11, lineHeight: 17 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, backgroundColor: '#FFFBEB' }, warningText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  workspace: { gap: 18 }, workspaceWide: { flexDirection: 'row', alignItems: 'flex-start' }, fleet: { padding: 14, borderWidth: 1, borderRadius: 20 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }, sectionTitle: { fontSize: 15, fontWeight: '800' },
  routePicker: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, minHeight: 48, marginBottom: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 10 }, searchInput: { flex: 1, minHeight: 42, fontSize: 12 }, filters: { flexDirection: 'row', gap: 6, marginVertical: 12 }, filter: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 9, minHeight: 36 }, filterText: { fontSize: 11, fontWeight: '700' }, routeItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, gap: 10, marginBottom: 5 }, routeIcon: { width: 37, height: 37, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, routeName: { fontSize: 13, fontWeight: '700', lineHeight: 19 }, routeStatus: { fontSize: 10, fontWeight: '700', marginTop: 3 }, emptyText: { padding: 18, textAlign: 'center', lineHeight: 20 },
  detail: { flex: 1, minWidth: 0, gap: 16 }, loading: { minHeight: 340, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 12 }, mapCard: { padding: 14, borderRadius: 20, borderWidth: 1 }, mapHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }, routeTitle: { fontSize: 21, fontWeight: '800', marginBottom: 3 }, statusBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 30 }, dot: { width: 6, height: 6, borderRadius: 3 }, statusText: { fontSize: 10, fontWeight: '800' }, mapFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 }, mapNote: { flex: 1, fontSize: 10, lineHeight: 15 },
  progressCard: { padding: 18, borderRadius: 18, borderWidth: 1 }, progressPercent: { fontSize: 23, fontWeight: '800' }, progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3 }, nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }, lowerRow: { gap: 16 }, stopCard: { padding: 16, borderRadius: 18, borderWidth: 1 }, stopRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 6, borderTopWidth: 1, minHeight: 64 }, stopNumber: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  healthCard: { padding: 16, borderRadius: 18, borderWidth: 1 }, healthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 18 }, healthValue: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 1 }, healthNote: { fontSize: 11, lineHeight: 17, marginTop: 18 },
});
