// Keep persistent writes in invocation order, even when opening storage is asynchronous.
export function createTaskQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}
// Bound simultaneous image decodes while preserving source order.
export async function mapConcurrent<T, R>(
  values: readonly T[],
  limit: number,
  transform: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error("Invalid concurrency limit");
  const result = new Array<R>(values.length);
  let cursor = 0;
  let failure: { error: unknown } | undefined;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (!failure && cursor < values.length) {
        const index = cursor++;
        try {
          result[index] = await transform(values[index], index);
        } catch (error) {
          failure ??= { error };
        }
      }
    }),
  );
  if (failure) throw failure.error;
  return result;
}
