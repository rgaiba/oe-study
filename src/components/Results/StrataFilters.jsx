import React from 'react'
import { EXPERIENCE_LEVELS, UNCERTAINTY_LEVELS } from '../../lib/parse.js'

const EXP_LABEL = {
  Fellow: 'Fellow',
  Attending_lt10: 'Attending, <10 yrs',
  Attending_gte10: 'Attending, ≥10 yrs',
}
const UNC_LABEL = {
  'Guideline-Direct': 'Guideline-Direct',
  'Evidence-Equipoise': 'Evidence-Equipoise',
  'Extrapolation-Required': 'Extrapolation-Required',
}

/**
 * Sidebar checkboxes for experience × uncertainty filtering.
 * Empty set on either axis means "all" — same semantics in lib/nbi.filterRows.
 */
export default function StrataFilters({
  experience, setExperience,
  uncertainty, setUncertainty,
  totalRows, visibleRows,
}) {
  const toggle = (set, value, setFn) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value); else next.add(value)
    setFn(next)
  }

  const reset = () => {
    setExperience(new Set())
    setUncertainty(new Set())
  }

  const anyFilter = experience.size > 0 || uncertainty.size > 0

  return (
    <aside className="filters">
      <div className="filters-card">
        <div className="filters-section">
          <div className="filters-label">Reader experience</div>
          <div className="filters-options">
            {EXPERIENCE_LEVELS.map(level => (
              <label key={level}>
                <input
                  type="checkbox"
                  checked={experience.has(level)}
                  onChange={() => toggle(experience, level, setExperience)}
                />
                {EXP_LABEL[level]}
              </label>
            ))}
          </div>
        </div>
        <div className="filters-section">
          <div className="filters-label">Question uncertainty</div>
          <div className="filters-options">
            {UNCERTAINTY_LEVELS.map(level => (
              <label key={level}>
                <input
                  type="checkbox"
                  checked={uncertainty.has(level)}
                  onChange={() => toggle(uncertainty, level, setUncertainty)}
                />
                {UNC_LABEL[level]}
              </label>
            ))}
          </div>
        </div>

        <div className="filters-meta">
          Showing <strong>{visibleRows.toLocaleString()}</strong> of{' '}
          <strong>{totalRows.toLocaleString()}</strong> rows.
          {anyFilter && (
            <div style={{ marginTop: 8 }}>
              <button className="filters-reset" type="button" onClick={reset}>
                Clear filters
              </button>
            </div>
          )}
          {!anyFilter && (
            <div style={{ marginTop: 6 }}>
              No filter selected on an axis means <em>all levels</em>.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
