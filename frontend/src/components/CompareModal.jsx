import {useEffect, useMemo, useRef, useState} from 'react';
import {
  findBestMatch,
  searchCatalog,
  getRecommendedPrice,
} from '../lib/catalog.js';
import {formatGrade, parseGradeValue} from '../lib/grades.js';
import {identityDisplayName} from '../lib/taxonomy.js';
import {buildMarketData} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';

function ScannedThumb({coin}){
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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

  return(
    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      className="compare-canvas"
    />
  );
}

function gradeGuideLabel(key){
  const value = parseGradeValue(key);
  return value != null ? String(Math.round(value)) : key;
}

export default function CompareModal({coin, onClose}){
  const identity = coin?.identity;

  const alternates = searchCatalog({
    family: identity?.family,
    category: identity?.category,
  });

  const [refEntry, setRefEntry] = useState(() =>
    findBestMatch(identity ?? {})
  );

  useEffect(() => {
    setRefEntry(findBestMatch(identity ?? {}));
    // Identity fields 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    identity?.family,
    identity?.category,
    identity?.year,
    identity?.faceValue,
    identity?.variety,
  ]);

  const txVersion = useTransactionsReady();
  const topGrade = coin?.classification?.gradePredictions?.[0];

  const market = useMemo(
    () => buildMarketData(identity, topGrade?.grade),
    [identity, topGrade?.grade, txVersion]
  );

  if(!coin) return null;

  const scannedGradeLabel = topGrade
    ? `${topGrade.grade} (${formatGrade(topGrade.grade)})`
    : 'Ungraded';

  const scannedName = identityDisplayName(
    identity,
    coin.classification?.varietyPredictions?.[0]?.label
  );

  const recommended = getRecommendedPrice(
    refEntry,
    topGrade?.grade
  );

  const handleReferenceChange = (event) => {
    const entry = alternates.find(
      (item) => item.name === event.target.value
    );

    setRefEntry(entry ?? null);
  };

  const handleImageError = (event) => {
    event.currentTarget.style.visibility = 'hidden';
  };

  const handleBackdropClick = (event) => {
    if(event.target === event.currentTarget){
      onClose();
    }
  };

  return(
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal-card modal-card-wide compare-modal-card">
        <div className="compare-modal-header">
          <h2>Compare Coin</h2>

          {alternates.length > 1 && (
            <select
              className="sort-select"
              value={refEntry?.name ?? ''}
              onChange={handleReferenceChange}
            >
              {alternates.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  Reference: {entry.name}
                </option>
              ))}
            </select>
          )}

          <button
            className="icon-btn"
            title="Close"
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="compare-grid">
          <div className="compare-col compare-area-refmain">
            <div className="section-label">
              Located Coin (reference)
            </div>

            {refEntry ? (
              <>
                <div className="compare-image-pair">
                  <img
                    src={refEntry.obverse_image}
                    alt={`${refEntry.name} obverse`}
                    onError={handleImageError}
                  />

                  <img
                    src={refEntry.reverse_image}
                    alt={`${refEntry.name} reverse`}
                    onError={handleImageError}
                  />
                </div>

                <div className="compare-name">
                  {refEntry.name}
                </div>
              </>
            ) : (
              <p className="compare-empty">
                No catalog reference found for this family yet.
              </p>
            )}
          </div>

          <div className="compare-col compare-area-scanned">
            <div className="section-label">
              Your scanned coin
            </div>

            <ScannedThumb coin={coin} />

            <div className="compare-name">
              {scannedName}
            </div>

            <div className="compare-meta">
              Grade: {scannedGradeLabel}
            </div>

            {market?.estimate && (
              <div className="compare-meta">
                Estimated value: ${market.estimate.low}–
                ${market.estimate.high}
              </div>
            )}
          </div>

          {refEntry && (
            <div className="compare-col compare-area-refextra">
              {recommended && (
                <div className="recommended-price">
                  <span className="recommended-price-label">
                    NGC recommended for your grade
                  </span>

                  <span className="recommended-price-value">
                    {recommended.price}
                  </span>
                </div>
              )}

              {refEntry.price_guide && (
                <div className="compare-price-guide">
                  {Object.entries(refEntry.price_guide)
                    .sort(
                      ([gradeA], [gradeB]) =>
                        (parseGradeValue(gradeA) ?? 0) -
                        (parseGradeValue(gradeB) ?? 0)
                    )
                    .map(([grade, price]) => (
                      <div
                        className={`compare-price-row${
                          grade === recommended?.key
                            ? ' compare-price-row-match'
                            : ''
                        }`}
                        key={grade}
                      >
                        <span>{gradeGuideLabel(grade)}</span>
                        <span>{price}</span>
                      </div>
                    ))}
                </div>
              )}

              <a
                className="btn-secondary btn-sm"
                href={refEntry.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on NGC --{'>'}
              </a>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}