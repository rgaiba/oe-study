import React, { useMemo, useState } from 'react'
import { useStudy } from '../../context/StudyContext.jsx'
import { filterRows } from '../../lib/nbi.js'
import StrataFilters from './StrataFilters.jsx'
import AiUseHeatmap from './AiUseHeatmap.jsx'
import AccuracyPanel from './AccuracyPanel.jsx'
import NbiPanel from './NbiPanel.jsx'

export default function Results() {
  const { rows, filename } = useStudy()
  const [experience, setExperience] = useState(new Set())
  const [uncertainty, setUncertainty] = useState(new Set())

  const visible = useMemo(
    () => filterRows(rows, { experience, uncertainty }),
    [rows, experience, uncertainty]
  )
  const nOeUsed = useMemo(
    () => visible.reduce((acc, r) => acc + (r.oe_used === 'Yes' ? 1 : 0), 0),
    [visible]
  )

  return (
    <>
      <h1 className="page-title">Study results</h1>
      <p className="page-subtitle">
        Source: <code className="formula">{filename || 'uploaded CSV'}</code>.
        Primary outcome is the Net Beneficial Influence of voluntary AI use;
        secondary outcomes are the AI use rate by stratum and the diagnostic
        accuracy of each reader stratum versus OpenEvidence. Use the sidebar
        to filter by reader experience and question uncertainty — all panels
        recompute together.
      </p>

      <div className="results-layout">
        <StrataFilters
          experience={experience}
          setExperience={setExperience}
          uncertainty={uncertainty}
          setUncertainty={setUncertainty}
          totalRows={rows.length}
          visibleRows={visible.length}
        />

        <div className="panels">
          {/* ── Primary outcome ─────────────────────────────────────────── */}
          <section className="panel" aria-labelledby="panel-nbi-title">
            <div className="panel-header">
              <div>
                <div className="outcome-eyebrow primary"><span className="pip" aria-hidden="true" />Primary outcome</div>
                <h2 className="panel-title" id="panel-nbi-title">Net Beneficial Influence (AI-used cases)</h2>
                <p className="panel-subtitle">
                  Adjudication of Di vs Df vs R on voluntary AI-use cases. NBI is
                  the headline value with four supporting metrics; all
                  denominators use <code className="formula">N<sub>oe_used</sub></code>.
                </p>
              </div>
              <div className="panel-n">N<sub>oe_used</sub> = <strong>{nOeUsed.toLocaleString()}</strong></div>
            </div>
            <NbiPanel rows={visible} />
          </section>

          {/* ── Secondary outcome 1 ─────────────────────────────────────── */}
          <section className="panel" aria-labelledby="panel-ai-use-title">
            <div className="panel-header">
              <div>
                <div className="outcome-eyebrow secondary"><span className="pip" aria-hidden="true" />Secondary outcome · 1</div>
                <h2 className="panel-title" id="panel-ai-use-title">AI use rate</h2>
                <p className="panel-subtitle">
                  Share of questions on which the physician chose to consult
                  OpenEvidence, broken out by reader experience (rows) and
                  question uncertainty (columns).
                </p>
              </div>
              <div className="panel-n">N = <strong>{visible.length.toLocaleString()}</strong> rows</div>
            </div>
            <AiUseHeatmap rows={visible} />
          </section>

          {/* ── Secondary outcome 2 ─────────────────────────────────────── */}
          <section className="panel" aria-labelledby="panel-accuracy-title">
            <div className="panel-header">
              <div>
                <div className="outcome-eyebrow secondary"><span className="pip" aria-hidden="true" />Secondary outcome · 2</div>
                <h2 className="panel-title" id="panel-accuracy-title">Diagnostic accuracy: physicians vs OpenEvidence</h2>
                <p className="panel-subtitle">
                  Three views of the same comparison: top-1 accuracy with Wilson
                  CIs, a paired McNemar test on the same questions, and the
                  Δ-accuracy lift from voluntary AI consultation.
                </p>
              </div>
              <div className="panel-n">N = <strong>{visible.length.toLocaleString()}</strong> rows</div>
            </div>
            <AccuracyPanel rows={visible} />
          </section>
        </div>
      </div>
    </>
  )
}
