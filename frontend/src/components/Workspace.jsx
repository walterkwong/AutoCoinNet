import {useState} from 'react';
import CoinCanvas from './CoinCanvas.jsx';
import Sidebar from './Sidebar.jsx';
import DetailPopup from './DetailPopup.jsx';
import MarketModal from './MarketModal.jsx';
import CompareModal from './CompareModal.jsx';
import HelpButton from './HelpButton.jsx';
import AllCoinsModal from './AllCoinsModal.jsx';
import {useIsMobile} from '../hooks/useIsMobile.js';

export default function Workspace({
  image,
  coins,
  activeId,
  setActiveId,
  onBack,
  onRerun,
  onIdentityChange,
}){
  const [marketCoin, setMarketCoin] = useState(null);
  const [compareCoin, setCompareCoin] = useState(null);
  const [showAllCoins, setShowAllCoins] = useState(false);
  const isMobile = useIsMobile();
  const activeCoin = coins.find((c) => c.idx === activeId) ?? null;

  return(
    <section id="workspace">
      <header id="topbar">
        <button className="icon-btn" title="New image" onClick={onBack}>
          {'<'}
        </button>

        <span className="wordmark-sm">AutoCoinScan</span>

        <button className="icon-btn" title="Re-run detection" onClick={onRerun}>
          {/* https://www.symbolcopy.com/arrow-symbol.html */}
          ↺
        </button>

        <HelpButton />
      </header>

      <div className="workspace-viewport">
        <CoinCanvas
          image={image}
          coins={coins}
          activeId={activeId}
          onSelect={setActiveId}
        />

        {activeCoin && (
          <DetailPopup
            coin={activeCoin}
            onClose={() => setActiveId(null)}
            onViewHistory={setMarketCoin}
            onCompare={setCompareCoin}
            onIdentityChange={onIdentityChange}
          />
        )}
      </div>

      {isMobile ? (
        <button
          className="all-coins-fab"
          onClick={() => setShowAllCoins(true)}
          disabled={coins.length === 0}
        >
          All Detected Coins{coins.length > 0 ? ` (${coins.length})` : ''}
        </button>
      ) : (
        <Sidebar
          coins={coins}
          activeId={activeId}
          onSelect={setActiveId}
          onExpand={() => setShowAllCoins(true)}
        />
      )}

      {showAllCoins && (
        <AllCoinsModal
          coins={coins}
          activeId={activeId}
          onSelect={setActiveId}
          onClose={() => setShowAllCoins(false)}
        />
      )}

      {marketCoin && (
        <MarketModal
          coin={marketCoin}
          onClose={() => setMarketCoin(null)}
        />
      )}

      {compareCoin && (
        <CompareModal
          coin={compareCoin}
          onClose={() => setCompareCoin(null)}
        />
      )}
    </section>
  );
}