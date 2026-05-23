import React, { useMemo } from 'react'
import { UNCERTAINTY_LEVELS } from '../../lib/parse.js'
import { accuracyByUncertainty } from '../../lib/nbi.js'

const SERIES = [
  { key: 'Di', label: 'Initial decision (Di)',          color: '#7090b0', desc: 'all rows' },
  { key: 'Df', label: 'Final w/ AI (Df)',                color: '#16703a', desc: 'AI-used only' },
  { key: 'F',  label: 'Final no AI (F)',                 color: '#845200', desc: 'AI-declined only' },
]

const GROUP_LABEL = {
  Overall: 'Overall',
  'Guideline-Direct': 'Guideline-Direct',
  'Evidence-Equipoise': 'Evidence-Equipoise',
  'Extrapolation-Required': 'Extrapolation-Required',
}

/**
 * Grouped vertical-bar accuracy chart: one cluster per uncertainty stratum
 * plus an overall cluster. Three bars per cluster — Di, Df, F.
 *
 * Hand-rolled SVG so the bundle stays dependency-free.
 */
export default function AccuracyChart({ rows }) {
  const summary = useMemo(
    () => accuracyByUncertainty(rows, UNCERTAINTY_LEVELS),
    [rows]
  )

  const groups = ['Overall', ...UNCERTAINTY_LEVELS]
  const yMax = 100
  const margin = { top: 20, right: 16, bottom: 76, left: 44 }
  const groupW = 168
  const innerH = 220
  const width = margin.left + margin.right + groupW * groups.length
  const height = margin.top + margin.bottom + innerH
  const barW = (groupW - 24) / SERIES.length
  const yScale = v => margin.top + innerH - (v / yMax) * innerH

  return (
    <div className="accuracy-wrap">
      <svg
        className="accuracy-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Decision accuracy by stream and uncertainty stratum"
      >
        {/* Y axis gridlines & labels */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line
              x1={margin.left} x2={width - margin.right}
              y1={yScale(v)} y2={yScale(v)}
              stroke={v === 0 ? 'var(--txt-2)' : 'var(--border-soft)'}
              strokeWidth={v === 0 ? 1.2 : 1}
            />
            <text
              x={margin.left - 8}
              y={yScale(v) + 4}
              textAnchor="end"
              className="accuracy-axis-label"
            >
              {v}%
            </text>
          </g>
        ))}

        {/* Bar groups */}
        {groups.map((g, gi) => {
          const groupX = margin.left + gi * groupW + 12
          const s = summary[g]
          return (
            <g key={g}>
              {SERIES.map((series, si) => {
                const stream = s[series.key]
                const x = groupX + si * barW
                const pct = stream.pct
                const noData = pct === null
                const y = noData ? yScale(0) : yScale(pct)
                const h = noData ? 0 : (margin.top + innerH) - y
                return (
                  <g key={series.key}>
                    {!noData && (
                      <rect
                        x={x + 2} y={y}
                        width={barW - 6} height={Math.max(0, h)}
                        fill={series.color}
                        rx="2" ry="2"
                      />
                    )}
                    <text
                      x={x + (barW - 6) / 2 + 2}
                      y={(noData ? yScale(0) : y) - 4}
                      textAnchor="middle"
                      className="accuracy-bar-label"
                    >
                      {noData ? 'n/a' : `${pct.toFixed(0)}%`}
                    </text>
                    <text
                      x={x + (barW - 6) / 2 + 2}
                      y={margin.top + innerH + 14}
                      textAnchor="middle"
                      className="accuracy-axis-label"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    >
                      {stream.n > 0 ? `n=${stream.n}` : 'n=0'}
                    </text>
                  </g>
                )
              })}
              <text
                x={groupX + (groupW - 24) / 2}
                y={margin.top + innerH + 38}
                textAnchor="middle"
                className="accuracy-group-label"
              >
                {GROUP_LABEL[g]}
              </text>
            </g>
          )
        })}

        {/* X axis line */}
        <line
          x1={margin.left} x2={width - margin.right}
          y1={margin.top + innerH} y2={margin.top + innerH}
          stroke="var(--txt-2)" strokeWidth="1.2"
        />

        {/* Y axis title */}
        <text
          x={14}
          y={margin.top + innerH / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${margin.top + innerH / 2})`}
          className="accuracy-axis-label"
          style={{ fontWeight: 600 }}
        >
          Accuracy (% correct vs R)
        </text>
      </svg>

      <div className="accuracy-legend" aria-label="Series legend">
        {SERIES.map(s => (
          <span key={s.key} className="accuracy-legend-item">
            <span className="accuracy-legend-swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="accuracy-note">
        <strong>Note:</strong> <code className="formula">Df</code> and{' '}
        <code className="formula">F</code> are computed on <em>non-overlapping</em>{' '}
        populations (AI-used vs AI-declined). They are not paired streams — direct
        difference should not be interpreted causally without adjustment for self-selection.
      </div>
    </div>
  )
}
