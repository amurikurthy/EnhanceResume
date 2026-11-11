// The circuit-style accents are polylines; no two traces may cross or touch (net nodes may share endpoints).
const test = require('node:test');
const assert = require('node:assert');
const { GEOMETRY } = require('../shared/render');

const eq = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const orient = (a, b, c) => { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : -1; };
const onSeg = (a, b, c) => Math.min(a[0], b[0]) - 1e-9 <= c[0] && c[0] <= Math.max(a[0], b[0]) + 1e-9 && Math.min(a[1], b[1]) - 1e-9 <= c[1] && c[1] <= Math.max(a[1], b[1]) + 1e-9;
const segs = (pts) => pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]);

/* 'none' | 'endpoint' (meet only at one shared endpoint) | 'cross' (crossing, T-junction, or overlapping) */
function relate([a, b], [c, d]) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  let hit = o1 !== o2 && o3 !== o4;
  if ((o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) || (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b))) hit = true;
  if (!hit) return 'none';
  const shared = [[a, c], [a, d], [b, c], [b, d]].filter(([p, q]) => eq(p, q)).length;
  if (shared !== 1) return 'cross';
  if (o1 === 0 && o2 === 0) { // collinear: only fine if they just touch end to end
    const overlap = [c, d].some((p) => !eq(p, a) && !eq(p, b) && onSeg(a, b, p)) || [a, b].some((p) => !eq(p, c) && !eq(p, d) && onSeg(c, d, p));
    return overlap ? 'cross' : 'endpoint';
  }
  return 'endpoint';
}
function problems(lines, { allowSharedEndpoints }) {
  const flat = lines.flatMap((pts, i) => segs(pts).map((s, k) => ({ s, i, k })));
  const bad = [];
  for (let x = 0; x < flat.length; x++) for (let y = x + 1; y < flat.length; y++) {
    const A = flat[x], B = flat[y], r = relate(A.s, B.s);
    if (r === 'none') continue;
    if (r === 'endpoint' && A.i === B.i && B.k === A.k + 1) continue; // consecutive segments of one trace
    if (r === 'endpoint' && A.i !== B.i && allowSharedEndpoints) continue;
    bad.push(`lines ${A.i}/${B.i}: ${JSON.stringify(A.s)} vs ${JSON.stringify(B.s)} (${r})`);
  }
  return bad;
}

test('corner traces accent: no trace crosses or touches another', () => {
  assert.deepEqual(problems(GEOMETRY.traces.map((t) => t.pts), { allowSharedEndpoints: false }), []);
});
test('circuit tile: no crossings, including with the 8 neighbouring tiles it repeats into', () => {
  const t = GEOMETRY.circuitTile, all = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) t.lines.forEach((l) => all.push(l.pts.map(([x, y]) => [x + dx * t.size, y + dy * t.size])));
  assert.deepEqual(problems(all, { allowSharedEndpoints: true }), []);
});
test('circuit network accent: edges only meet at shared nodes', () => {
  assert.deepEqual(problems(GEOMETRY.netcircuit.edges.map((e) => e.pts), { allowSharedEndpoints: true }), []);
  // every shared endpoint must be a declared node
  const nodes = GEOMETRY.netcircuit.nodes.map(([x, y]) => [x, y]);
  const ends = GEOMETRY.netcircuit.edges.flatMap((e) => [e.pts[0], e.pts[e.pts.length - 1]]);
  ends.forEach((p, i) => { if (ends.some((q, j) => j !== i && eq(p, q))) assert.ok(nodes.some((n) => eq(n, p)), `junction ${p} is not a node`); });
});
test('the checker itself detects a crossing', () => {
  assert.ok(problems([[[0, 0], [10, 10]], [[0, 10], [10, 0]]], { allowSharedEndpoints: true }).length > 0);
  assert.ok(problems([[[0, 0], [10, 0]], [[5, 0], [5, 8]]], { allowSharedEndpoints: true }).length > 0, 'T-junction');
});
