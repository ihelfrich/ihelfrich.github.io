/*
 * Every table here is synthetic, constructed for these exercises. None
 * describes real villages.
 *
 * Grouped table: 170 villages in seven population bins of width 50, starting
 * at 100 people. The counts are skewed to the right, so the grouped mean
 * (about 252.6) sits above the interpolated median (about 244.3).
 */
export const groupedCounts = [14, 32, 44, 36, 22, 14, 8];
export const groupedStart = 100;
export const groupedWidth = 50;

/*
 * Frequency table: 200 villages, one of them a town of 5,000. The count is
 * even, so the median averages positions 100 and 101, and both hold 500
 * people. Most villages are small, so the mean (477) stays below the median
 * despite the long right tail.
 */
export const villageValues = [100, 200, 300, 400, 500, 600, 700, 800, 5000];
export const villageFrequencies = [10, 24, 30, 26, 44, 34, 20, 11, 1];
export const largestVillage = villageValues[villageValues.length - 1];
export const largestVillageFloor = villageValues[villageValues.length - 2];
export const villageCount = villageFrequencies.reduce((a, b) => a + b, 0);
export function villageData(outlier = largestVillage) {
  const last = villageValues.length - 1;
  return villageValues.flatMap((v, i) =>
    Array(villageFrequencies[i]).fill(i === last ? outlier : v),
  );
}
export function summarize(values) {
  const n = values.length;
  if (!n)
    return {
      n: 0,
      total: 0,
      mean: null,
      median: null,
      variance: null,
      sd: null,
      modes: [],
    };
  const total = values.reduce((a, b) => a + b, 0),
    mean = total / n,
    sorted = [...values].sort((a, b) => a - b),
    median =
      n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const max = Math.max(...counts.values());
  return {
    n,
    total,
    mean,
    median,
    variance,
    sd: Math.sqrt(variance),
    modes: [...counts]
      .filter(([, v]) => v === max)
      .map(([k]) => k)
      .sort((a, b) => a - b),
  };
}
export function groupedSummary(counts, start, width) {
  const n = counts.reduce((a, b) => a + b, 0);
  if (!n)
    return {
      n: 0,
      mean: null,
      median: null,
      variance: null,
      sd: null,
      medianBin: null,
      modalBins: [],
    };
  const mids = counts.map((_, i) => start + (i + 0.5) * width),
    mean = counts.reduce((a, f, i) => a + f * mids[i], 0) / n,
    variance = counts.reduce((a, f, i) => a + f * (mids[i] - mean) ** 2, 0) / n;
  let cumulative = 0,
    index = 0;
  for (; index < counts.length; index++) {
    if (counts[index] > 0 && cumulative + counts[index] >= n / 2) break;
    cumulative += counts[index];
  }
  const lower = start + index * width,
    median = lower + ((n / 2 - cumulative) / counts[index]) * width,
    max = Math.max(...counts);
  return {
    n,
    mean,
    variance,
    sd: Math.sqrt(variance),
    median,
    medianBin: [lower, lower + width],
    modalBins: counts.flatMap((f, i) =>
      f === max ? [[start + i * width, start + (i + 1) * width]] : [],
    ),
  };
}
export function simpsonRates(aEasy, bEasy) {
  return {
    a: 0.8 * aEasy + 0.1 * (100 - aEasy),
    b: 0.9 * bEasy + 0.2 * (100 - bEasy),
  };
}
