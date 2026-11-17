/** Maps `list` through `fn` with at most `limit` calls in flight; results keep the input order. */
export async function mapPool(list, limit, fn) {
  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      results[i] = await fn(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, worker));
  return results;
}

export const DEFAULT_PANEL_CONCURRENCY = 8;
