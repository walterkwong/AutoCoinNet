import {useMemo, useState} from 'react';
import CoinCard from './CoinCard.jsx';
import {buildMarketData} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';
import {identityDisplayName} from '../lib/taxonomy.js';

const SORT_OPTIONS = [
  {key: 'name', label: 'Name'},
  {key: 'price', label: 'Expected price'},
  {key: 'detectionConf', label: 'Detection confidence'},
  {key: 'classConf', label: 'Classification confidence'},
];

function getSortValue(coin, sortKey){
  const topVariety = coin.classification?.varietyPredictions?.[0];

  switch (sortKey){
    case 'name':
      return identityDisplayName(coin.identity, topVariety?.label).toLowerCase();

    case 'price':
      return buildMarketData(
        coin.identity,
        coin.classification?.gradePredictions?.[0]?.grade
      )?.estimate?.mid ?? -1;

    case 'detectionConf':
      return coin.confidence ?? -1;

    case 'classConf':
      return topVariety?.confidence ?? -1;

    default:
      return 0;
  }
}

export default function Sidebar({coins, activeId, onSelect, onExpand}){
  const [sortKey, setSortKey] = useState('detectionConf');
  const [sortDirection, setSortDirection] = useState('desc');
  const transactionsVersion = useTransactionsReady();

  const sortedCoins = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    return coins
      .map((coin) => ({coin, value: getSortValue(coin, sortKey)}))
      .sort((a, b) => {
        if(a.value === b.value) return 0;
        return a.value > b.value ? direction : -direction;
      })
      .map(({coin}) => coin);
  }, [coins, sortKey, sortDirection, transactionsVersion]);

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  };

  return(
    <aside id="coin-panel">
      <div id="coin-panel-header">
        <div className="panel-title-row">
          <span id="panel-title">Detected Coins</span>

          <button
            className="icon-btn expand-btn"
            title="View all coins"
            aria-label="View all detected coins"
            onClick={onExpand}
            disabled={coins.length === 0}
          >
            {/* https://www.symbolcopy.com/square-symbols.html */}
            <span>▢</span>
          </button>
        </div>

        <span id="panel-subtitle">
          {coins.length} coin{coins.length !== 1 ? 's' : ''} found
        </span>

        <div className="sort-controls">
          <select
            className="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Sort coins by"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                Sort: {option.label}
              </option>
            ))}
          </select>

          <button
            className="icon-btn sort-dir-btn"
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            onClick={toggleSortDirection}
          >
            {/* https://www.symbolcopy.com/arrow-symbol.html */}
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div id="coin-tabs" role="tablist">
        {sortedCoins.length === 0 ? (
          <div className="coin-tabs-empty">
            No coins above the 50% confidence cutoff.
          </div>
        ) : (
          sortedCoins.map((coin) => (
            <CoinCard
              key={coin.idx}
              coin={coin}
              index={coin.idx}
              active={coin.idx === activeId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}