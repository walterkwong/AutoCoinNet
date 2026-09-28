import {useEffect, useState} from 'react';
import {parseGradeValue} from './grades.js';
import {extractYearToken, extractFaceValueToken, findBestMatch} from './catalog.js';
import {API_BASE} from '../api.js';

export const AUCTION_HOUSES = {
  HA: 'Heritage Auctions',
  SB: "Stack's Bowers",
  GC: 'GreatCollections',
  ANACS: 'ANACS',
  NGC: 'NGC',
  PCGS: 'PCGS',
};

function auctionHouseName(code){
  if(!code) return 'Unknown venue';
  return AUCTION_HOUSES[code.toUpperCase()] ?? code;
}

function normalize(str){
  return(str || '')
    .toLowerCase()
    .replace(/&amp;/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// reformat dates (MM/DD/YYYY or M/D/YY -> YYYY-MM-DD)
function toIsoDate(mdy){
  if(!mdy) return null;
  const [m, d, yRaw] = mdy.split('/').map((n) => parseInt(n, 10));
  if(!m || !d || yRaw == null) return null;
  const y = yRaw < 100 ? (yRaw <= 49 ? 2000 + yRaw : 1900 + yRaw) : yRaw;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parsePrice(r){
  if(typeof r.price === 'number') return r.price;
  const raw = r.price_raw;
  if(typeof raw === 'number') return raw;
  if(typeof raw === 'string') return parseFloat(raw.replace(/[^0-9.]/g, ''));
  return NaN;
}

function normalizeRecord(r){
  return {
    family: r.big_family,
    category: r.category,
    coinName: r.name,
    coinUrl: r.coin_url || null,
    date: toIsoDate(r.date),
    grade: r.grade,
    grader: r.grader,
    price: parsePrice(r),
    lotNumber: r.lot_number,
    auctionHouseCode: r.auction_house,
    auctionHouse: auctionHouseName(r.auction_house),
    lotUrl: r.auction_url || null,
    obverseImage: r.obverse_image || null,
    reverseImage: r.reverse_image || null,
 };
}

// fetching and caching the transaction record pools
const poolCache = new Map();
const pending = new Map();
let version = 0;
const listeners = new Set();

function bump(){
  version += 1;
  listeners.forEach((fn) => fn());
}

export function useTransactionsReady(){
  const [v, setV] = useState(version);
  useEffect(() => {
    const listener = () => setV(version);
    listeners.add(listener);
    return() => listeners.delete(listener);
 }, []);
  return v;
}

function keyFor(family, category){
  const nF = normalize(family);
  const nC = normalize(category);
  if(!nF && !nC) return null;
  return `${nF}|${nC}`;
}

async function fetchPool(family, category, key){
  try {
    const params = new URLSearchParams();
    if(family) params.set('family', family);
    if(category) params.set('category', category);
    const res = await fetch(`${API_BASE}/transactions?${params.toString()}`, {
      headers: {Accept: 'application/json'},
   });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const records = (Array.isArray(raw) ? raw : []).map(normalizeRecord).filter((r) => Number.isFinite(r.price));
    poolCache.set(key, records);
 } catch (err){
    console.error(`Failed to load transaction records for "${family}" / "${category}":`, err);
    poolCache.set(key, []); // cache the miss too, so a broken request doesn't retry every render
 } finally {
    pending.delete(key);
    bump();
 }
}

// sychronous getter for the pool
function getPool(family, category){
  const key = keyFor(family, category);
  if(!key) return [];
  if(poolCache.has(key)) return poolCache.get(key);
  if(!pending.has(key)){
    pending.set(key, fetchPool(family, category, key));
 }
  return [];
}

async function fetchByName(coinName){
  const key = `name:${normalize(coinName)}`;
  try {
    const res = await fetch(`${API_BASE}/transactions?${new URLSearchParams({name: coinName}).toString()}`, {
      headers: {Accept: 'application/json'},
   });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const records = (Array.isArray(raw) ? raw : []).map(normalizeRecord).filter((r) => Number.isFinite(r.price));
    poolCache.set(key, records);
 } catch (err){
    console.error(`Failed to load transaction records for coin name "${coinName}":`, err);
    poolCache.set(key, []);
 } finally {
    pending.delete(key);
    bump();
 }
}

function getPoolByName(coinName){
  const norm = normalize(coinName);
  if(!norm) return [];
  const key = `name:${norm}`;
  if(poolCache.has(key)) return poolCache.get(key);
  if(!pending.has(key)){
    pending.set(key, fetchByName(coinName));
 }
  return [];
}

export function findRealTransactions(family, category){
  return getPool(family, category).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Find relevant transaction records based on identity and grade.
// same variety > closest grade > same face value > closest year, return oldest-first.
export function findRelevantTransactions(identity, grade, limit = 20){
  const pool = getPool(identity?.family, identity?.category);
  if(pool.length === 0) return [];
  const refName = normalize(findBestMatch(identity ?? {})?.name);
  const targetGrade = parseGradeValue(grade);
  const targetFaceValue = normalize(identity?.faceValue);
  const targetYear = identity?.year ? parseInt(identity.year, 10) : null;
  const scored = pool.map((r) => {
    const isVarietyMatch = refName && normalize(r.coinName) === refName;
    const itemGrade = parseGradeValue(r.grade);
    const itemFv = extractFaceValueToken(r.coinName)?.value;
    const itemYear = extractYearToken(r.coinName)?.year;

    // pendalise mismatches
    let penalty = 0;
    if(!isVarietyMatch) penalty += 1000;
    if(targetGrade != null && itemGrade != null){
      penalty += Math.min(Math.abs(itemGrade - targetGrade), 100);
    }
    if(targetFaceValue && (!itemFv || normalize(itemFv) !== targetFaceValue)){
      penalty += 50;
    }
    if(targetYear != null && itemYear){
      penalty += Math.min(Math.abs(parseInt(itemYear, 10) - targetYear), 50);
    }
    return { record: r, penalty };
  });
  return scored
    .sort((a, b) => a.penalty - b.penalty)
    .slice(0, limit)
    .map((x) => x.record)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Find relevant transaction records based on identity and grade
export function findChartTransactions(identity, grade, gradeBand = 2){
  const pool = getPool(identity?.family, identity?.category);
  if(pool.length === 0) return [];

  const refName = normalize(findBestMatch(identity ?? {})?.name);
  if(!refName) return [];
  const targetGrade = parseGradeValue(grade);

  const matches = pool.filter((r) => {
    if(normalize(r.coinName) !== refName) return false;
    if(targetGrade == null) return true;
    const g = parseGradeValue(r.grade);
    return g != null && Math.abs(g - targetGrade) <= gradeBand;
 });

  return matches.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function findRealTransactionsByCoinName(coinName){
  return getPoolByName(coinName).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
}