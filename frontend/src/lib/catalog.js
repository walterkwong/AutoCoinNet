// processing coin catalog and price guide from NGC
import catalogData from '../data/coins.json';
import {GRADE_TIERS} from './grades.js';

const ENTRIES = Array.isArray(catalogData) ? catalogData : (catalogData?.entries ?? []);

function norm(s){
  return(s || '').toLowerCase().replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

const YEAR_TOKEN_RE = /\(?\s*c?\.?\s*(\d{4})\s*\)?/i;
const FACE_VALUE_RE = /\b(\d+[A-Za-z]{1,3})\s+(?:MS|PF|AU|XF|VF|EF|SP)\b/;

// coin feature extraction
export function extractYearToken(name){
  const m = YEAR_TOKEN_RE.exec(name || '');
  return m ? {text: m[0].trim(), year: m[1]} : null;
}
export function extractFaceValueToken(name){
  const m = FACE_VALUE_RE.exec(name || '');
  return m ? {text: m[0], value: m[1].toUpperCase()} : null;
}
function extractVariety(name, category){
  if(!name) return '';
  let rest = name;
  const yearTok = extractYearToken(rest);
  if(yearTok) rest = rest.replace(yearTok.text, ' ');
  const fvTok = extractFaceValueToken(rest);
  if(fvTok) rest = rest.replace(fvTok.text, ' ');
  for (const w of (category || '').split(/\s+/).filter((w) => w.length > 2)){
    rest = rest.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), ' ');
 }
  rest = rest.replace(/\bMS\b/g, ' ').replace(/['"]/g, '').replace(/\s+/g, ' ').trim();
  return rest;
}

// precompute for efficient lookups
const ENRICHED = ENTRIES.map((e) => {
  const yearTok = extractYearToken(e.name);
  const fvTok = extractFaceValueToken(e.name);
  return {
    ...e,
    year: yearTok?.year ?? '',
    faceValue: fvTok?.value ?? '',
    variety: extractVariety(e.name, e.category),
 };
});

export function getFamilies(){
  return [...new Set(ENRICHED.map((e) => e.big_family).filter(Boolean))].sort();
}
export function getCategories(family){
  const pool = family ? ENRICHED.filter((e) => norm(e.big_family) === norm(family)) : ENRICHED;
  return [...new Set(pool.map((e) => e.category).filter(Boolean))].sort();
}
function entriesForCategory(category, family){
  if(category) return ENRICHED.filter((e) => norm(e.category) === norm(category));
  if(family) return ENRICHED.filter((e) => norm(e.big_family) === norm(family));
  return ENRICHED;
}
export function getYearsForCategory(category, family){
  return [...new Set(entriesForCategory(category, family).map((e) => e.year).filter(Boolean))].sort();
}
export function getFaceValuesForCategory(category, family){
  return [...new Set(entriesForCategory(category, family).map((e) => e.faceValue).filter(Boolean))];
}
export function getVarietiesForCategory(category, family){
  return [...new Set(entriesForCategory(category, family).map((e) => e.variety).filter(Boolean))];
}

export function bestFaceValueGuess(category){
  const values = getFaceValuesForCategory(category);
  return values.length === 1 ? values[0] : '';
}

export function bestVarietyGuess(){
  return '';
}

// match face value without converting currency
// "₵" and "C" more specifically, I just treated them the same for simplicity
const FACE_VALUE_MAGNITUDE_RE = /(\d+(?:\.\d+)?)/;
function faceValueMagnitude(v){
  const m = FACE_VALUE_MAGNITUDE_RE.exec(v || '');
  return m ? m[1] : null;
}
function sameFaceValue(a, b){
  const ma = faceValueMagnitude(a);
  const mb = faceValueMagnitude(b);
  return ma != null && ma === mb;
}

// find best reference match
// exact variety match > face value + year match > face value match > year match > first entry in family
export function findBestMatch({ family, category, faceValue, variety, year } = {}){
  const pool = entriesForCategory(category, family);
  if(pool.length === 0) return null;
  const targetYear = norm(year);
  const targetVariety = norm(variety);
  let bestEntry = pool[0];
  let maxScore = -1;
  for (const entry of pool){
    let score = 0;
    const entryVariety = norm(entry.variety);

    if(targetVariety && entryVariety && (entryVariety.includes(targetVariety) || targetVariety.includes(entryVariety))){
      score += 100;
    }
    if(faceValue && sameFaceValue(entry.faceValue, faceValue)){
      score += 20;
    }
    if(targetYear && norm(entry.year) === targetYear){
      score += 10;
    }
    if(score > maxScore){
      maxScore = score;
      bestEntry = entry;
      if(score === 130) break; // perfect match
    }
  }
  return bestEntry;
}

export function searchCatalog({family, category} = {}){
  return entriesForCategory(category, family);
}

// NGC recommended price
const TIER_TO_BUCKET = {PO: 'PrAg', FR: 'PrAg', AG: 'PrAg', G: 'G', VG: 'VG', F: 'F', VF: 'VF', EF: 'XF'};
const LETTER_CENTER = {PrAg: 2, G: 5.5, VG: 9.5, F: 15.5, VF: 29.5, XF: 42.5};

// find the nearest tier for a given grade
function nearestTier(grade){
  let best = GRADE_TIERS[0];
  for (const t of GRADE_TIERS){
    if(Math.abs(t[0] - grade) < Math.abs(best[0] - grade)) best = t;
 }
  return best;
}

export function gradeBucketKey(grade, priceGuide){
  if(grade == null) return null;
  const [num, label] = nearestTier(grade);
  const letter = label.split('-')[0];
  if(letter === 'AU' || letter === 'MS'){
    return priceGuide && priceGuide[String(num)] != null ? String(num) : null;
 }
  return TIER_TO_BUCKET[letter] ?? null;
}

export function getRecommendedPrice(entry, grade){
  if(!entry?.price_guide || grade == null) return null;
  const guide = entry.price_guide;
  const directKey = gradeBucketKey(grade, guide);
  if(directKey && guide[directKey] != null) return {key: directKey, price: guide[directKey]};
  let best = null, bestDist = Infinity;
  for (const key of Object.keys(guide)){
    const center = LETTER_CENTER[key] ?? parseFloat(key);
    if(Number.isNaN(center)) continue;
    const dist = Math.abs(center - grade);
    if(dist < bestDist){bestDist = dist; best = key;}
 }
  return best ? {key: best, price: guide[best]} : null;
}