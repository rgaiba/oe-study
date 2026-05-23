import React, { useMemo, useState } from 'react'
import { useStudy } from '../../context/StudyContext.jsx'
import { filterRows } from '../../lib/nbi.js'
import StrataFilters from './StrataFilters.jsx'
import AiUseHeatmap from './AiUseHeatmap.jsx'
import AccuracyChart from './AccuracyChart.jsx'
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
        Three panels: AI use rate by stratum, accuracy by decision stream, and the
        Net Beneficial Influence breakdown on voluntary AI-use cases. Use the
        sidebar to filter by reader experience and question uncertainty — all
        panels recompute together.
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
          <section className="panel" aria-labelledby="panel-4a-title">
            <div className="panel-header">
              <div>
                <div className="panel-eyebrow">Panel 4a</div>
                <h2 className="panel-title" id="panel-4a-title">AI use rate</h2>
                <p className="panel-subtitle">
                  Share of questions on which the physician chose to consult
                  OpenEvidence, broken out by experience (rows) and uncertainty (columns).
                </p>
              </div>
              <div className="panel-n">N = <strong>{visible.length.toLocaleString()}</strong> rows</div>
            </div>
            <AiUseHeatmap rows={visible} />
          </section>

          <section className="panel" aria-labelledby="panel-4b-title">
            <div className="panel-header">
              <div>
                <div className="panel-eyebrow">Panel 4b</div>
                <h2 className="panel-title" id="panel-4b-title">Effect of voluntary AI use on accuracy</h2>
                <p className="panel-subtitle">
                  Three decision streams: initial decision (Di, all rows), final
                  with AI (Df, AI-used only), final without AI (F, AI-declined only).
                </p>
              </div>
              <div className="panel-n">N = <strong>{visible.length.toLocaleString()}</strong> rows</div>
            </div>
            <AccuracyChart rows={visible} />
          </section>

          <section className="panel" aria-labelledby="panel-4c-title">
            <div className="panel-header">
              <div>
                <div className="panel-eyebrow">Panel 4c</div>
                <h2 className="panel-title" id="panel-4c-title">Net influence breakdown (AI-used cases only)</h2>
                <p className="panel-subtitle">
                  Adjudication matrix on Di vs Df vs R, the Net Beneficial Influence
                  hero, and four supporting metrics. All denominators use{' '}
                  <code className="formula">N<sub>oe_used</sub></code>.
                </p>
              </div>
              <div className="panel-n">N<sub>oe_used</sub> = <strong>{nOeUsed.toLocaleString()}</strong></div>
            </div>
            <NbiPanel rows={visible} />
          </section>
        </div>
      </div>
    </>
  )
}
