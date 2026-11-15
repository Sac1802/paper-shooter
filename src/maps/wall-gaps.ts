import type { WallGap, WallPiece } from './map-contracts.js';
// Wall pieces along an axis with rectangular gaps [a1, a2, yBottom = 0, yTop = h]; gaps may overlap.
export function wallPieces(a1: number, a2: number, h: number, gaps: readonly WallGap[]) {
  const xs = new Set([a1, a2]);
  for (const g of gaps) {
    xs.add(Math.min(Math.max(g[0], a1), a2));
    xs.add(Math.min(Math.max(g[1], a1), a2));
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const runs = new Map<string, WallPiece>();
  const out: WallPiece[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s1 = sorted[i],
      s2 = sorted[i + 1];
    if (s2 - s1 < 0.005) continue;
    const mid = (s1 + s2) / 2;
    const cuts = gaps
      .filter((g) => g[0] <= mid && g[1] >= mid)
      .map((g) => [g[2] ?? 0, g[3] ?? h])
      .sort((a, b) => a[0] - b[0]);
    const pieces = [];
    let y = 0;
    for (const [gb, gt] of cuts) {
      if (gb > y + 0.005) pieces.push([y, gb]);
      y = Math.max(y, gt);
    }
    if (y < h - 0.005) pieces.push([y, h]);
    const keys = new Set();
    for (const [yb, yt] of pieces) {
      const k = yb.toFixed(3) + ',' + yt.toFixed(3);
      keys.add(k);
      const r = runs.get(k);
      if (r && Math.abs(r[1] - s1) < 0.005) r[1] = s2;
      else runs.set(k, [s1, s2, yb, yt]);
    }
    for (const [k, r] of [...runs])
      if (!keys.has(k)) {
        out.push(r);
        runs.delete(k);
      }
  }
  for (const r of runs.values()) out.push(r);
  return out;
}
