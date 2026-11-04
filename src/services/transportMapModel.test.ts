import { fixAgeSeconds, hasMapCoordinate, routeFeatures } from './transportMapModel';
it('rejects missing, coerced, non-finite and out of range coordinates', () => {
  for (const value of [null, { latitude: null, longitude: 78 }, { latitude: '17', longitude: 78 }, { latitude: NaN, longitude: 78 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }]) expect(hasMapCoordinate(value)).toBe(false);
  expect(hasMapCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
});
it('ages observations locally and rejects invalid or future timestamps', () => {
  const now = Date.parse('2026-11-03T03:00:00Z');
  expect(fixAgeSeconds('2026-11-03T02:59:30Z', now)).toBe(30);
  expect(fixAgeSeconds('2026-11-03T03:00:06Z', now)).toBeNull();
  expect(fixAgeSeconds('invalid', now)).toBeNull();
});
it('breaks route lines across missing geometry and distinguishes completed sections', () => {
  const stop = (id: string, latitude: number | null, status = 'pending') => ({ id, latitude, longitude: 78, status });
  const result = routeFeatures([stop('a', 17), stop('b', 18, 'completed'), stop('c', null), stop('d', 20), stop('e', 21)]);
  expect(result.features).toHaveLength(2);
  expect(result.features[0].properties?.served).toBe(true);
  expect(result.features[1].properties?.served).toBe(false);
});

it('renders a closed geographic accuracy footprint only for a usable radius', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { accuracyFeature } = require('./transportMapModel');
  const polygon = accuracyFeature({ latitude: 17, longitude: 78 }, 10).features[0].geometry;
  expect(polygon.coordinates[0]).toHaveLength(49);
  expect(polygon.coordinates[0][0]).toEqual(polygon.coordinates[0][48]);
  expect(polygon.coordinates[0][0][1]).toBeCloseTo(17.00008993, 6);
  for (const radius of [null, -1, NaN, Infinity]) expect(accuracyFeature({ latitude: 17, longitude: 78 }, radius).features).toHaveLength(0);
});
