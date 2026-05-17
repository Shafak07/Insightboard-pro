/** Downsample chart rows for rendering performance (virtualization-lite). */

export function downsampleRows<T extends Record<string, unknown>>(
  rows: T[],
  maxPoints = 1000
): T[] {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, i) => i % step === 0);
}
