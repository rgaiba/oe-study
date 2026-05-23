import React, { useMemo } from 'react'
import { EXPERIENCE_LEVELS } from '../../lib/parse.js'
import { accuracyBreakdown, mcnemarBreakdown, liftBreakdown } from '../../lib/nbi.js'

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

const pct = (v) => (v === null || v === undefined || Number.isNaN(v) ? 'n/a' : `${(v * 100).toFixed(1)}%`)
const pctSigned = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return 'n/a'
  const x = v * 100
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(1)} pp`
}
const ciPctRange = (ci) => (ci ? `(${(ci.lo * 100).toFixed(1)} to ${(ci.hi * 100).toFixed(1)})` : '—')
const ciPctSigned = (ci) => {
  if (!ci) return '—'
  const lo = ci.lo * 100, hi = ci.hi * 100
  const s = (n) => (n > 0 ? '+' : '') + n.toFixed(1)
  return `(${s(lo)} to ${s(hi)})`
}
const formatP = (p) => {
  if (p === null || p === undefined) return '—'
  if (p < 0.001) return 'p < 0.001'
  if (p < 0.01) return `p = ${p.toFixed(3)}`
  return `p = ${p.toFixed(2)}`
}
const formatOR = (or) => {
  if (or === null || or === undefined) return '—'
  return or.toFixed(2)
}

// ─── Sub-component: top-1 accuracy forest plot ──────────────────────────────
function AccuracyForest({ rows }) {
  const breakdown = useMemo(() => accuracyBreakdown(rows, EXPERIENCE_LEVELS), [rows])

  const series = useMemo(() => {
    const list = [{
      kind: 'AI', label: STREAM_LABEL.AI, stream: 'AI',
      p: breakdown.AI.p, ci: breakdown.AI.ci, n: breakdown.AI.n, k: breakdown.AI.k,
    }]
    for (const s of breakdown.strata) {
      list.push({ kind: 'physician', label: EXP_LABEL[s.experience], stream: 'Di',
        p: s.Di.p, ci: s.Di.ci, n: s.Di.n, k: s.Di.k })
      list.push({ kind: 'physician', label: EXP_LABEL[s.experience], stream: 'Final',
        p: s.Final.p, ci: s.Final.ci, n: s.Final.n, k: s.Final.k })
    }
    return list
  }, [breakdown])

  const X_MIN = 0, X_MAX = 1
  const margin = { top: 28, right: 200, bottom: 56, left: 240 }
  const rowH = 34
  const innerW = 360
  const innerH = rowH * series.length
  const width = margin.left + margin.right + innerW
  const height = margin.top + margin.bottom + innerH
  const xScale = v => margin.left + ((v - X_MIN) / (X_MAX - X_MIN)) * innerW
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const aiP = breakdown.AI.p

  return (
    <div className="auroc-wrap">
      <svg
        className="auroc-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Top-1 accuracy forest plot: OpenEvidence and each physician stratum × stream"
      >
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={xScale(t)} x2={xScale(t)}
              y1={margin.top - 4} y2={margin.top + innerH}
              stroke={t === 0 ? 'var(--txt-2)' : 'var(--border-soft)'}
              strokeWidth={t === 0 ? 1.2 : 1}
            />
            <text
              x={xScale(t)} y={margin.top + innerH + 18}
              textAnchor="middle" className="auroc-axis-label"
            >
              {(t * 100).toFixed(0)}%
            </text>
          </g>
        ))}

        {aiP !== null && (
          <line
            x1={xScale(aiP)} x2={xScale(aiP)}
            y1={margin.top - 4} y2={margin.top + innerH}
            stroke={COLOR.AI} strokeWidth="1.5" strokeDasharray="4 4"
          />
        )}

        <text
          x={margin.left + innerW / 2} y={margin.top + innerH + 40}
          textAnchor="middle" className="auroc-axis-title"
        >
          Top-1 accuracy (% correct vs reference R, Wilson 95% CI)
        </text>

        {series.map((s, i) => {
          const y = margin.top + i * rowH + rowH / 2
          const color = COLOR[s.stream]
          return (
            <g key={`${s.label}-${s.stream}`}>
              <text x={margin.left - 12} y={y - 2} textAnchor="end" className="auroc-row-label">
                {s.label}
              </text>
              <text x={margin.left - 12} y={y + 12} textAnchor="end" className="auroc-row-sub">
                {s.kind === 'AI'
                  ? `n=${s.n.toLocaleString()}`
                  : `${STREAM_LABEL[s.stream]} · n=${s.n.toLocaleString()}`}
              </text>

              {s.ci && (
                <>
                  <line x1={xScale(s.ci.lo)} x2={xScale(s.ci.hi)} y1={y} y2={y} stroke={color} strokeWidth="2" />
                  <line x1={xScale(s.ci.lo)} x2={xScale(s.ci.lo)} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="2" />
                  <line x1={xScale(s.ci.hi)} x2={xScale(s.ci.hi)} y1={y - 5} y2={y + 5} stroke={color} strokeWidth="2" />
                </>
              )}
              {s.p !== null && (
                <circle
                  cx={xScale(s.p)} cy={y}
                  r={s.kind === 'AI' ? 5 : 4}
                  fill={color} stroke="white" strokeWidth="1.5"
                />
              )}

              <text x={margin.left + innerW + 8} y={y + 4} className="auroc-value-text">
                {pct(s.p)} <tspan className="auroc-value-ci">{ciPctRange(s.ci)}</tspan>
              </text>
            </g>
          )
        })}

        <text x={margin.left} y={margin.top - 12} className="auroc-axis-label">0% = none</text>
        <text x={margin.left + innerW} y={margin.top - 12} textAnchor="end" className="auroc-axis-label">100% = perfect</text>
      </svg>

      <div className="auroc-legend" aria-label="Stream legend">
        <span className="auroc-legend-item"><span className="auroc-legend-swatch" style={{ background: COLOR.AI }} />{STREAM_LABEL.AI} (reference)</span>
        <span className="auroc-legend-item"><span className="auroc-legend-swatch" style={{ background: COLOR.Di }} />{STREAM_LABEL.Di}</span>
        <span className="auroc-legend-item"><span className="auroc-legend-swatch" style={{ background: COLOR.Final }} />{STREAM_LABEL.Final}</span>
      </div>
    </div>
  )
}

// ─── Sub-component: paired McNemar table ────────────────────────────────────
function McnemarTable({ rows }) {
  const breakdown = useMemo(() => mcnemarBreakdown(rows, EXPERIENCE_LEVELS), [rows])
  return (
    <div className="mcnemar-card">
      <div className="mcnemar-title">
        Paired comparison vs OpenEvidence (McNemar, same questions)
      </div>
      <table className="mcnemar-table">
        <thead>
          <tr>
            <th className="row-hdr">Stratum</th>
            <th>Stream</th>
            <th title="Physician right · AI right">a</th>
            <th title="Physician right · AI wrong">b</th>
            <th title="Physician wrong · AI right">c</th>
            <th title="Physician wrong · AI wrong">d</th>
            <th>OR (b/c)</th>
            <th>p (mid-exact)</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map(s => (
            <React.Fragment key={s.experience}>
              <tr>
                <td className="row-hdr" rowSpan="2">{EXP_LABEL[s.experience]}<br/><span className="row-sub">n = {s.n.toLocaleString()}</span></td>
                <td className="stream-cell">{STREAM_LABEL.Di}</td>
                <td className="num">{s.Di.a}</td>
                <td className="num pos">{s.Di.b}</td>
                <td className="num neg">{s.Di.c}</td>
                <td className="num">{s.Di.d}</td>
                <td className="num strong">{formatOR(s.Di.or)}</td>
                <td className="num">{formatP(s.Di.p)}</td>
              </tr>
              <tr className="row-final">
                <td className="stream-cell">{STREAM_LABEL.Final}</td>
                <td className="num">{s.Final.a}</td>
                <td className="num pos">{s.Final.b}</td>
                <td className="num neg">{s.Final.c}</td>
                <td className="num">{s.Final.d}</td>
                <td className="num strong">{formatOR(s.Final.or)}</td>
                <td className="num">{formatP(s.Final.p)}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mcnemar-legend">
        <span><span className="dot pos" />b = physician right, AI wrong</span>
        <span><span className="dot neg" />c = physician wrong, AI right</span>
        <span>OR &gt; 1 favors physician; OR &lt; 1 favors AI</span>
      </div>
    </div>
  )
}

// ─── Sub-component: Δ-accuracy lift bars ────────────────────────────────────
function LiftBars({ rows }) {
  const breakdown = useMemo(() => liftBreakdown(rows, EXPERIENCE_LEVELS), [rows])

  // Geometry: per stratum, three horizontal bars (overall, AI used, AI declined),
  // diverging from a 0 line at center. Bar value is mean Δ in percentage points.
  const X_RANGE = 0.30 // ±30 pp window
  const margin = { top: 28, right: 200, bottom: 40, left: 200 }
  const rowH = 26
  const groupGap = 24
  const groupTitleH = 22
  const innerW = 320
  const seriesPerGroup = 3
  const innerH = breakdown.length * (rowH * seriesPerGroup + groupTitleH + groupGap) - groupGap
  const width = margin.left + margin.right + innerW
  const height = margin.top + margin.bottom + innerH
  const xScale = v => margin.left + ((v + X_RANGE) / (X_RANGE * 2)) * innerW
  const xZero = xScale(0)
  const ticks = [-0.30, -0.15, 0, 0.15, 0.30]

  const SUB_COLOR = {
    overall:    '#0d3a80',
    aiUsed:     '#16703a',
    aiDeclined: '#845200',
  }
  const SUB_LABEL = {
    overall:    'All rows',
    aiUsed:     'AI used (Df vs Di)',
    aiDeclined: 'AI declined (F vs Di)',
  }

  return (
    <div className="lift-wrap">
      <svg
        className="auroc-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Δ-accuracy bars per stratum, split by AI use"
      >
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={xScale(t)} x2={xScale(t)}
              y1={margin.top - 4} y2={margin.top + innerH}
              stroke={t === 0 ? 'var(--txt-2)' : 'var(--border-soft)'}
              strokeWidth={t === 0 ? 1.4 : 1}
            />
            <text x={xScale(t)} y={margin.top + innerH + 18}
                  textAnchor="middle" className="auroc-axis-label">
              {t > 0 ? '+' : ''}{(t * 100).toFixed(0)} pp
            </text>
          </g>
        ))}

        <text x={margin.left + innerW / 2} y={margin.top + innerH + 34}
              textAnchor="middle" className="auroc-axis-title">
          Δ accuracy (Final − Initial), percentage points · 95% CI
        </text>

        {breakdown.map((s, gi) => {
          const groupY = margin.top + gi * (rowH * seriesPerGroup + groupTitleH + groupGap)
          const barsY = groupY + groupTitleH
          const subs = [
            { key: 'overall',    data: s.overall },
            { key: 'aiUsed',     data: s.aiUsed },
            { key: 'aiDeclined', data: s.aiDeclined },
          ]
          return (
            <g key={s.experience}>
              {/* Stratum title sits ABOVE the three bars to avoid overlapping
                  the first sub-label. */}
              <text x={margin.left - 12} y={groupY + groupTitleH - 6}
                    textAnchor="end" className="auroc-row-label">
                {EXP_LABEL[s.experience]} · n={s.n.toLocaleString()}
              </text>
              {subs.map((sub, si) => {
                const y = barsY + si * rowH + rowH / 2
                const color = SUB_COLOR[sub.key]
                const d = sub.data
                const mean = d.mean
                const ci = d.ci
                if (d.n === 0 || mean === null) {
                  return (
                    <text key={sub.key} x={xZero + 6} y={y + 4}
                          className="auroc-axis-label" style={{ fontStyle: 'italic' }}>
                      no data
                    </text>
                  )
                }
                const meanX = xScale(Math.max(-X_RANGE, Math.min(X_RANGE, mean)))
                const barX0 = Math.min(xZero, meanX)
                const barW = Math.abs(meanX - xZero)
                return (
                  <g key={sub.key}>
                    <text x={margin.left - 12} y={y + 4}
                          textAnchor="end" className="auroc-row-sub">
                      {SUB_LABEL[sub.key]} · n={d.n.toLocaleString()}
                    </text>
                    {/* Bar from 0 to mean */}
                    <rect x={barX0} y={y - 5} width={barW} height={10}
                          fill={color} opacity="0.85" rx="1.5" />
                    {/* CI whisker (clipped) */}
                    {ci && (
                      <>
                        <line x1={xScale(Math.max(-X_RANGE, ci.lo))} x2={xScale(Math.min(X_RANGE, ci.hi))}
                              y1={y} y2={y} stroke={color} strokeWidth="2" />
                        <line x1={xScale(Math.max(-X_RANGE, ci.lo))} x2={xScale(Math.max(-X_RANGE, ci.lo))}
                              y1={y - 5} y2={y + 5} stroke={color} strokeWidth="2" />
                        <line x1={xScale(Math.min(X_RANGE, ci.hi))} x2={xScale(Math.min(X_RANGE, ci.hi))}
                              y1={y - 5} y2={y + 5} stroke={color} strokeWidth="2" />
                      </>
                    )}
                    {/* Value text on the right */}
                    <text x={margin.left + innerW + 8} y={y + 4} className="auroc-value-text">
                      {pctSigned(mean)} <tspan className="auroc-value-ci">{ciPctSigned(ci)}</tspan>
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Main panel ────────────────────────────────────────────────────────────
export default function AccuracyPanel({ rows }) {
  return (
    <>
      <div className="accuracy-sub-header">Top-1 accuracy</div>
      <AccuracyForest rows={rows} />

      <div className="accuracy-sub-header">Paired comparison vs OpenEvidence (McNemar)</div>
      <McnemarTable rows={rows} />

      <div className="accuracy-sub-header">Lift from voluntary AI use (Δ accuracy)</div>
      <LiftBars rows={rows} />

      <div className="auroc-note">
        <strong>Method:</strong> top-1 accuracy uses Wilson 95% CIs on the
        binomial proportion of correct picks. The paired McNemar table pairs
        each row with the AI's pick on the same question, then reports the
        odds ratio of discordant cells (b ÷ c, Haldane–Anscombe corrected when
        a cell is 0) and the two-sided exact mid-p value. The Δ-accuracy bars
        are mean per-row change Final − Initial (each row contributes one of
        −1, 0, or +1), normal-approx 95% CI; split by whether AI was actually
        consulted on that row.
      </div>
    </>
  )
}
