import {useCallback, useState} from 'react';
import {
  getFamilies,
  getCategories,
  getYearsForCategory,
  getFaceValuesForCategory,
  getVarietiesForCategory,
} from '../lib/catalog.js';

function SelectField({id, label, value, options, onChange}){
  const hasOptions = options.length > 0;
  const valueIsValid = Boolean(value) && options.includes(value);
  const showFallback = Boolean(value) && !valueIsValid;

  return(
    <label className="identity-field">
      <span className="identity-field-label">{label}</span>

      <select
        id={id}
        value={value || ''}
        disabled={!hasOptions && !showFallback}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {hasOptions || showFallback ? '—' : 'No options yet'}
        </option>

        {showFallback && (
          <option value={value}>
            {value} (detected)
          </option>
        )}

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CandidateExpander({label, candidates, onPick}){
  const [open, setOpen] = useState(false);

  if(!candidates?.length) return null;

  const toggleOpen = () => setOpen((current) => !current);

  return(
    <div className="candidate-expander">
      <button
        type="button"
        className="candidate-expander-toggle"
        onClick={toggleOpen}
      >
        {/* https://www.symbolcopy.com/bullet-points-symbol.html */}
        <span className="toggle-caret">
          {open ? '▼' : '►'}
        </span>
        Top {candidates.length} {label} guesses
      </button>

      {open && (
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <button
              type="button"
              key={candidate.value}
              className="candidate-row"
              onClick={() => onPick(candidate.value)}
            >
              <span className="candidate-value">
                {candidate.value}
              </span>
              <span className="candidate-conf">
                {(candidate.confidence * 100).toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CoinIdentityEditor({
  coinIdx,
  identity,
  detectedIdentity,
  candidates,
  onChange,
}){
  const family = identity?.family ?? '';
  const category = identity?.category ?? '';

  const familyOptions = getFamilies();
  const categoryOptions = getCategories(family);
  const yearOptions = getYearsForCategory(category, family);
  const faceValueOptions = getFaceValuesForCategory(category, family);
  const varietyOptions = getVarietiesForCategory(category, family);

  const setField = (field) => (value) => {
    onChange(coinIdx, {[field]: value});
  };

  const fields = ['family', 'category', 'year', 'faceValue', 'variety'];

  const isEdited =
    detectedIdentity &&
    fields.some(
      (field) =>
        (identity?.[field] ?? '') !== (detectedIdentity[field] ?? '')
    );

  return(
    <div className="identity-editor">
      {detectedIdentity && (
        <button
          type="button"
          className="identity-reset-btn"
          disabled={!isEdited}
          onClick={() => onChange(coinIdx, {...detectedIdentity})}
          title="Revert to default"
        >
          Reset to detected
        </button>
      )}

      <SelectField
        id={`family-${coinIdx}`}
        label="Family"
        value={family}
        options={familyOptions}
        onChange={setField('family')}
      />

      <CandidateExpander
        label="family"
        candidates={candidates?.family}
        onPick={setField('family')}
      />

      <SelectField
        id={`category-${coinIdx}`}
        label="Category"
        value={category}
        options={categoryOptions}
        onChange={setField('category')}
      />

      <CandidateExpander
        label="category"
        candidates={candidates?.category}
        onPick={setField('category')}
      />

      <div className="identity-field-row">
        <SelectField
          id={`year-${coinIdx}`}
          label="Year"
          value={identity?.year}
          options={yearOptions}
          onChange={setField('year')}
        />

        <SelectField
          id={`facevalue-${coinIdx}`}
          label="Face value"
          value={identity?.faceValue}
          options={faceValueOptions}
          onChange={setField('faceValue')}
        />
      </div>

      <SelectField
        id={`variety-${coinIdx}`}
        label="Variety"
        value={identity?.variety}
        options={varietyOptions}
        onChange={setField('variety')}
      />

      <CandidateExpander
        label="variety"
        candidates={candidates?.variety}
        onPick={setField('variety')}
      />
    </div>
  );
}