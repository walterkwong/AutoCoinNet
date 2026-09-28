import {useEffect, useMemo, useRef, useState} from 'react';
import {buildMarketData, drawPriceChart} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';
import {identityDisplayName} from '../lib/taxonomy.js';
import {findBestMatch} from '../lib/catalog.js';
import {parseGradeValue, formatGrade} from '../lib/grades.js';
import RangeDensityFilter from './RangeDensityFilter.jsx';
import CoinMultiSelect from './CoinMultiSelect.jsx';

const HISTORY_LIMIT = 300;
const ROW_CAP = 100;
const COIN_OPTIONS_MAX = 20;

const SORT_OPTIONS = [
  {value: 'date-desc', label: 'Newest first'},
  {value: 'date-asc', label: 'Oldest first'},
  {value: 'price-desc', label: 'Price: high to low'},
  {value: 'price-asc', label: 'Price: low to high'},
  {value: 'grade-desc', label: 'Grade: high to low'},
  {value: 'grade-asc', label: 'Grade: low to high'},
];

function formatDateLong(iso){
  if(!iso) return 'Unknown date';

  const d = new Date(`${iso}T00:00:00`);
  if(Number.isNaN(d.getTime())) return iso;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function yearOf(iso){
  const y = iso?.slice(0, 4);
  return y && /^\d{4}$/.test(y) ? +y : null;
}

function normalizeName(str){
  return(str || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export default function MarketModal({coin, onClose}){
  const chartRef = useRef(null);
  const txVersion = useTransactionsReady();

  const market = useMemo(
    () =>
      buildMarketData(
        coin?.identity,
        coin?.classification?.gradePredictions?.[0]?.grade,
        HISTORY_LIMIT
      ),
    [coin?.identity, coin?.classification?.gradePredictions, txVersion]
  );

  const [selectedCoins, setSelectedCoins] = useState(() => new Set());
  const [yearRange, setYearRange] = useState(null);
  const [gradeRange, setGradeRange] = useState(null);
  const [priceRange, setPriceRange] = useState(null);
  const [sortBy, setSortBy] = useState('date-desc');
  const [openFilter, setOpenFilter] = useState(null);

  const allHistory = market?.history ?? [];

  const defaultVarietyName = useMemo(() => {
    const refName = findBestMatch(coin?.identity ?? {})?.name;
    if(!refName) return null;

    const normalizedReference = normalizeName(refName);

    return(
      allHistory.find(
        (h) => normalizeName(h.coinName) === normalizedReference
      )?.coinName ?? null
    );
  }, [allHistory, coin?.identity]);

  const targetGrade = parseGradeValue(
    coin?.classification?.gradePredictions?.[0]?.grade
  );

  const coinOptions = useMemo(() => {
    const counts = new Map();

    allHistory.forEach((h) => {
      if(!h.coinName) return;
      counts.set(h.coinName, (counts.get(h.coinName) ?? 0) + 1);
    });

    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({name, count}));

    const top = ranked.slice(0, COIN_OPTIONS_MAX);

    if(
      defaultVarietyName &&
      !top.some((option) => option.name === defaultVarietyName)
    ){
      top.unshift({
        name: defaultVarietyName,
        count: counts.get(defaultVarietyName) ?? 0,
      });

      if(top.length > COIN_OPTIONS_MAX){
        top.pop();
      }
    }

    return top;
  }, [allHistory, defaultVarietyName]);

  const years = useMemo(
    () =>
      allHistory
        .map((h) => yearOf(h.date))
        .filter((year) => year != null),
    [allHistory]
  );

  const yearSnap = useMemo(
    () => [...new Set(years)].sort((a, b) => a - b),
    [years]
  );

  const yearDomain = yearSnap.length
    ? [yearSnap[0], yearSnap[yearSnap.length - 1]]
    : [0, 1];

  const grades = useMemo(
    () =>
      allHistory
        .map((h) => parseGradeValue(h.grade))
        .filter((grade) => grade != null),
    [allHistory]
  );

  const gradeSnap = useMemo(
    () => [...new Set(grades)].sort((a, b) => a - b),
    [grades]
  );

  const gradeDomain = gradeSnap.length
    ? [gradeSnap[0], gradeSnap[gradeSnap.length - 1]]
    : [1, 70];

  const prices = useMemo(
    () => allHistory.map((h) => h.price).filter((price) => price != null),
    [allHistory]
  );

  const priceSnap = useMemo(
    () => [...new Set(prices)].sort((a, b) => a - b),
    [prices]
  );

  const priceDomain = priceSnap.length
    ? [priceSnap[0], priceSnap[priceSnap.length - 1]]
    : [0, 1];

  const defaultGradeRange = useMemo(() => {
    if(targetGrade == null) return null;

    const lo = Math.max(gradeDomain[0], targetGrade - 2);
    const hi = Math.min(gradeDomain[1], targetGrade + 2);

    return lo <= hi ? [lo, hi] : null;
  }, [targetGrade, gradeDomain[0], gradeDomain[1]]);

  useEffect(() => {
    setSelectedCoins(
      defaultVarietyName ? new Set([defaultVarietyName]) : new Set()
    );
    setYearRange(null);
    setGradeRange(defaultGradeRange);
    setPriceRange(null);
    setSortBy('date-desc');
    setOpenFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin?.idx]);

  const filtered = useMemo(() => {
    const rows = allHistory.filter((h) => {
      if(selectedCoins.size && !selectedCoins.has(h.coinName)){
        return false;
      }

      if(yearRange){
        const year = yearOf(h.date);
        if(
          year == null ||
          year < yearRange[0] ||
          year > yearRange[1]
        ){
          return false;
        }
      }

      if(gradeRange){
        const grade = parseGradeValue(h.grade);
        if(
          grade == null ||
          grade < gradeRange[0] ||
          grade > gradeRange[1]
        ){
          return false;
        }
      }

      if(priceRange){
        if(
          h.price == null ||
          h.price < priceRange[0] ||
          h.price > priceRange[1]
        ){
          return false;
        }
      }

      return true;
    });

    return rows.slice().sort((a, b) => {
      switch (sortBy){
        case 'date-asc':
          return new Date(a.date) - new Date(b.date);
        case 'price-desc':
          return(b.price ?? 0) - (a.price ?? 0);
        case 'price-asc':
          return(a.price ?? 0) - (b.price ?? 0);
        case 'grade-desc':
          return(
            (parseGradeValue(b.grade) ?? 0) -
            (parseGradeValue(a.grade) ?? 0)
          );
        case 'grade-asc':
          return(
            (parseGradeValue(a.grade) ?? 0) -
            (parseGradeValue(b.grade) ?? 0)
          );
        case 'date-desc':
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });
  }, [
    allHistory,
    selectedCoins,
    yearRange,
    gradeRange,
    priceRange,
    sortBy,
  ]);

  const capped = filtered.slice(0, ROW_CAP);
  const capReached = filtered.length > ROW_CAP;

  const activeFilterCount =
    (selectedCoins.size ? 1 : 0) +
    (yearRange ? 1 : 0) +
    (gradeRange ? 1 : 0) +
    (priceRange ? 1 : 0);

  const chartHistory = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [filtered]
  );

  useEffect(() => {
    if(!chartRef.current) return;

    requestAnimationFrame(() => {
      drawPriceChart(chartRef.current, chartHistory);
    });
  }, [chartHistory]);

  const groups = useMemo(() => {
    if(sortBy !== 'date-desc' && sortBy !== 'date-asc'){
      return [{label: null, rows: capped}];
    }

    const byYear = new Map();

    for (const h of capped){
      const year = yearOf(h.date) ?? 'Unknown date';

      if(!byYear.has(year)){
        byYear.set(year, []);
      }

      byYear.get(year).push(h);
    }

    return [...byYear.entries()].map(([label, rows]) => ({
      label,
      rows,
    }));
  }, [capped, sortBy]);

  const clearFilters = () => {
    setSelectedCoins(new Set());
    setYearRange(null);
    setGradeRange(null);
    setPriceRange(null);
  };

  if(!coin || !market) return null;

  const title = identityDisplayName(
    coin.identity,
    coin.classification?.varietyPredictions?.[0]?.label
  );

  return(
    <div
      className="modal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card modal-card-wide">
        <h2>Transaction History — {title}</h2>

        <canvas ref={chartRef} id="market-chart" />

        <div className="history-filter-row">
          <CoinMultiSelect
            options={coinOptions}
            selected={selectedCoins}
            onChange={setSelectedCoins}
            isOpen={openFilter === 'coin'}
            onOpenChange={(open) => setOpenFilter(open ? 'coin' : null)}
          />

          <RangeDensityFilter
            label="Year"
            values={years}
            snapValues={yearSnap}
            domainMin={yearDomain[0]}
            domainMax={yearDomain[1]}
            selected={yearRange}
            onChange={setYearRange}
            formatValue={(v) => Math.round(v)}
            isOpen={openFilter === 'year'}
            onOpenChange={(open) => setOpenFilter(open ? 'year' : null)}
          />

          <RangeDensityFilter
            label="Grade"
            values={grades}
            snapValues={gradeSnap}
            domainMin={gradeDomain[0]}
            domainMax={gradeDomain[1]}
            selected={gradeRange}
            onChange={setGradeRange}
            formatValue={(v) => formatGrade(Math.round(v))}
            isOpen={openFilter === 'grade'}
            onOpenChange={(open) => setOpenFilter(open ? 'grade' : null)}
          />

          <RangeDensityFilter
            label="Price"
            values={prices}
            snapValues={priceSnap}
            domainMin={priceDomain[0]}
            domainMax={priceDomain[1]}
            selected={priceRange}
            onChange={setPriceRange}
            formatValue={(v) => `$${Math.round(v)}`}
            isOpen={openFilter === 'price'}
            onOpenChange={(open) => setOpenFilter(open ? 'price' : null)}
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="Sort by"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="history-filter-row history-filter-row-secondary">
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="history-filter-clear"
              onClick={clearFilters}
            >
              Clear filters ({activeFilterCount})
            </button>
          )}

          <span className="history-filter-count">
            {capped.length}
            {capReached ? ` of ${filtered.length}` : ''}{' '}
            sale{filtered.length === 1 ? '' : 's'} shown
          </span>
        </div>

        {capReached && (
          <div className="history-cap-banner">
            Showing the first {ROW_CAP} sales — {filtered.length - ROW_CAP}{' '}
            more match these filters. Narrow the filters above to see them.
          </div>
        )}

        <div className="history-list">
          {capped.length === 0 && (
            <div className="history-empty">
              No sales match these filters.
            </div>
          )}

          {groups.map((group) => (
            <div
              className="history-group"
              key={group.label ?? 'flat'}
            >
              {group.label && (
                <div className="history-group-header">
                  <span>{group.label}</span>
                  <span className="history-group-count">
                    {group.rows.length}{' '}
                    sale{group.rows.length === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              {group.rows.map((h, i) => (
                <div
                  className="history-row"
                  key={`${h.date}-${h.lotUrl ?? i}`}
                >
                  <div className="hr-main">
                    <div className="hr-date">
                      {formatDateLong(h.date)}
                    </div>
                    <div className="hr-name">
                      {h.coinName ?? title}
                    </div>
                  </div>

                  <div className="hr-tags">
                    {h.grade && (
                      <span className="hr-tag hr-tag-grade">
                        {h.grader ? `${h.grader} ` : ''}
                        {h.grade}
                      </span>
                    )}

                    <span className="hr-tag hr-tag-venue">
                      {h.venue}
                    </span>
                  </div>

                  {h.lotUrl ? (
                    <a
                      className="hr-price"
                      href={h.lotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ${h.price.toFixed(2)}
                    </a>
                  ) : (
                    <span className="hr-price">
                      ${h.price.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}