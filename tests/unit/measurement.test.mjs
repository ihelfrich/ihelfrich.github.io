import assert from 'node:assert/strict';
import test from 'node:test';

import { compare, eligibility, ordinal, profiles } from '../../src/lib/measurement.mjs';

const close = (actual, expected, tolerance = 1e-12) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('profiles expose the declared synthetic scenario boxes without shared mutable state', () => {
  const base = profiles();
  assert.deepEqual(base, {
    A: { access: [75, 85], control: [25, 45] },
    B: { access: [45, 65], control: [65, 85] },
  });
  assert.deepEqual(profiles(true), {
    A: { access: [75, 85], control: [30, 40] },
    B: { access: [45, 65], control: [70, 80] },
  });
  base.A.access[0] = 0;
  assert.equal(profiles().A.access[0], 75);
});

test('anchored ordinal recoding returns categories 1 through 4 in natural order', () => {
  const result = ordinal(1);
  assert.deepEqual(result.values, [0, 1 / 3, 2 / 3, 1]);
  assert.equal(result.meanA, 0.5);
  assert.equal(result.meanB, 0.5);
  assert.equal(result.gap, 0);
  assert.equal(result.superiority, 0.5);
});

test('admissible recodings reverse the ordinal mean gap while preserving superiority', () => {
  const concave = ordinal(0.5);
  const linear = ordinal(1);
  const convex = ordinal(2);
  assert.ok(concave.gap < 0);
  assert.equal(linear.gap, 0);
  assert.ok(convex.gap > 0);
  close(concave.gap, (3 - Math.sqrt(2) - Math.sqrt(3)) / 2);
  close(convex.gap, 2 / 15);
  assert.deepEqual(
    [concave.superiority, linear.superiority, convex.superiority],
    [0.5, 0.5, 0.5],
  );
});

test('ordinal recoding preserves anchors and strict order across its allowed range', () => {
  for (const q of [0.25, 0.5, 1, 2, 4]) {
    const { values } = ordinal(q);
    assert.equal(values[0], 0);
    assert.equal(values[3], 1);
    assert.ok(values[0] < values[1]);
    assert.ok(values[1] < values[2]);
    assert.ok(values[2] < values[3]);
  }
});

test('comparison reproduces the four declared profile and audit fixtures', () => {
  const base = profiles();
  const audit = profiles(true);
  assert.deepEqual(compare(base.A, base.B, [0.5, 0.5]), {
    lower: -25,
    upper: 10,
    status: 'unresolved',
  });
  assert.deepEqual(compare(base.A, base.B, [0.9, 0.9]), {
    lower: 3,
    upper: 34,
    status: 'A',
  });
  assert.deepEqual(compare(base.A, base.B, [0.1, 0.1]), {
    lower: -53,
    upper: -14,
    status: 'B',
  });
  assert.deepEqual(compare(audit.A, audit.B, [0.5, 0.5]), {
    lower: -20,
    upper: 5,
    status: 'unresolved',
  });
});

test('comparison checks both weight endpoints when an affine corner has negative slope', () => {
  const A = { access: [0, 0], control: [10, 10] };
  const B = { access: [2, 8], control: [3, 7] };
  assert.deepEqual(compare(A, B, [0.2, 0.8]), {
    lower: -5.8,
    upper: 5.2,
    status: 'unresolved',
  });
});

test('comparison distinguishes strict, weak, equal, and unresolved states', () => {
  const point = (access, control = access) => ({ access: [access, access], control: [control, control] });
  assert.equal(compare(point(2), point(1), [0, 1]).status, 'A');
  assert.equal(compare(point(1), point(2), [0, 1]).status, 'B');
  assert.equal(
    compare({ access: [1, 2], control: [1, 2] }, point(1), [0, 1]).status,
    'weak-A',
  );
  assert.equal(
    compare(point(1), { access: [1, 2], control: [1, 2] }, [0, 1]).status,
    'weak-B',
  );
  assert.equal(compare(point(1), point(1), [0, 1]).status, 'equal');
  assert.equal(
    compare({ access: [0, 2], control: [0, 2] }, point(1), [0, 1]).status,
    'unresolved',
  );
});

test('narrowing profile boxes cannot widen comparison bounds on a fixed weight grid', () => {
  const base = profiles();
  const audit = profiles(true);
  for (let tenth = 0; tenth <= 10; tenth += 1) {
    const weight = tenth / 10;
    const broad = compare(base.A, base.B, [weight, weight]);
    const narrow = compare(audit.A, audit.B, [weight, weight]);
    assert.ok(narrow.lower >= broad.lower, `lower widened at ${weight}`);
    assert.ok(narrow.upper <= broad.upper, `upper widened at ${weight}`);
  }
});

test('comparison rejects malformed profiles and weight domains', () => {
  const valid = profiles();
  const badProfiles = [
    null,
    {},
    { access: [0], control: [0, 1] },
    { access: [2, 1], control: [0, 1] },
    { access: [-1, 1], control: [0, 1] },
    { access: [0, 101], control: [0, 1] },
    { access: [0, Infinity], control: [0, 1] },
    { access: [0, 1], control: ['0', 1] },
  ];
  for (const candidate of badProfiles) {
    assert.throws(() => compare(candidate, valid.B, [0.5, 0.5]));
    assert.throws(() => compare(valid.A, candidate, [0.5, 0.5]));
  }
  for (const weights of [null, [], [0.5], [0.5, 0.5, 0.5], [-0.1, 0.5], [0.5, 1.1], [0.8, 0.2], [NaN, 0.5], ['0.5', 0.5]]) {
    assert.throws(() => compare(valid.A, valid.B, weights));
  }
});

test('ordinal rejects q outside the finite closed domain', () => {
  for (const q of [0, 0.249, 4.001, NaN, Infinity, '1', null]) {
    assert.throws(() => ordinal(q));
  }
});

test('eligibility implements a weak floor and preserves unresolved feasibility', () => {
  assert.equal(eligibility([50, 70], 50), 'guaranteed');
  assert.equal(eligibility([20, 49.999], 50), 'excluded');
  assert.equal(eligibility([20, 50], 50), 'unresolved');
  assert.equal(eligibility([49.999, 70], 50), 'unresolved');
});

test('eligibility rejects empty, malformed, nonfinite, and out-of-rubric domains', () => {
  for (const interval of [null, [], [0], [0, 1, 2], [2, 1], [-1, 1], [0, 101], [0, NaN], ['0', 1]]) {
    assert.throws(() => eligibility(interval, 50));
  }
  for (const floor of [-1, 101, NaN, Infinity, '50', null]) {
    assert.throws(() => eligibility([0, 100], floor));
  }
});
