function formatFaceValue(cents){
  if(cents == null) return '';
  return cents >= 100
    ? `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`
    : `${cents % 1 ? cents.toFixed(1) : cents}\u00a2`;
}

export function deriveIdentity(cls){
  const variety = cls?.varietyPredictions?.[0];
  const year = variety?.year ?? cls?.yearEstimate;
  return {
    family: variety?.family ?? '',
    category: variety?.category ?? '',
    year: year != null ? String(year) : '',
    faceValue: formatFaceValue(variety?.faceValueCents),
    variety: variety?.label ?? '',
  };
}

// top 5 condidates for each identity field with confidence scores
export function candidateLists(cls, limit = 5){
  const toList = (preds, labelFn) =>
    (preds ?? []).slice(0, limit).map((p) => ({ value: labelFn(p), confidence: p.confidence }));
  return {
    family: toList(cls?.familyPredictions, (p) => p.label),
    category: toList(cls?.categoryPredictions, (p) => p.label),
    variety: toList(cls?.varietyPredictions, (p) => p.label),
    faceValue: toList(cls?.faceValuePredictions, (p) => formatFaceValue(p.label)),
  };
}

export function identityDisplayName(identity, fallback){
  if(!identity) return fallback || 'Unclassified';
  const { year, faceValue, category, family, variety } = identity;
  const head = [year, faceValue, category || family].filter(Boolean).join(' ');
  const withVariety = variety ? `${head} — ${variety}` : head;
  return withVariety.trim() || fallback || 'Unclassified';
}