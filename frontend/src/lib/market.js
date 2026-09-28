// market value and transaction history
import {findRelevantTransactions, findChartTransactions} from './transactions.js';

function mapSalesToHistory(sales){
  return sales.map((s) => ({
    date: s.date,
    price: s.price,
    grade: s.grade,
    venue: s.auctionHouse,
    grader: s.grader,
    coinName: s.coinName,
    lotUrl: s.lotUrl,
    obverseImage: s.obverseImage,
    reverseImage: s.reverseImage,
 }));
}

export function buildMarketData(identity, grade, limit = 20){
  const sales = findRelevantTransactions(identity, grade, limit);
  if(sales.length === 0) return null;

  const history = mapSalesToHistory(sales);

  const recentPrices = history.slice(-6).map((h) => h.price).filter((p) => p != null);
  if(recentPrices.length === 0) return {estimate: null, history};

  const sortedRecent = [...recentPrices].sort((a, b) => a - b);
  const mid = sortedRecent[Math.floor(sortedRecent.length / 2)];

  return {
    estimate: {
      low: Math.round(Math.min(...recentPrices)),
      mid: Math.round(mid),
      high: Math.round(Math.max(...recentPrices)),
   },
    history,
 };
}

export function buildChartHistory(identity, grade, gradeBand = 2){
  return mapSalesToHistory(findChartTransactions(identity, grade, gradeBand));
}

// price chart
export function drawPriceChart(canvas, history, opts = {}){
  const {compact = false} = opts;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssW, H = cssH;
  ctx.clearRect(0, 0, W, H);
  if(!history || history.length < 2){
    ctx.fillStyle = 'rgba(240,234,214,0.4)';
    ctx.font = `${compact ? 10 : 11}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Not enough sales to chart', W / 2, H / 2);
    ctx.textAlign = 'left';
    return;
 }

  const padL = compact ? 36 : 44;
  const padR = compact ? 8 : 12;
  const padT = compact ? 8 : 14;
  const padB = compact ? 16 : 24;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = Math.max(max - min, 1e-6);
  const gridLines = compact ? 2 : 3;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(240,234,214,0.45)';
  ctx.font = `${compact ? 9 : 10}px Inter, sans-serif`;
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridLines; i++){
    const y = padT + (i / gridLines) * (H - padT - padB);
    const val = max - (i / gridLines) * range;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText(`$${Math.round(val)}`, 2, y + 3);
 }

  const xAt = (i) => padL + (i / (history.length - 1)) * (W - padL - padR);
  const yAt = (p) => padT + (1 - (p - min) / range) * (H - padT - padB);

  ctx.beginPath();
  history.forEach((h, i) => {
    const x = xAt(i), y = yAt(h.price);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
 });
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(201,168,76,0.25)');
  grad.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.lineTo(xAt(history.length - 1), H - padB);
  ctx.lineTo(xAt(0), H - padB);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  history.forEach((h, i) => {
    const x = xAt(i), y = yAt(h.price);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
 });
  ctx.strokeStyle = '#C9A84C';
  ctx.lineWidth = compact ? 1.6 : 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  history.forEach((h, i) => {
    ctx.beginPath();
    ctx.arc(xAt(i), yAt(h.price), compact ? 1.8 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F0EAD6';
    ctx.fill();
 });

  // x-axis
  ctx.fillStyle = 'rgba(240,234,214,0.45)';
  ctx.font = `${compact ? 9 : 10}px Inter, sans-serif`;
  ctx.fillText(history[0].date, padL, H - 5);
  const lastLabel = history[history.length - 1].date;
  ctx.fillText(lastLabel, W - padR - ctx.measureText(lastLabel).width, H - 5);
}