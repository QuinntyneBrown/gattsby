export function sequenceCounter(values: readonly number[]) {
  const counts = new Map<number, number>();
  let step = 0;
  let matches = 0;
  for (let index = 1; index < values.length; index++) {
    const delta = (values[index] - values[index - 1] + 256) & 0xff;
    if (!delta) continue;
    const count = (counts.get(delta) ?? 0) + 1;
    counts.set(delta, count);
    if (count > matches) {
      matches = count;
      step = delta;
    }
  }
  const share = values.length > 1 ? matches / (values.length - 1) : 0;
  return step && share >= 0.9 ? { step, share } : undefined;
}
