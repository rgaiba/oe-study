import React from 'react'
import { formatMetric, formatCI } from '../../lib/nbi.js'

export default function NbiHero({ NBI, NBI_CI, N_oe_used }) {
  const tone = NBI === null ? 'zero' : NBI > 0 ? 'pos' : NBI < 0 ? 'neg' : 'zero'
  const sign = NBI !== null && NBI > 0 ? '+' : ''
  return (
    <div className="nbi-hero">
      <div className="nbi-hero-eyebrow">Net Beneficial Influence</div>
      <div className={`nbi-hero-value ${tone}`}>
        {NBI === null ? 'n/a' : `${sign}${NBI.toFixed(1)}%`}
      </div>
      <div className="nbi-hero-ci">
        95% CI {formatCI('NBI', NBI_CI) || '—'}
      </div>
      <div className="nbi-hero-formula">
        (B − H) / N · 100 &nbsp;·&nbsp; N = {N_oe_used.toLocaleString()}
      </div>
    </div>
  )
}
