/** Shared validation and route geometry; never place malformed GPS on a map. */
export type Coordinate = { latitude: number; longitude: number };
export function hasMapCoordinate(value: { latitude?: unknown; longitude?: unknown } | null | undefined): value is Coordinate {
  return value != null && typeof value.latitude === 'number' && Number.isFinite(value.latitude)
    && Math.abs(value.latitude) <= 90 && typeof value.longitude === 'number'
    && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
export function fixAgeSeconds(recordedAt: string | null | undefined, now = Date.now()): number | null {
  const time = recordedAt ? Date.parse(recordedAt) : NaN;
  return Number.isFinite(time) && time <= now + 5000 ? Math.max(0, (now - time) / 1000) : null;
}
export function routeFeatures(stops: ({ id: string; status: string; latitude?: number | null; longitude?: number | null })[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  // Missing geometry breaks the line instead of inventing a connection across stops.
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (!hasMapCoordinate(a) || !hasMapCoordinate(b)) continue;
    features.push({ type: 'Feature', properties: { served: ['completed', 'skipped'].includes(b.status) },
      geometry: { type: 'LineString', coordinates: [[a.longitude, a.latitude], [b.longitude, b.latitude]] } });
  }
  return { type: 'FeatureCollection', features };
}

/** Sensor uncertainty footprint, not a geofence or a guaranteed position. */
export function accuracyFeature(center: Coordinate | null, radius: number | null | undefined): GeoJSON.FeatureCollection {
  if (!hasMapCoordinate(center) || typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0 || radius > 10000) return { type: 'FeatureCollection', features: [] };
  const lat = center.latitude * Math.PI / 180;
  const lng = center.longitude * Math.PI / 180;
  const angular = radius / 6371000;
  const ring: number[][] = [];
  for (let i = 0; i <= 48; i++) {
    const bearing = (i % 48) * 2 * Math.PI / 48;
    const phi = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
    const lambda = lng + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(phi));
    ring.push([((lambda * 180 / Math.PI + 540) % 360) - 180, phi * 180 / Math.PI]);
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] };
}
