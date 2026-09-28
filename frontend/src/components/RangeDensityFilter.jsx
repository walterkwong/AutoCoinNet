import {useEffect, useMemo, useRef, useState} from 'react';

const BUCKETS = 30;

function computeHistogram(values, min, max){
  if(!values?.length || min >= max) return [];

  const span = max - min;
  const counts = new Array(BUCKETS).fill(0);

  values.forEach((value) => {
    if(value == null || Number.isNaN(value)) return;

    const index = Math.min(
      BUCKETS - 1,
      Math.max(0, Math.floor(((value - min) / span) * BUCKETS))
    );

    counts[index] += 1;
  });

  const maxCount = Math.max(...counts, 1);
  return counts.map((count) => (count / maxCount) * 100);
}

function nearestSnap(value, snapValues){
  if(!snapValues?.length) return value;

  return snapValues.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest
  );
}

export default function RangeDensityFilter({
  label,
  values,
  snapValues,
  domainMin,
  domainMax,
  selected,
  onChange,
  formatValue = (value) => value,
  isOpen,
  onOpenChange,
}){
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const [activeThumb, setActiveThumb] = useState(null);

  const [selMin, selMax] = selected ?? [domainMin, domainMax];

  const histogram = useMemo(
    () => computeHistogram(values, domainMin, domainMax),
    [values, domainMin, domainMax]
  );

  useEffect(() => {
    if(!isOpen) return;

    const handleOutsideClick = (event) => {
      if(!wrapRef.current?.contains(event.target)){
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return() => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen, onOpenChange]);

  const getValueFromPosition = (clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();

    if(!rect || rect.width === 0){
      return domainMin;
    }

    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width)
    );

    const value = domainMin + ratio * (domainMax - domainMin);
    return nearestSnap(value, snapValues);
  };

  const startDragging = (thumb) => (event) => {
    event.stopPropagation();
    setActiveThumb(thumb);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if(!activeThumb) return;

    const value = getValueFromPosition(event.clientX);

    if(activeThumb === 'min'){
      onChange([Math.min(value, selMax), selMax]);
    } else {
      onChange([selMin, Math.max(value, selMin)]);
    }
  };

  const stopDragging = () => {
    setActiveThumb(null);
  };

  const span = Math.max(domainMax - domainMin, 1e-6);
  const minPct = Math.max(
    0,
    Math.min(100, ((selMin - domainMin) / span) * 100)
  );
  const maxPct = Math.max(
    0,
    Math.min(100, ((selMax - domainMin) / span) * 100)
  );

  const isFiltered = selected != null;

  return(
    <div className="range-density-filter" ref={wrapRef}>
      <button
        type="button"
        className={`range-density-btn ${isFiltered ? 'active' : ''}`}
        onClick={() => onOpenChange(!isOpen)}
      >
        <span>
          {isFiltered
            ? `${label}: ${formatValue(selMin)}–${formatValue(selMax)}`
            : `${label}: All`}
        </span>
        v
      </button>

      {isOpen && (
        <div className="range-density-panel">
          <div
            className="range-density-track"
            ref={trackRef}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerLeave={stopDragging}
          >
            <div className="range-density-bars">
              {histogram.map((height, index) => (
                <div
                  key={index}
                  className="range-density-bar"
                  style={{height: `${height}%`}}
                />
              ))}
            </div>

            <div
              className="range-density-dim left"
              style={{width: `${minPct}%`}}
            />

            <div
              className="range-density-dim right"
              style={{width: `${100 - maxPct}%`}}
            />

            <div
              className="range-density-handle"
              style={{left: `${minPct}%`}}
              onPointerDown={startDragging('min')}
            />

            <div
              className="range-density-handle"
              style={{left: `${maxPct}%`}}
              onPointerDown={startDragging('max')}
            />
          </div>

          <div className="range-density-axis">
            <span>{formatValue(domainMin)}</span>
            <span>{formatValue(domainMax)}</span>
          </div>

          <div className="range-density-readout">
            {formatValue(selMin)} – {formatValue(selMax)}
          </div>

          {isFiltered && (
            <button
              type="button"
              className="range-density-reset"
              onClick={() => onChange(null)}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}