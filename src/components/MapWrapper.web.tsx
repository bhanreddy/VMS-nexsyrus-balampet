/** Web counterpart to the small MapLibre Native surface used by transport. */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import maplibregl, { type GeoJSONSource as WebSource, type LayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MapContext = createContext<maplibregl.Map | null>(null);
const SourceContext = createContext<string | null>(null);
type Children = { children?: React.ReactNode };

export function Map({ children, style, mapStyle, onRegionWillChange, attribution = true }: Children & {
  style?: StyleProp<ViewStyle>; mapStyle: string;
  logo?: boolean; attribution?: boolean;
  onRegionWillChange?: (event: { nativeEvent: { userInteraction: boolean } }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [tileError, setTileError] = useState(false);
  const interaction = useRef(onRegionWillChange);
  interaction.current = onRegionWillChange;
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({ container: container.current, style: JSON.parse(mapStyle),
        center: [78.48, 17.38], zoom: 10, attributionControl: false });
    } catch { setFailed(true); return; }
    if (attribution) instance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('error', () => setTileError(true));
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.on('load', () => setMap(instance));
    instance.on('movestart', event => {
      if (event.originalEvent) interaction.current?.({ nativeEvent: { userInteraction: true } });
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); };
  }, [mapStyle, attribution]);
  return <View style={[style, { overflow: 'hidden' }]}>
    <div ref={container} style={{ position: 'absolute', inset: 0 }} aria-label="Bus route map" />
    {failed && <View style={styles.error}><Text>Map unavailable in this browser. Use the stop timeline to follow the trip.</Text></View>}
    {tileError && !failed && <View pointerEvents="none" style={styles.tileWarning}><Text style={{ fontSize: 11, color: '#92400E' }}>Map imagery may be unavailable. Use the stop timeline for updates.</Text></View>}
    <MapContext.Provider value={map}>{map && children}</MapContext.Provider>
  </View>;
}

export function Camera({ center, bounds, zoom, duration = 650, padding }: {
  center?: number[]; bounds?: number[]; zoom?: number; duration?: number; easing?: string;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}) {
  const map = useContext(MapContext);
  const [lng, lat] = center || [];
  const [west, south, east, north] = bounds || [];
  const { top = 64, right = 56, bottom = 56, left = 40 } = padding || {};
  useEffect(() => {
    if (!map) return;
    if (lng != null && lat != null) map.easeTo({ center: [lng, lat], zoom, duration });
    else if (west != null) map.fitBounds([[west, south], [east, north]], {
      padding: { top, right, bottom, left }, maxZoom: 16, duration,
    });
  }, [map, lng, lat, west, south, east, north, zoom, duration, top, right, bottom, left]);
  return null;
}

export function GeoJSONSource({ id, data, children }: Children & { id: string; data: GeoJSON.GeoJSON }) {
  const map = useContext(MapContext);
  const [ready, setReady] = useState(false);
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    if (!map) return;
    map.addSource(id, { type: 'geojson', data: latest.current });
    setReady(true);
    return () => {
      if (!map.getStyle()) return;
      for (const layer of map.getStyle().layers || []) {
        if ('source' in layer && layer.source === id) map.removeLayer(layer.id);
      }
      if (map.getSource(id)) map.removeSource(id);
    };
  }, [map, id]);
  useEffect(() => { (map?.getSource(id) as WebSource | undefined)?.setData(data); }, [map, id, data]);
  return <SourceContext.Provider value={id}>{ready && children}</SourceContext.Provider>;
}

export function Layer(props: { id: string; type: string; paint?: object; layout?: object }) {
  const map = useContext(MapContext);
  const source = useContext(SourceContext);
  const definition = JSON.stringify(props);
  useEffect(() => {
    if (!map || !source) return;
    const layer = JSON.parse(definition);
    map.addLayer({ ...layer, source } as LayerSpecification);
    return () => { if (map.getStyle() && map.getLayer(layer.id)) map.removeLayer(layer.id); };
  }, [map, source, definition]);
  return null;
}

export function Marker({ lngLat, children, id }: Children & { id: string; lngLat: number[] }) {
  const map = useContext(MapContext);
  const [element] = useState(() => document.createElement('div'));
  const marker = useRef<maplibregl.Marker | null>(null);
  const [lng, lat] = lngLat;
  useEffect(() => {
    if (!map) return;
    element.setAttribute('data-marker-id', id);
    marker.current = new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(map);
    return () => { marker.current?.remove(); marker.current = null; };
    // Coordinates update in place so each GPS packet preserves marker identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, element, id]);
  useEffect(() => {
    const activeMarker = marker.current;
    if (!activeMarker) return;
    if (!id.includes('bus-marker')) { activeMarker.setLngLat([lng, lat]); return; }
    const from = activeMarker.getLngLat();
    const deltaLng = ((lng - from.lng + 540) % 360) - 180;
    const start = performance.now();
    let frame: number;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / 850);
      activeMarker.setLngLat([from.lng + deltaLng * progress, from.lat + (lat - from.lat) * progress]);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [lng, lat, id]);
  return createPortal(children, element);
}
const styles = StyleSheet.create({ tileWarning: { position: 'absolute', top: 60, left: 12, right: 60, padding: 8, borderRadius: 8, backgroundColor: '#FFFBEB' }, error: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' } });
