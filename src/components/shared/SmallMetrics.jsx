import React from 'react'
import { formatMetric, formatCI, interpretMetric } from '../../lib/nbi.js'

const ITEMS = [
  { key: 'AIR', label: 'AIR — Appropriate Influence Ratio' },
  { key: 'ECR', label: 'ECR — Error Correction Rate' },
  { key: 'EIR', label: 'EIR — Error Induction Rate' },
  { key: 'DIR', label: 'DIR — Decision Influence Rate' },
]

export default function SmallMetrics({ metrics }) {
  return (
    <div className="small-metrics">
      {ITEMS.map(({ key, label }) => {
        const v = metrics[key]
        const ci = metrics[`${key}_CI`]
        return (
          <div key={key} className="small-metric">
            <div className="small-metric-label">{label}</div>
            <div className="small-metric-value">{formatMetric(key, v)}</div>
            <div className="small-metric-ci">95% CI {formatCI(key, ci) || '—'}</div>
            <div className="small-metric-note">{interpretMetric(key, v)}</div>
          </div>
        )
      })}
    </div>
  )
}
