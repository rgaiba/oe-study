import React, { useMemo } from 'react'
import { EXPERIENCE_LEVELS, UNCERTAINTY_LEVELS } from '../../lib/parse.js'
import { aiUseMatrix } from '../../lib/nbi.js'

const EXP_LABEL = {
  Fellow: 'Fellow',
  Attending_lt10: 'Att. <10y',
  Attending_gte10: 'Att. ≥10y',
}
const UNC_LABEL = {
  'Guideline-Direct': 'Guideline-Direct',
  'Evidence-Equipoise': 'Evidence-Equipoise',
  'Extrapolation-Required': 'Extrapolation',
}

// Linear interpolation through three palette stops:
//   light blue (#eaf1fb) → mid blue (#4278cc) → deep navy (#0d3a80).
function colorForPct(pct) {
  if (pct === null || Number.isNaN(pct)) return '#f4f7fb'
  const t = Math.max(0, Math.min(1, pct / 100))
  const stops = [
    { t: 0.0, c: [234, 241, 251] },
    { t: 0.5, c: [66, 120, 204] },
    { t: 1.0, c: [13, 58, 128] },
  ]
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) { lo = stops[i]; hi = stops[i + 1]; break }
  }
  const span = hi.t - lo.t || 1
  const k = (t - lo.t) / span
  const rgb = lo.c.map((v, i) => Math.round(v + (hi.c[i] - v) * k))
  return `rgb(${rgb.join(',')})`
}

// Text contrast: white once the cell crosses ~45% saturation.
function textColorForPct(pct) {
  if (pct === null || Number.isNaN(pct)) return 'var(--txt-3)'
  return pct >= 45 ? '#ffffff' : '#16223a'
}

/**
 * 3×3 SVG heatmap of AI use rate. Rows = physician experience,
 * columns = question uncertainty. Each cell labels its percentage and
 * (used / n). Axes are titled with eyebrow-style uppercase labels.
 */
export default function AiUseHeatmap({ rows }) {
  const cells = useMemo(
    () => aiUseMatrix(rows, EXPERIENCE_LEVELS, UNCERTAINTY_LEVELS),
    [rows]
  )

  const cellW = 168, cellH = 92
  const leftPad = 110, topPad = 56
  const rightPad = 16, bottomPad = 56
  const width = leftPad + cellW * UNCERTAINTY_LEVELS.length + rightPad
  const height = topPad + cellH * EXPERIENCE_LEVELS.length + bottomPad

  return (
    <div className="heatmap-wrap">
      <svg
        className="heatmap-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="AI use rate by physician experience and question uncertainty"
      >
        {/* Column axis title */}
        <text
          x={leftPad + (cellW * UNCERTAINTY_LEVELS.length) / 2}
          y={20}
          textAnchor="middle"
          className="heatmap-axis-title"
        >
          Question uncertainty
        </text>
        {/* Column headers */}
        {UNCERTAINTY_LEVELS.map((unc, j) => (
          <text
            key={unc}
            x={leftPad + cellW * j + cellW / 2}
            y={topPad - 10}
            textAnchor="middle"
            className="heatmap-axis-label"
          >
            {UNC_LABEL[unc]}
          </text>
        ))}

        {/* Row axis title (rotated) */}
        <text
          x={20}
          y={topPad + (cellH * EXPERIENCE_LEVELS.length) / 2}
          textAnchor="middle"
          transform={`rotate(-90 20 ${topPad + (cellH * EXPERIENCE_LEVELS.length) / 2})`}
          className="heatmap-axis-title"
        >
          Reader experience
        </text>
        {/* Row headers */}
        {EXPERIENCE_LEVELS.map((exp, i) => (
          <text
            key={exp}
            x={leftPad - 10}
            y={topPad + cellH * i + cellH / 2 + 4}
            textAnchor="end"
            className="heatmap-axis-label"
          >
            {EXP_LABEL[exp]}
          </text>
        ))}

        {/* Cells */}
        {cells.map((row, i) => row.map((c, j) => {
          const x = leftPad + cellW * j
          const y = topPad + cellH * i
          const fill = colorForPct(c.pct)
          const fg = textColorForPct(c.pct)
          const subFg = c.pct !== null && c.pct >= 45 ? 'rgba(255,255,255,0.85)' : 'var(--txt-3)'
          return (
            <g key={`${i}-${j}`}>
              <rect
                x={x + 2} y={y + 2}
                width={cellW - 4} height={cellH - 4}
                rx="6" ry="6"
                fill={fill}
                stroke="rgba(15,30,60,0.10)"
                strokeWidth="1"
              />
              <text
                x={x + cellW / 2}
                y={y + cellH / 2 - 2}
                textAnchor="middle"
                className="heatmap-cell-label"
                fill={fg}
              >
                {c.pct === null ? 'n/a' : `${c.pct.toFixed(0)}%`}
              </text>
              <text
                x={x + cellW / 2}
                y={y + cellH / 2 + 16}
                textAnchor="middle"
                className="heatmap-cell-sub"
                fill={subFg}
              >
                {c.used.toLocaleString()} / {c.n.toLocaleString()}
              </text>
            </g>
          )
        }))}
      </svg>

      <div className="heatmap-legend">
        <span>0%</span>
        <span className="heatmap-legend-bar" aria-hidden="true" />
        <span>100% — AI use rate (oe_used = Yes)</span>
      </div>
    </div>
  )
}
