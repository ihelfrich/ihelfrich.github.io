import { vectorNorms, similarityField, contrastField, fieldSummary, separatedMatches } from './coastal-math.mjs';
let vectors, valid, norms, dimensions, width, spacing;
self.onmessage = ({data}) => {
  try {
    if (data.type === 'init') {
      ({vectors, valid, dimensions, width, spacing} = data);
      norms = vectorNorms(vectors, dimensions, valid);
      self.postMessage({type: 'ready'});
      return;
    }
    if (data.type !== 'query') return;
    const a = similarityField(vectors, norms, dimensions, data.anchorA);
    const b = data.anchorB == null ? null : similarityField(vectors, norms, dimensions, data.anchorB);
    const scores = b ? contrastField(a, b) : a;
    const summary = fieldSummary(a, data.threshold);
    const matches = separatedMatches(a, width, spacing, data.anchorA);
    self.postMessage({type: 'result', id: data.id, scores, similarityA: a, similarityB: b, summary, matches},
      b ? [scores.buffer, a.buffer, b.buffer] : [scores.buffer]);
  } catch (error) { self.postMessage({type: 'error', message: error.message}); }
};
