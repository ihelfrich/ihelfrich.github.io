const DIMENSIONS = ['access', 'control'];

const assertFiniteRubricValue = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  if (value < 0 || value > 100) {
    throw new RangeError(`${label} must be on the 0–100 rubric`);
  }
  return value;
};

const assertInterval = (interval, label, validateValue = assertFiniteRubricValue) => {
  if (!Array.isArray(interval) || interval.length !== 2) {
    throw new TypeError(`${label} must be a two-endpoint interval`);
  }
  const lower = validateValue(interval[0], `${label} lower endpoint`);
  const upper = validateValue(interval[1], `${label} upper endpoint`);
  if (lower > upper) {
    throw new RangeError(`${label} must be nonempty and ordered`);
  }
  return [lower, upper];
};

const assertProfile = (profile, label) => {
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new TypeError(`${label} must be a profile object`);
  }
  return Object.fromEntries(
    DIMENSIONS.map((dimension) => [
      dimension,
      assertInterval(profile[dimension], `${label}.${dimension}`),
    ]),
  );
};

const assertWeight = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  if (value < 0 || value > 1) {
    throw new RangeError(`${label} must be in [0,1]`);
  }
  return value;
};

const cleanFloat = (value) => {
  return Number(value.toPrecision(15));
};

export function profiles(audit = false) {
  return audit
    ? {
        A: { access: [75, 85], control: [30, 40] },
        B: { access: [45, 65], control: [70, 80] },
      }
    : {
        A: { access: [75, 85], control: [25, 45] },
        B: { access: [45, 65], control: [65, 85] },
      };
}

export function ordinal(q) {
  if (typeof q !== 'number' || !Number.isFinite(q)) {
    throw new TypeError('q must be a finite number');
  }
  if (q < 0.25 || q > 4) throw new RangeError('q must be in [0.25,4]');

  const recode = q === 1
    ? (score) => (score - 1) / 3
    : (score) => Math.expm1(q * Math.log(score)) / Math.expm1(q * Math.log(4));
  const values = [recode(1), recode(2), recode(3), recode(4)];
  const profileA = [values[0], values[3]];
  const profileB = [values[1], values[2]];
  const meanA = (profileA[0] + profileA[1]) / 2;
  const meanB = (profileB[0] + profileB[1]) / 2;
  let wins = 0;
  let ties = 0;
  for (const a of profileA) {
    for (const b of profileB) {
      if (a > b) wins += 1;
      else if (a === b) ties += 1;
    }
  }
  return {
    values,
    meanA,
    meanB,
    gap: cleanFloat(meanA - meanB),
    superiority: (wins + ties / 2) / 4,
  };
}

export function compare(A, B, weights) {
  const left = assertProfile(A, 'A');
  const right = assertProfile(B, 'B');
  const [weightLower, weightUpper] = assertInterval(weights, 'weights', assertWeight);

  const differences = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, [
      left[dimension][0] - right[dimension][1],
      left[dimension][1] - right[dimension][0],
    ]]),
  );
  const weightedGap = (accessWeight, endpoint) => (
    accessWeight * differences.access[endpoint]
    + (1 - accessWeight) * differences.control[endpoint]
  );
  const lower = cleanFloat(Math.min(
    weightedGap(weightLower, 0),
    weightedGap(weightUpper, 0),
  ));
  const upper = cleanFloat(Math.max(
    weightedGap(weightLower, 1),
    weightedGap(weightUpper, 1),
  ));

  let status = 'unresolved';
  if (lower > 0) status = 'A';
  else if (upper < 0) status = 'B';
  else if (lower === 0 && upper === 0) status = 'equal';
  else if (lower === 0) status = 'weak-A';
  else if (upper === 0) status = 'weak-B';

  return { lower, upper, status };
}

export function eligibility(interval, floor) {
  const [lower, upper] = assertInterval(interval, 'interval');
  const threshold = assertFiniteRubricValue(floor, 'floor');
  if (lower >= threshold) return 'guaranteed';
  if (upper < threshold) return 'excluded';
  return 'unresolved';
}
