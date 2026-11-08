/** Scalloped edge of the Kinproof seal as a closed SVG path (64x64 grid): 22 gentle scallops on a 29-unit radius. */
export const SEAL_EDGE = (() => {
  const pts: string[] = [];
  const N = 180;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = 29 + 1.5 * Math.cos(t * 22);
    pts.push(`${i ? "L" : "M"}${(32 + r * Math.cos(t)).toFixed(2)} ${(32 + r * Math.sin(t)).toFixed(2)}`);
  }
  return pts.join("") + "Z";
})();
