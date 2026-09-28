import {useEffect, useMemo, useRef} from 'react';
import {formatGrade} from '../lib/grades.js';
import {buildMarketData} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';
import {identityDisplayName} from '../lib/taxonomy.js';

function CoinSummaryThumb({coin}){
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas || !coin.correctedCanvas) return;

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      coin.correctedCanvas,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }, [coin.correctedCanvas]);

  return <canvas ref={canvasRef} width={96} height={96} />;
}

function CoinSummaryCard({coin, index, active, onSelect}){
  const topVariety = coin.classification?.varietyPredictions?.[0];
  const topGrade = coin.classification?.gradePredictions?.[0];

  const name = coin.identity
    ? identityDisplayName(coin.identity, topVariety?.label)
    : 'Classifying…';

  const classificationConfidence = topVariety?.confidence ?? null;
  const detectionConfidence = (coin.confidence * 100).toFixed(0);
  const varietyConfidence =
    classificationConfidence != null
      ? (classificationConfidence * 100).toFixed(0)
      : null;

  const transactionsVersion = useTransactionsReady();

  const market = useMemo(
    () => buildMarketData(coin.identity, topGrade?.grade),
    [coin.identity, topGrade?.grade, transactionsVersion]
  );

  return(
    <button
      className={`all-coin-card${active ? ' active' : ''}`}
      onClick={() => onSelect(coin.idx)}
    >
      <span className="all-coin-card-idx">#{index + 1}</span>

      <div className="all-coin-card-thumb">
        <CoinSummaryThumb coin={coin} />
      </div>

      <div className="all-coin-card-name">{name}</div>

      <div className="all-coin-card-meta">
        det {detectionConfidence}%
        {varietyConfidence != null && ` · class ${varietyConfidence}%`}
      </div>

      {topGrade && (
        <div className="all-coin-card-grade">
          Grade {topGrade.grade} ({formatGrade(topGrade.grade)})
        </div>
      )}

      {market && (
        <div className="all-coin-card-price">
          ${market.estimate.low}–${market.estimate.high}
          <span className="range-sep">·</span>
          ~${market.estimate.mid}
        </div>
      )}
    </button>
  );
}

export default function AllCoinsModal({
  coins,
  activeId,
  onSelect,
  onClose,
}){
  const handleSelect = (id) => {
    onSelect(id);
    onClose();
  };

  return(
    <div
      className="modal"
      onClick={(event) => {
        if(event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-card-fullscreen">
        <div className="all-coins-modal-header">
          <h2>All Detected Coins</h2>

          <span className="all-coins-modal-count">
            {coins.length} coin{coins.length !== 1 ? 's' : ''}
          </span>

          <button
            className="icon-btn"
            title="Close"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="all-coins-grid">
          {coins.map((coin, index) => (
            <CoinSummaryCard
              key={coin.idx}
              coin={coin}
              index={index}
              active={coin.idx === activeId}
              onSelect={handleSelect}
            />
          ))}

          {coins.length === 0 && (
            <div className="coin-tabs-empty">
              No coins were detected above the 50% confidence cutoff.
              <br />
              Try again with brighter lighting, a higher resolution image,
              or a better angle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}