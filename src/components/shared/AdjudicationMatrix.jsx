import React from 'react'
import Chip from './Chip.jsx'

/**
 * 2×2 adjudication table for B / H / IR / AR with row counts and row-%s.
 * Row % is calculated within each Di-correctness row.
 */
export default function AdjudicationMatrix({ B, H, IR, AR, N_oe_used }) {
  const wrongRow = B + IR
  const rightRow = H + AR
  const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—')

  return (
    <div className="adj-matrix-card">
      <div className="adj-matrix-title">Adjudication matrix · AI-used cases (N = {N_oe_used.toLocaleString()})</div>
      <table className="adj-table">
        <thead>
          <tr>
            <th></th>
            <th>Df ≠ Di<br/><span className="col-hdr-sub">Changed</span></th>
            <th>Df = Di<br/><span className="col-hdr-sub">Unchanged</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="row-hdr">
              Di ≠ R<br/>
              <span style={{ fontSize: 10.5, color: 'var(--txt-3)', fontStyle: 'italic', fontWeight: 500 }}>Initially wrong</span>
            </th>
            <td className="cell-count cell-b">
              <Chip kind="B">B</Chip>
              <div className="cell-count-num" style={{ marginTop: 4 }}>{B.toLocaleString()}</div>
              <span className="cell-pct">{pct(B, wrongRow)} of row</span>
            </td>
            <td className="cell-count cell-ir">
              <Chip kind="IR">IR</Chip>
              <div className="cell-count-num" style={{ marginTop: 4 }}>{IR.toLocaleString()}</div>
              <span className="cell-pct">{pct(IR, wrongRow)} of row</span>
            </td>
          </tr>
          <tr>
            <th className="row-hdr">
              Di = R<br/>
              <span style={{ fontSize: 10.5, color: 'var(--txt-3)', fontStyle: 'italic', fontWeight: 500 }}>Initially right</span>
            </th>
            <td className="cell-count cell-h">
              <Chip kind="H">H</Chip>
              <div className="cell-count-num" style={{ marginTop: 4 }}>{H.toLocaleString()}</div>
              <span className="cell-pct">{pct(H, rightRow)} of row</span>
            </td>
            <td className="cell-count cell-ar">
              <Chip kind="AR">AR</Chip>
              <div className="cell-count-num" style={{ marginTop: 4 }}>{AR.toLocaleString()}</div>
              <span className="cell-pct">{pct(AR, rightRow)} of row</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
