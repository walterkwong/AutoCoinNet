import {useEffect, useRef} from 'react';

export default function CoinMultiSelect({
  options,
  selected,
  onChange,
  isOpen,
  onOpenChange,
}){
  const wrapRef = useRef(null);
  const panelRef = useRef(null);

  const open = isOpen;

  // preserve open state
  const setOpen = (next) => {
    const value = typeof next === 'function' ? next(open) : next;
    onOpenChange?.(value);
  };

  useEffect(() => {
    if(!open) return;

    const handleDocumentPointerDown = (event) => {
      if(wrapRef.current && !wrapRef.current.contains(event.target)){
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);

    return() => {
      document.removeEventListener(
        'pointerdown',
        handleDocumentPointerDown
      );
    };
  }, [open]);

  useEffect(() => {
    if(!open) return;

    const panel = panelRef.current;
    const wrap = wrapRef.current;

    if(!panel || !wrap) return;

    // reposition panel if out of viewport (mobiles smh)
    const repositionPanel = () => {
      const margin = 8;

      panel.style.left = '';
      panel.style.right = '';
      panel.style.transform = '';

      const wrapRect = wrap.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      const maxLeft =
        window.innerWidth - panelRect.width - margin;

      let left = panelRect.left;

      if(left > maxLeft){
        left = maxLeft;
      }

      if(left < margin){
        left = margin;
      }

      // Keep the panel inside the viewport on smaller screens.
      panel.style.transform = 'none';
      panel.style.left = `${left - wrapRect.left}px`;
    };

    repositionPanel();

    window.addEventListener('resize', repositionPanel);

    return() => {
      window.removeEventListener('resize', repositionPanel);
    };
  }, [open]);

  const toggleSelection = (name) => {
    const next = new Set(selected);

    if(next.has(name)){
      next.delete(name);
    } else {
      next.add(name);
    }

    onChange(next);
  };

  let label = 'Coin / variety: All';

  if(selected.size === 1){
    label = `Coin / variety: ${[...selected][0]}`;
  } else if(selected.size > 1){
    label = `Coin / variety: ${selected.size} selected`;
  }

  return(
    <div className="coin-multiselect" ref={wrapRef}>
      <button
        type="button"
        className={`range-density-btn${selected.size > 0 ? ' active' : ''}`}
        onClick={() => setOpen((current) => !current)}
      >
        {/* https://www.symbolcopy.com/bullet-points-symbol.html */}
        {label}
        <span className="toggle-caret">
          {open ? '▼' : '►'}
        </span>
      </button>

      {open && (
        <div
          className="coin-multiselect-panel"
          ref={panelRef}
        >
          {options.length === 0 && (
            <div className="coin-multiselect-empty">
              No coins to filter by
            </div>
          )}

          {options.map((option) => (
            <label
              className="coin-multiselect-row"
              key={option.name}
            >
              <input
                type="checkbox"
                checked={selected.has(option.name)}
                onChange={() => toggleSelection(option.name)}
              />

              <span className="coin-multiselect-name">
                {option.name}
              </span>

              <span className="coin-multiselect-count">
                {option.count}
              </span>
            </label>
          ))}

          {selected.size > 0 && (
            <button
              type="button"
              className="range-density-reset coin-multiselect-clear"
              onClick={() => onChange(new Set())}
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}