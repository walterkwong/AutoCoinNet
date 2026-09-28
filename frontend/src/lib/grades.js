// Standard Sheldon-scale grade labels
export const GRADE_TIERS = [
  [1, 'PO-1'], [2, 'FR-2'], [3, 'AG-3'], [4, 'G-4'], [6, 'G-6'],
  [8, 'VG-8'], [10, 'VG-10'], [12, 'F-12'], [15, 'F-15'],
  [20, 'VF-20'], [25, 'VF-25'], [30, 'VF-30'], [35, 'VF-35'],
  [40, 'EF-40'], [45, 'EF-45'], [50, 'AU-50'], [53, 'AU-53'], [55, 'AU-55'], [58, 'AU-58'],
  [60, 'MS-60'], [61, 'MS-61'], [62, 'MS-62'], [63, 'MS-63'], [64, 'MS-64'], [65, 'MS-65'],
  [66, 'MS-66'], [67, 'MS-67'], [68, 'MS-68'], [69, 'MS-69'], [70, 'MS-70'],
];

export function formatGrade(n){
  let best = GRADE_TIERS[0];
  for (const t of GRADE_TIERS){
    if(Math.abs(t[0] - n) < Math.abs(best[0] - n)) best = t;
 }
  return best[1];
}

const LETTER_TIER_CENTER = {
  PR: 1, PO: 1, FR: 2, AG: 3, PRAG: 2,
  G: 5.5, VG: 9.5, F: 15.5, VF: 29.5, XF: 42.5, EF: 42.5,
  AU: 51.5, MS: 65, PF: 65, SP: 65,
};

export function parseGradeValue(grade){
  if(grade == null || grade === '') return null;
  const str = String(grade).trim();
  if(/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
  const key = str.toUpperCase().replace(/[^A-Z]/g, '');
  return LETTER_TIER_CENTER[key] ?? null;
}