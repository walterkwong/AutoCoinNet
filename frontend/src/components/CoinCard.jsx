import {useCallback, useEffect, useMemo, useRef} from 'react';
import {buildMarketData} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';
import {identityDisplayName} from '../lib/taxonomy.js';

export default function CoinCard({coin, index, active, onSelect}){
  const canvasRef = useRef(null);
  const txVersion = useTransactionsReady();

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas || !coin.correctedCanvas) return;

    const context = canvas.getContext('2d');
    if(!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      coin.correctedCanvas,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [coin.correctedCanvas]);

  const topVariety = coin.classification?.varietyPredictions?.[0];
  const topGrade = coin.classification?.gradePredictions?.[0];

  const name = coin.identity
    ? identityDisplayName(coin.identity, topVariety?.label)
    : 'Classifying…';

  const classificationConfidence = topVariety?.confidence ?? null;

  const market = useMemo(
    () => buildMarketData(coin.identity, topGrade?.grade),
    [coin.identity, topGrade?.grade, txVersion]
  );

  const price = market?.estimate?.mid;
  const detectionConfidence = Math.round((coin.confidence ?? 0) * 100);
  const varietyConfidence =
    classificationConfidence != null
      ? Math.round(classificationConfidence * 100)
      : null;

  const handleKeyDown = useCallback(
    (event) => {
      if(event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      onSelect(coin.idx);
    },
    [coin.idx, onSelect]
  );

  return(
    <div
      className={`coin-tab${active ? ' active' : ''}`}
      role="tab"
      tabIndex={0}
      onClick={() => onSelect(coin.idx)}
      onKeyDown={handleKeyDown}
    >
      <div className="coin-thumb-wrap">
        <canvas
          ref={canvasRef}
          width={96}
          height={96}
        />
      </div>

      <div className="coin-tab-info">
        <span className="coin-tab-label">
          {name}
        </span>

        <span className="coin-tab-score">
          {price != null ? `~$${price}` : '—'}
          {' · '}
          det {detectionConfidence}%
          {varietyConfidence != null
            ? ` · class ${varietyConfidence}%`
            : ''}
        </span>
      </div>

      <span className="coin-tab-idx">
        #{index + 1}
      </span>
    </div>
  );
}