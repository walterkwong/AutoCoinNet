import {useEffect, useMemo, useRef, useState} from 'react';
import {
  buildMarketData,
  buildChartHistory,
  drawPriceChart,
} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';
import {formatGrade} from '../lib/grades.js';
import {identityDisplayName} from '../lib/taxonomy.js';
import {findBestMatch, getRecommendedPrice} from '../lib/catalog.js';
import CoinIdentityEditor from './CoinIdentityEditor.jsx';
import GradeDensityChart from './GradeDensityChart.jsx';

const VARIETY_MIN = 3;
const VARIETY_MAX = 5;

function PredictionList({predictions, labelFn}){
  if(!predictions || predictions.length === 0){
    return(
      <div className="prediction-empty">
        Classification/grading failed. Please refresh the page and try again.
      </div>
    );
  }

  return(
    <div className="prediction-list">
      {predictions.map((prediction, index) => (
        <div className="prediction-row" key={index}>
          <div className="prediction-row-top">
            <span className="prediction-rank">{index + 1}.</span>
            <span className="prediction-label">
              {labelFn(prediction)}
            </span>
            <span className="prediction-conf">
              {(prediction.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="prediction-bar-track">
            <div
              className="prediction-bar-fill"
              style={{
                width: `${Math.max(2, prediction.confidence * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DetailPopup({
  coin,
  onClose,
  onViewHistory,
  onCompare,
  onIdentityChange,
}){
  const detailCanvasRef = useRef(null);
  const sparklineRef = useRef(null);

  const [peekImage, setPeekImage] = useState(false);
  const [showAllVarieties, setShowAllVarieties] = useState(false);
  const [showGradeDetail, setShowGradeDetail] = useState(false);
  const [showIdentityEditor, setShowIdentityEditor] = useState(false);

  const txVersion = useTransactionsReady();

  const identity = coin?.identity;
  const gradePredictions = coin?.classification?.gradePredictions;
  const varietyPredictions = coin?.classification?.varietyPredictions;
  const topGrade = gradePredictions?.[0];
  const topVariety = varietyPredictions?.[0];

  const market = useMemo(
    () => buildMarketData(identity, topGrade?.grade),
    [identity, topGrade?.grade, txVersion]
  );

  const chartHistory = useMemo(
    () => buildChartHistory(identity, topGrade?.grade, 2),
    [identity, topGrade?.grade, txVersion]
  );

  useEffect(() => {
    const canvas = detailCanvasRef.current;

    if(!canvas || !coin?.correctedCanvas) return;

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
  }, [coin?.correctedCanvas]);

  useEffect(() => {
    const canvas = sparklineRef.current;
    if(!canvas) return;

    requestAnimationFrame(() => {
      drawPriceChart(canvas, chartHistory, {compact: true});
    });
  }, [chartHistory]);

  if(!coin) return null;

  const displayLabel = identityDisplayName(
    identity,
    topVariety?.label ?? 'Coin'
  );

  const gradeDistribution =
    coin.classification?.gradeDistribution ?? gradePredictions;

  const referenceEntry = findBestMatch(identity ?? {});
  const recommended = getRecommendedPrice(
    referenceEntry,
    topGrade?.grade
  );

  const visibleVarieties = varietyPredictions?.slice(
    0,
    showAllVarieties ? VARIETY_MAX : VARIETY_MIN
  );

  const hasMoreVarieties =
    (varietyPredictions?.length ?? 0) > VARIETY_MIN;

  const hasGradeSpread =
    (gradeDistribution?.length ?? 0) > 1;

  const handleVarietyToggle = () => {
    setShowAllVarieties((current) => !current);
  };

  const handleGradeToggle = () => {
    setShowGradeDetail((current) => !current);
  };

  const handleIdentityToggle = () => {
    setShowIdentityEditor((current) => !current);
  };

  return(
    <div
      className={`detail-popup${peekImage ? ' detail-popup-peek' : ''}`}
      role="dialog"
      aria-label={`Detail for ${displayLabel}`}
    >
      <button
        className="icon-btn detail-popup-toggle"
        onClick={() => setPeekImage((current) => !current)}
        title={peekImage ? 'Show coin details' : 'Show coin image'}
      >
      {/* https://www.symbolcopy.com/menu-symbols.html */}
      {/* https://www.symbolcopy.com/circle-symbol.html */}
        {peekImage ? '☰' : '◎'}
      </button>

      <button
        className="icon-btn detail-popup-close"
        onClick={onClose}
        title="Close"
      >
        x
      </button>

      <div className="detail-popup-content">
        <div className="detail-popup-left">
          <div id="detail-canvas-wrap">
            <canvas
              ref={detailCanvasRef}
              id="detail-canvas"
              width={200}
              height={200}
            />
          </div>

          <div className="detail-popup-title">
            {displayLabel}
          </div>

          {recommended && (
            <div className="recommended-price">
              <span className="recommended-price-label">
                NGC recommended ({recommended.key})
              </span>
              <span className="recommended-price-value">
                {recommended.price}
              </span>
            </div>
          )}

          <button
            className="btn-vivid btn-vivid-compare"
            onClick={() => onCompare(coin)}
          >
            Compare with NGC Catalog
          </button>
        </div>

        <div className="detail-popup-right">
          <div id="panel-classification">
            <div className="section-label">
              <span>Identification</span>

              {hasMoreVarieties && (
                <button
                  type="button"
                  className="section-expand-btn"
                  onClick={handleVarietyToggle}
                >
                  {showAllVarieties ? 'Top 3' : 'Top 5'}
                </button>
              )}
            </div>

            <PredictionList
              predictions={visibleVarieties}
              labelFn={(prediction) => prediction.fullLabel}
            />

            <div className="section-label">
              <span>Sheldon Scale Grade</span>

              {hasGradeSpread && (
                <button
                  type="button"
                  className="section-expand-btn"
                  onClick={handleGradeToggle}
                >
                  {showGradeDetail ? 'Hide' : 'Distribution'}
                </button>
              )}
            </div>

            {topGrade ? (
              <div className="top-grade-line">
                <span>
                  Grade {topGrade.grade} ({formatGrade(topGrade.grade)})
                </span>
                <span className="prediction-conf">
                  {(topGrade.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="prediction-empty">
                Classification/grading failed. Please refresh the page and try again.
              </div>
            )}

            {showGradeDetail && hasGradeSpread && (
              <GradeDensityChart distribution={gradeDistribution} />
            )}

            <div
              className="section-label identity-toggle"
              onClick={handleIdentityToggle}
            >
              <span>Edit coin details</span>
              v
            </div>

            {showIdentityEditor && (
              <CoinIdentityEditor
                coinIdx={coin.idx}
                identity={identity}
                detectedIdentity={coin.detectedIdentity}
                candidates={coin.identityCandidates}
                onChange={onIdentityChange}
              />
            )}
          </div>

          {market && (
            <div id="panel-market">
              <div className="section-label">
                Estimated Value (recent sales)
              </div>

              <div id="market-estimate">
                ${market.estimate.low}
                <span className="range-sep">-</span>
                ${market.estimate.high}
                <span className="range-sep">·</span>
                ~${market.estimate.mid}
              </div>

              <canvas
                ref={sparklineRef}
                id="market-sparkline"
                width={240}
                height={120}
              />

              <button
                className="btn-vivid btn-vivid-history"
                onClick={() => onViewHistory(coin)}
              >
                More on transaction history
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}