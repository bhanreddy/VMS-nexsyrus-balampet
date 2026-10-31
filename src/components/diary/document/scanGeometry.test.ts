import { runInNewContext, Script } from 'node:vm';
import { scanGeometryScript } from './scanGeometry';
import { buildScannerHtml } from './scannerHtml';

const geometry = runInNewContext(`${scanGeometryScript};({ validScanCorners, scanProjectiveMap, scanOutputSize })`);
const full = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

it('rejects crossed, concave, tiny and non-finite crop regions', () => {
  expect(geometry.validScanCorners(full)).toBe(true);
  expect(geometry.validScanCorners([full[0], full[2], full[1], full[3]])).toBe(false);
  expect(geometry.validScanCorners([full[0], full[1], { x: .2, y: .2 }, full[3]])).toBe(false);
  expect(geometry.validScanCorners(full.map((p) => ({ x: p.x * .01, y: p.y * .01 })))).toBe(false);
  expect(geometry.validScanCorners([{ x: NaN, y: 0 }, ...full.slice(1)])).toBe(false);
});

it.each([
  full,
  [{ x: .2, y: .05 }, { x: .9, y: .2 }, { x: .8, y: .95 }, { x: .03, y: .8 }],
  [{ x: .3, y: .1 }, { x: .6, y: .1 }, { x: .95, y: .9 }, { x: .05, y: .9 }],
])('maps every output corner precisely back to its source edge', (...points) => {
  const p = points as { x: number; y: number }[];
  const m = geometry.scanProjectiveMap(p);
  full.forEach((unit, index) => {
    const z = m[6] * unit.x + m[7] * unit.y + 1;
    expect((m[0] * unit.x + m[1] * unit.y + m[2]) / z).toBeCloseTo(p[index].x, 10);
    expect((m[3] * unit.x + m[4] * unit.y + m[5]) / z).toBeCloseTo(p[index].y, 10);
  });
});

it('caps output size without upscaling smaller originals', () => {
  expect(geometry.scanOutputSize(full, 4000, 6000, 2400)).toEqual({ width: 1600, height: 2400 });
  expect(geometry.scanOutputSize(full, 800, 1200, 2400)).toEqual({ width: 800, height: 1200 });
  expect(geometry.scanOutputSize(full, 3000, 1000, 1600)).toEqual({ width: 1600, height: 533 });
});

it('embeds valid static JavaScript and escapes script delimiters in image input', () => {
  const html = buildScannerHtml('data:image/jpeg;base64,abc</script>');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeTruthy();
  expect(() => new Script(script!)).not.toThrow();
  expect(html.match(/<\/script>/g)).toHaveLength(1);
});
