import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {buildMarketData} from '../lib/market.js';
import {useTransactionsReady} from '../lib/transactions.js';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const FIT_PADDING = 1.7;
const WHEEL_ZOOM_SPEED = 0.0016;
const TRANSITION_DURATION = 380;
const DIM_OPACITY = 0.62;

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function pointsToString(points){
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

export default function CoinCanvas({image, coins, activeId, onSelect}){
  const W = image?.el?.naturalWidth ?? 0;
  const H = image?.el?.naturalHeight ?? 0;

  const viewportRef = useRef(null);
  const hostRef = useRef(null);
  const dragRef = useRef(null);
  const animationTimerRef = useRef(null);

  const [transform, setTransform] = useState({scale: 1, x: 0, y: 0});
  const [animated, setAnimated] = useState(false);

  const txVersion = useTransactionsReady();

  const polygons = useMemo(
    () =>
      coins.map((coin) => {
        const pts = (coin.polygonNorm ?? []).map(([nx, ny]) => [
          nx * W,
          ny * H,
        ]);

        const cx = pts.length
          ? pts.reduce((sum, [x]) => sum + x, 0) / pts.length
          : 0;

        const cy = pts.length
          ? pts.reduce((sum, [, y]) => sum + y, 0) / pts.length
          : 0;

        const maxY = pts.length
          ? Math.max(...pts.map(([, y]) => y))
          : cy;

        const price = buildMarketData(
          coin.identity,
          coin.classification?.gradePredictions?.[0]?.grade
        )?.estimate?.mid;

        return {coin, pts, cx, cy, maxY, price};
      }),
    [coins, W, H, txVersion]
  );

  const animateTo = useCallback((nextTransform) => {
    setAnimated(true);
    setTransform(nextTransform);

    window.clearTimeout(animationTimerRef.current);
    animationTimerRef.current = window.setTimeout(() => {
      setAnimated(false);
    }, TRANSITION_DURATION);
  }, []);

  const resetView = useCallback(() => {
    animateTo({scale: 1, x: 0, y: 0});
  }, [animateTo]);

  useEffect(() => {
    const host = hostRef.current;
    const viewport = viewportRef.current;

    if(!host || !viewport) return;

    if(activeId == null){
      resetView();
      return;
    }

    const coin = coins.find((item) => item.idx === activeId);
    if(!coin?.bbox) return;

    const hostWidth = host.clientWidth;
    const hostHeight = host.clientHeight;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    if(!hostWidth || !hostHeight || !viewportWidth || !viewportHeight){
      return;
    }

    const bx = coin.bbox.x * hostWidth;
    const by = coin.bbox.y * hostHeight;
    const bw = Math.max(coin.bbox.w * hostWidth, 1);
    const bh = Math.max(coin.bbox.h * hostHeight, 1);

    const scale = clamp(
      Math.min(
        viewportWidth / (bw * FIT_PADDING),
        viewportHeight / (bh * FIT_PADDING)
      ),
      MIN_SCALE,
      MAX_SCALE
    );

    const cx = bx + bw / 2;
    const cy = by + bh / 2;

    animateTo({
      scale,
      x: viewportWidth / 2 - scale * cx,
      y: viewportHeight / 2 - scale * cy,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const zoomAt = useCallback((factor, screenX, screenY) => {
    setTransform((current) => {
      const viewport = viewportRef.current;
      if(!viewport) return current;

      const rect = viewport.getBoundingClientRect();
      const px =
        screenX != null
          ? screenX - rect.left
          : viewport.clientWidth / 2;
      const py =
        screenY != null
          ? screenY - rect.top
          : viewport.clientHeight / 2;

      const scale = clamp(
        current.scale * factor,
        MIN_SCALE,
        MAX_SCALE
      );

      if(scale === current.scale) return current;

      const contentX = (px - current.x) / current.scale;
      const contentY = (py - current.y) / current.scale;

      return {
        scale,
        x: px - scale * contentX,
        y: py - scale * contentY,
      };
    });
  }, []);

  const handleWheel = useCallback(
    (event) => {
      if(!image) return;

      event.preventDefault();

      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED);

      setAnimated(false);
      zoomAt(factor, event.clientX, event.clientY);
    },
    [image, zoomAt]
  );

  const handlePointerDown = useCallback((event) => {
    if(event.button !== undefined && event.button !== 0) return;

    const drag = {
      startX: event.clientX,
      startY: event.clientY,
      startTx: 0,
      startTy: 0,
      moved: false,
      pointerId: event.pointerId,
      target: event.currentTarget,
    };

    dragRef.current = drag;

    setTransform((current) => {
      drag.startTx = current.x;
      drag.startTy = current.y;
      return current;
    });
  }, []);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if(!drag) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if(!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)){
      drag.moved = true;
      drag.target?.setPointerCapture?.(drag.pointerId);
    }

    if(!drag.moved) return;

    setAnimated(false);
    setTransform((current) => ({
      ...current,
      x: drag.startTx + dx,
      y: drag.startTy + dy,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleHostClick = useCallback(
    (id) => () => {
      if(dragRef.current?.moved) return;
      onSelect(id);
    },
    [onSelect]
  );

  const handleCoinKeyDown = useCallback(
    (event, coinIdx) => {
      if(event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      onSelect(coinIdx);
    },
    [onSelect]
  );

  if(!image) return null;

  const {scale, x, y} = transform;

  return(
    <div className="coin-canvas-viewport" ref={viewportRef}>
      <div
        className={`coin-canvas-host${animated ? ' animated' : ''}`}
        ref={hostRef}
        style={{
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img
          src={image.url}
          alt="Uploaded coins"
          className="coin-canvas-img"
          draggable={false}
        />

        <svg
          className="coin-canvas-overlay"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <mask id="coin-dim-mask">
              <rect width={W} height={H} fill="white" />

              {polygons.map(({pts}, index) =>
                pts.length >= 3 ? (
                  <polygon
                    key={index}
                    points={pointsToString(pts)}
                    fill="black"
                  />
                ) : null
              )}
            </mask>
          </defs>

          <rect
            width={W}
            height={H}
            fill={`rgba(0, 0, 0, ${DIM_OPACITY})`}
            mask="url(#coin-dim-mask)"
          />

          {polygons.map(({coin, pts, cx, cy, maxY, price}, index) => {
            if(pts.length < 3) return null;

            const isActive = coin.idx === activeId;
            const strokeWidth =
              (isActive ? W * 0.003 : W * 0.0018) /
              Math.max(scale, 1);

            const labelSize = (W * 0.02) / Math.max(scale, 1);
            const priceSize = (W * 0.014) / Math.max(scale, 1);

            return(
              <g
                key={coin.idx}
                className={`coin-hit${isActive ? ' active' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`Select coin ${index + 1}`}
                onClick={handleHostClick(coin.idx)}
                onKeyDown={(event) =>
                  handleCoinKeyDown(event, coin.idx)
                }
              >
                <polygon
                  points={pointsToString(pts)}
                  fill="transparent"
                  stroke={
                    isActive
                      ? '#C9A84C'
                      : 'rgba(201,168,76,0.55)'
                  }
                  strokeWidth={strokeWidth}
                />

                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={labelSize}
                  fontWeight="700"
                  fill={
                    isActive
                      ? '#C9A84C'
                      : 'rgba(201,168,76,0.85)'
                  }
                >
                  {index + 1}
                </text>

                {price != null && (
                  <text
                    className="coin-price-label"
                    x={cx}
                    y={maxY + (W * 0.028) / Math.max(scale, 1)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={priceSize}
                    fontWeight="600"
                  >
                    ~${price}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="zoom-controls">
        <button
          className="icon-btn zoom-btn"
          title="Zoom in"
          onClick={() => zoomAt(1.4)}
        >
          +
        </button>

        <button
          className="icon-btn zoom-btn"
          title="Zoom out"
          onClick={() => zoomAt(1 / 1.4)}
        >
          -
        </button>

        <button
          className="icon-btn zoom-btn zoom-btn-reset"
          title="Reset view"
          onClick={resetView}
        >
          {/* https://www.symbolcopy.com/arrow-symbol.html#google_vignette */}
          ⤢
        </button>
      </div>
    </div>
  );
}