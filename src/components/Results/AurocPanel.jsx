import React, { useMemo } from 'react'
import { EXPERIENCE_LEVELS } from '../../lib/parse.js'
import { aucBreakdown } from '../../lib/nbi.js'

const EXP_LABEL = {
  Fellow: 'Fellow',
  Attending_lt10: 'Attending, <10 yrs',
  Attending_gte10: 'Attending, ≥10 yrs',
}

const COLOR = {
  AI:    '#0d3a80', // navy
  Di:    '#7090b0', // slate
  Final: '#16703a', // green
}

const STREAM_LABEL = {
  AI:    'OpenEvidence (A)',
  Di:    'Initial decision (Di)',
  Final: 'Final answer (Df / F)',
}

const fmt = (v) => (v === null || v === undefined || Number.isNaN(v) ? 'n/a' : v.toFixed(3))
const fmtCI = (ci) => (ci ? `(${ci.lo.toFixed(3)} to ${ci.hi.toFixed(3)})` : '—')

/**
 * Forest plot of macro one-vs-rest AUROC for each (stratum × stream) combination
 * plus the OpenEvidence baseline. AUROC is reduced via the standard hard-label
 * identity to (sensitivity + specificity) / 2 per class, averaged across A–E.
 *
 * Layout: one row per series, AUROC point + 95% bootstrap-CI whisker. The AI
 * baseline is drawn first (reference) and again as a vertical dashed line so
 * each stratum/stream is read against it at a glance.
 */
export default function AurocPanel({ rows }) {
  const breakdown = useMemo(() => aucBreakdown(rows, EXPERIENCE_LEVELS), [rows])

  // Flatten into one row per series for the forest plot.
  const series = useMemo(() => {
    const list = [
      { kind: 'AI', label: 'OpenEvidence (A)', stratum: null, stream: 'AI',
        auc: breakdown.AI.auc, ci: breakdown.AI.ci, n: breakdown.AI.n },
    ]
    for (const s of breakdown.strata) {
      list.push({
        kind: 'physician',
        label: EXP_LABEL[s.experience],
        stratum: s.experience,
        stream: 'Di',
        auc: s.Di.auc, ci: s.Di.ci, n: s.n,
      })
      list.push({
        kind: 'physician',
        label: EXP_LABEL[s.experience],
        stratum: s.experience,
        stream: 'Final',
        auc: s.Final.auc, ci: s.Final.ci, n: s.n,
      })
    }
    return list
  }, [breakdown])

  // Forest-plot geometry. X axis is AUROC in [0.5, 1.0] — that's the meaningful
  // band for a 5-class macro reduction (0.5 = chance, 1.0 = perfect).
  const X_MIN = 0.5, X_MAX = 1.0
  const margin = { top: 28, right: 200, bottom: 56, left: 240 }
  const rowH = 34
  const innerW = 360
  const innerH = rowH * series.length
  const width = margin.left + margin.right + innerW
  const height = margin.top + margin.bottom + innerH
  const xScale = v => margin.left + ((v - X_MIN) / (X_MAX - X_MIN)) * innerW

  const ticks = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  const aiAuc = breakdown.AI.auc

  return (
    <div className="auroc-wrap">
      <svg
        className="auroc-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Macro AUROC forest plot: OpenEvidence and each physician stratum × stream"
      >
        {/* Vertical gridlines + tick labels */}
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={xScale(t)} x2={xScale(t)}
              y1={margin.top - 4} y2={margin.top + innerH}
              stroke={t === 0.5 ? 'var(--txt-2)' : 'var(--border-soft)'}
              strokeWidth={t === 0.5 ? 1.2 : 1}
            />
            <text
              x={xScale(t)}
              y={margin.top + innerH + 18}
              textAnchor="middle"
              className="auroc-axis-label"
            >
              {t.toFixed(2)}
            </text>
          </g>
        ))}

        {/* AI baseline as a dashed reference line */}
        {aiAuc !== null && (
          <line
            x1={xScale(aiAuc)} x2={xScale(aiAuc)}
            y1={margin.top - 4} y2={margin.top + innerH}
            stroke={COLOR.AI}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}

        {/* X axis title */}
        <text
          x={margin.left + innerW / 2}
          y={margin.top + innerH + 40}
          textAnchor="middle"
          className="auroc-axis-title"
        >
          Macro one-vs-rest AUROC (95% bootstrap CI)
        </text>

        {/* Series rows */}
        {series.map((s, i) => {
          const y = margin.top + i * rowH + rowH / 2
          const color = COLOR[s.stream]
          return (
            <g key={`${s.label}-${s.stream}`}>
              {/* Row label (left): label + stream subtitle */}
              <text x={margin.left - 12} y={y - 2} textAnchor="end" className="auroc-row-label">
                {s.label}
              </text>
              <text x={margin.left - 12} y={y + 12} textAnchor="end" className="auroc-row-sub">
                {s.kind === 'AI' ? `n=${s.n.toLocaleString()}` : `${STREAM_LABEL[s.stream]} · n=${s.n.toLocaleString()}`}
              </text>

              {/* CI whisker */}
              {s.ci && (
                <line
                  x1={xScale(s.ci.lo)} x2={xScale(s.ci.hi)}
                  y1={y} y2={y}
                  stroke={color}
                  strokeWidth="2"
                />
              )}
              {/* CI end caps */}
              {s.ci && (
                <>
                  <line x1={xScale(s.ci.lo)} x2={xScale(s.ci.lo)} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="2" />
                  <line x1={xScale(s.ci.hi)} x2={xScale(s.ci.hi)} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="2" />
                </>
              )}
              {/* AUC point */}
              {s.auc !== null && (
                <circle
                  cx={xScale(Math.max(X_MIN, Math.min(X_MAX, s.auc)))}
                  cy={y}
                  r={s.kind === 'AI' ? 5 : 4}
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                />
              )}

              {/* AUROC value + CI text (right) */}
              <text
                x={margin.left + innerW + 8}
                y={y + 4}
                className="auroc-value-text"
              >
                {fmt(s.auc)} <tspan className="auroc-value-ci">{fmtCI(s.ci)}</tspan>
              </text>
            </g>
          )
        })}

        {/* Top axis label */}
        <text
          x={margin.left}
          y={margin.top - 12}
          className="auroc-axis-label"
        >
          0.5 = chance
        </text>
        <text
          x={margin.left + innerW}
          y={margin.top - 12}
          textAnchor="end"
          className="auroc-axis-label"
        >
          1.0 = perfect
        </text>
      </svg>

      <div className="auroc-legend" aria-label="Stream legend">
        <span className="auroc-legend-item">
          <span className="auroc-legend-swatch" style={{ background: COLOR.AI }} />
          {STREAM_LABEL.AI} (reference)
        </span>
        <span className="auroc-legend-item">
          <span className="auroc-legend-swatch" style={{ background: COLOR.Di }} />
          {STREAM_LABEL.Di}
        </span>
        <span className="auroc-legend-item">
          <span className="auroc-legend-swatch" style={{ background: COLOR.Final }} />
          {STREAM_LABEL.Final}
        </span>
      </div>

      <div className="auroc-note">
        <strong>Method:</strong> per-question correctness over the five answer
        classes (A–E). For each class the one-vs-rest ROC has a single threshold
        (the hard pick), so AUC reduces algebraically to
        <code className="formula">(sensitivity + specificity) / 2</code>, then
        averaged across the five classes (macro AUROC). 95% CI by percentile
        bootstrap over rows (B = 500). The Final stream combines{' '}
        <code className="formula">Df</code> (AI-used rows) and{' '}
        <code className="formula">F</code> (AI-declined rows), reflecting each
        physician's real-world final answer.
      </div>
    </div>
  )
}
