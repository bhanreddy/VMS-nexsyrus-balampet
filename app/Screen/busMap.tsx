import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import ScreenLayout from '../../src/components/ScreenLayout';
import { useTranslation } from 'react-i18next';
import StudentHeader from '../../src/components/StudentHeader';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import { Map, Camera, GeoJSONSource, Layer, Marker } from '../../src/components/MapWrapper';
import { supabase } from '../../src/services/supabaseConfig';
import { useLocalSearchParams } from 'expo-router';

// OpenStreetMap raster tile style (no API key required)
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19
    }
  },
  layers: [
  {
    id: 'osm-tiles',
    type: 'raster',
    source: 'osm',
    minzoom: 0,
    maxzoom: 19
  }]

};

// A short static path near New Delhi matching our simulator
const ROUTE_COORDINATES = [
{ latitude: 28.6139, longitude: 77.2090 },
{ latitude: 28.6145, longitude: 77.2095 },
{ latitude: 28.6150, longitude: 77.2100 },
{ latitude: 28.6155, longitude: 77.2105 },
{ latitude: 28.6160, longitude: 77.2110 },
{ latitude: 28.6165, longitude: 77.2115 },
{ latitude: 28.6170, longitude: 77.2120 },
{ latitude: 28.6175, longitude: 77.2125 },
{ latitude: 28.6180, longitude: 77.2130 }];

// Convert route to GeoJSON LineString (MapLibre uses [lng, lat])

// Reference coordinates for Haversine distance
type Coord = {latitude: number;longitude: number;};

// Helper 1: Calculate Distance (Haversine) in KM
const calculateDistance = (coord1: Coord, coord2: Coord) => {
  const toRadian = (degree: number) => degree * Math.PI / 180;
  const R = 6371;

  const dLat = toRadian(coord2.latitude - coord1.latitude);
  const dLon = toRadian(coord2.longitude - coord1.longitude);
  const lat1 = toRadian(coord1.latitude);
  const lat2 = toRadian(coord2.latitude);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Helper 2: Find Closest Route Index
const getClosestRouteIndex = (busLocation: Coord, route: Coord[]) => {
  if (!route || route.length === 0) return 0;
  let minDistance = Infinity;
  let closestIndex = 0;
  for (let i = 0; i < route.length; i++) {
    const distance = calculateDistance(busLocation, route[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }
  return closestIndex;
};

// Helper 3: Calculate Remaining Distance
const calculateRemainingDistance = (route: Coord[], currentIndex: number, targetIndex: number) => {
  let totalDistance = 0;
  const endIdx = targetIndex > 0 ? targetIndex : route.length - 1;
  for (let i = currentIndex; i < endIdx && i < route.length - 1; i++) {
    totalDistance += calculateDistance(route[i], route[i + 1]);
  }
  return totalDistance;
};

import { useAuth } from '../../src/hooks/useAuth';

const BusProfileScreen = () => {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const { t } = useTranslation();
  const { busId } = useLocalSearchParams<{busId?: string;}>();
  const { user } = useAuth();

  const [activeBusId, setActiveBusId] = useState<string | null>(busId || null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coord[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [assignedStop, setAssignedStop] = useState<any>(null);

  const [busLocation, setBusLocation] = useState<Coord | null>(null);
  const [etaInfo, setEtaInfo] = useState<{distance: string;time: string;} | null>(null);

  const routeGeoJSON = React.useMemo<GeoJSON.FeatureCollection>(() => {
    return {
      type: 'FeatureCollection',
      features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude])
        }
      }]

    };
  }, [routeCoordinates]);

  // Fetch Route Data
  useEffect(() => {
    const fetchRouteData = async () => {
      try {
        if (busId) {
          // Navigated via Admin/Driver portal with explicit bus
          const { data: busData } = await supabase.from('buses').select('route_id').eq('id', busId).single();
          if (busData?.route_id) await loadRouteAndStops(busData.route_id);
        } else if (user) {
          // Authenticated parent or student resolving their own route
          const { data: userData } = await supabase.from('users').select('person_id').eq('id', user.id).single();
          if (!userData?.person_id) return;

          let targetStudentId = null;
          if (user.role === 'student') {
            const { data: std } = await supabase.from('students').select('id').eq('person_id', userData.person_id).single();
            if (std) targetStudentId = std.id;
          } else if (user.role === 'parent') {
            const { data: parent } = await supabase.from('parents').select('id').eq('person_id', userData.person_id).single();
            if (parent) {
              // Assume primary child for parent (can be expanded to select sibling)
              const { data: sp } = await supabase.from('student_parents').select('student_id').eq('parent_id', parent.id).limit(1).single();
              if (sp) targetStudentId = sp.student_id;
            }
          }

          if (targetStudentId) {
            const { data: stData } = await supabase.from('student_transport').
            select('route_id, bus_id, stop_id').
            eq('student_id', targetStudentId).
            eq('is_active', true).
            limit(1).
            single();

            if (stData) {
              setActiveBusId(stData.bus_id);
              await loadRouteAndStops(stData.route_id, stData.stop_id);
            }
          }
        }
      } catch (err) {

      }
    };

    const loadRouteAndStops = async (routeId: string, assignedStopId?: string) => {
      const { data: stopsData } = await supabase.from('transport_stops').
      select('*').
      eq('route_id', routeId).
      order('stop_order', { ascending: true });

      if (stopsData && stopsData.length > 0) {
        const coords = stopsData.map((s) => ({ latitude: Number(s.latitude), longitude: Number(s.longitude) }));
        setRouteCoordinates(coords);
        setStops(stopsData);
        if (assignedStopId) {
          setAssignedStop(stopsData.find((s) => s.id === assignedStopId));
        }
      }
    };

    fetchRouteData();
  }, [user, busId]);

  const handleNewLocation = (lat: number, lon: number, speedVal: number, currentRoute: Coord[], targetStop: any) => {
    setBusLocation({ latitude: lat, longitude: lon });
    if (!currentRoute || currentRoute.length === 0) return;

    const currentIndex = getClosestRouteIndex({ latitude: lat, longitude: lon }, currentRoute);
    let targetIndex = -1;
    if (targetStop) {
      targetIndex = stops.findIndex((s) => s.id === targetStop.id);
    }

    // If bus is past the stop, ETA is 0 or complete
    if (targetIndex !== -1 && currentIndex >= targetIndex) {
      setEtaInfo({ distance: "0.00", time: "0" });
      return;
    }

    const tempRemainingDist = calculateRemainingDistance(currentRoute, currentIndex, targetIndex);
    const remainingDistance = Math.max(0, tempRemainingDist);

    const effectiveSpeed = speedVal && speedVal >= 5 ? speedVal : 25;
    const timeHours = remainingDistance / effectiveSpeed;
    const timeMinutes = Math.round(timeHours * 60);

    setEtaInfo({
      distance: remainingDistance.toFixed(2),
      time: timeMinutes.toString()
    });
  };

  useEffect(() => {
    if (!activeBusId) return;

    const fetchInitialLocation = async () => {
      const { data, error } = await supabase.
      from('bus_locations').
      select('latitude, longitude, speed').
      eq('bus_id', activeBusId).
      order('recorded_at', { ascending: false }).
      limit(1);

      if (!error && data && data.length > 0) {
        handleNewLocation(Number(data[0].latitude), Number(data[0].longitude), Number(data[0].speed), routeCoordinates, assignedStop);
      }
    };

    if (routeCoordinates.length > 0) {
      fetchInitialLocation();
    }

    const channel = supabase.
    channel(`bus_tracking_${activeBusId}`).
    on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bus_locations',
        filter: `bus_id=eq.${activeBusId}`
      },
      (payload) => {
        const newRow = payload.new as any;
        if (newRow && newRow.latitude && newRow.longitude) {
          handleNewLocation(Number(newRow.latitude), Number(newRow.longitude), Number(newRow.speed), routeCoordinates, assignedStop);
        }
      }
    ).
    subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBusId, routeCoordinates, assignedStop]);

  return (
    <ScreenLayout>
      {/* ===== HEADER ===== */}
      <StudentHeader showBackButton={true} title={t('bus.title') || "Bus Map"} />

      {/* ===== MAP CONTENT ===== */}
      <View style={styles.container}>
        <Map
          style={StyleSheet.absoluteFillObject}
          mapStyle={JSON.stringify(OSM_STYLE)}
          logo={false}
          attribution={false}>

          {routeCoordinates.length > 0 ?
          <Camera
            bounds={[
            Math.min(...routeCoordinates.map((c) => c.longitude)) - 0.005,
            Math.min(...routeCoordinates.map((c) => c.latitude)) - 0.005,
            Math.max(...routeCoordinates.map((c) => c.longitude)) + 0.005,
            Math.max(...routeCoordinates.map((c) => c.latitude)) + 0.005]
            } /> :

          <Camera
            initialViewState={{
              center: [77.2090, 28.6139],
              zoom: 13
            }} />

          }

          {/* Route Polyline */}
          {routeCoordinates.length > 1 &&
          <GeoJSONSource id="route-source" data={routeGeoJSON}>
              <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": theme.colors.primary,
                "line-width": 4
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round"
              }} />

            </GeoJSONSource>
          }

          {/* Route Stops */}
          {stops.map((stop) =>
          <Marker key={stop.id} id={`stop-${stop.id}`} lngLat={[Number(stop.longitude), Number(stop.latitude)]}>
              <View style={[styles.stopMarker, assignedStop?.id === stop.id && styles.assignedStopMarker]} />
            </Marker>
          )}

          {/* Live Bus Marker */}
          {busLocation &&
          <Marker
            id="bus-marker"
            lngLat={[busLocation.longitude, busLocation.latitude]}>

              <View style={styles.busMarker}>
                <Text style={styles.busMarkerText}>🚌</Text>
              </View>
            </Marker>
          }
        </Map>

        {/* ===== ETA OVERLAY ===== */}
        {etaInfo &&
        <View style={styles.etaOverlay}>
            <View style={styles.etaPill}>
              <Text style={styles.etaTimeText}>Arriving in {etaInfo.time} mins</Text>
              <Text style={styles.etaSubText}>{etaInfo.distance} km away</Text>
            </View>
          </View>
        }
      </View>
    </ScreenLayout>);

};

export default BusProfileScreen;

/* ============================ STYLES ============================ */
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  busMarker: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  busMarkerText: {
    fontSize: 24
  },
  stopMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.textSecondary,
    borderWidth: 2,
    borderColor: theme.colors.background
  },
  assignedStopMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: theme.colors.background
  },
  etaOverlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    zIndex: 10
  },
  etaPill: {
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
  },
  etaTimeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.textStrong
  },
  etaSubText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginTop: 2
  }
});