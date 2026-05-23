import React, { useMemo } from 'react'
import { aggregate, computeMetrics } from '../../lib/nbi.js'
import AdjudicationMatrix from '../shared/AdjudicationMatrix.jsx'
import NbiHero from '../shared/NbiHero.jsx'
import SmallMetrics from '../shared/SmallMetrics.jsx'

export default function NbiPanel({ rows }) {
  const counts = useMemo(() => aggregate(rows), [rows])
  const metrics = useMemo(() => computeMetrics(counts), [counts])

  return (
    <div className="nbi-panel-grid">
      <div className="nbi-matrix-wrap">
        <AdjudicationMatrix
          B={counts.B}
          H={counts.H}
          IR={counts.IR}
          AR={counts.AR}
          N_oe_used={counts.N_oe_used}
        />
      </div>
      <div className="nbi-hero-wrap">
        <NbiHero
          NBI={metrics.NBI}
          NBI_CI={metrics.NBI_CI}
          N_oe_used={metrics.N_oe_used}
        />
        <SmallMetrics metrics={metrics} />
      </div>
    </div>
  )
}
