import {useMemo, useRef, useState} from 'react';

const HEIGHT = 200;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;

export default function GradeDensityChart({distribution}){
  const svgRef = useRef(null);
  const [range, setRange] = useState(null);
  const [drag, setDrag] = useState(null);

  const full = useMemo(
    () => [...(distribution ?? [])].sort((a, b) => a.grade - b.grade),
    [distribution]
  );

  const visible = useMemo(() => {
    if(!range) return full;

    return full.filter(
      (item) =>
        item.grade >= range[0] &&
        item.grade <= range[1]
    );
  }, [full, range]);

  if(full.length === 0) return null;

  const count = visible.length;
  const maxConfidence = Math.max(
    ...visible.map((item) => item.confidence),
    1e-6
  );

  const gapPct =
    count > 1 ? Math.min(0.6, 12 / count) : 0;

  const barWidth =
    (100 - gapPct * (count - 1)) / count;

  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const getX = (index) =>
    index * (barWidth + gapPct);

  const getBarHeight = (confidence) =>
    Math.max(
      1,
      (confidence / maxConfidence) * plotHeight
    );

  const getY = (confidence) =>
    HEIGHT - PAD_BOTTOM - getBarHeight(confidence);

  const labelStride =
    count <= 20 ? 1 : Math.ceil(count / 20);

  const getFraction = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();

    if(!rect || rect.width === 0) return 0;

    return Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width)
    );
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);

    // Store both ends of the drag so we can turn it into a grade range later.
    setDrag({
      startX: event.clientX,
      currentX: event.clientX,
    });
  };

  const handlePointerMove = (event) => {
    if(!drag) return;

    setDrag((current) => ({
      ...current,
      currentX: event.clientX,
    }));
  };

  const handlePointerUp = () => {
    if(!drag) return;

    const startFraction = getFraction(drag.startX);
    const endFraction = getFraction(drag.currentX);

    setDrag(null);

    // Ignore clicks; only treat an actual drag as a zoom selection.
    if(Math.abs(endFraction - startFraction) < 0.02){
      return;
    }

    const firstIndex = Math.round(
      Math.min(startFraction, endFraction) * (count - 1)
    );

    const lastIndex = Math.round(
      Math.max(startFraction, endFraction) * (count - 1)
    );

    if(
      lastIndex > firstIndex &&
      visible[firstIndex] &&
      visible[lastIndex]
    ){
      setRange([
        visible[firstIndex].grade,
        visible[lastIndex].grade,
      ]);
    }
  };

  const dragBox =
    drag && Math.abs(drag.currentX - drag.startX) > 3
      ? {
          start:
            getFraction(
              Math.min(drag.startX, drag.currentX)
            ) * 100,
          end:
            getFraction(
              Math.max(drag.startX, drag.currentX)
            ) * 100,
        }
      : null;

  return(
    <div className="grade-density-wrap">
      <svg
        ref={svgRef}
        className="grade-density-svg"
        width="100%"
        height={HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <linearGradient
            id="grade-bar-grad"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#E8C868" />
            <stop offset="100%" stopColor="#7A5C2E" />
          </linearGradient>
        </defs>

        <line
          x1="0"
          y1={HEIGHT - PAD_BOTTOM}
          x2="100%"
          y2={HEIGHT - PAD_BOTTOM}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {visible.map((item, index) => (
          <rect
            key={item.grade}
            x={`${getX(index)}%`}
            width={`${Math.max(barWidth, 0.3)}%`}
            y={getY(item.confidence)}
            height={getBarHeight(item.confidence)}
            rx="1"
            fill="url(#grade-bar-grad)"
          />
        ))}

        {visible.map((item, index) =>
          index % labelStride === 0 ? (
            <text
              key={`label-${item.grade}`}
              x={`${getX(index) + barWidth / 2}%`}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="grade-density-label"
            >
              {item.grade}
            </text>
          ) : null
        )}

        {dragBox && (
          <rect
            x={`${dragBox.start}%`}
            width={`${dragBox.end - dragBox.start}%`}
            y="0"
            height={HEIGHT}
            className="grade-density-drag-box"
          />
        )}
      </svg>

      <div className="grade-density-footer">
        <span className="grade-density-hint">
          Drag to zoom
        </span>

        {range && (
          <button
            type="button"
            className="grade-density-reset"
            onClick={() => setRange(null)}
          >
            Show all grades
          </button>
        )}
      </div>
    </div>
  );
}