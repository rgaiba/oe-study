import React, { useCallback, useRef, useState } from 'react'
import { parseCsv, validateRows, templateCsv, REQUIRED_COLUMNS } from '../../lib/parse.js'
import { useStudy } from '../../context/StudyContext.jsx'

const SAMPLE_HREF = `${import.meta.env.BASE_URL || './'}sample_data.csv`

export default function Upload() {
  const { loadRows, hasData, filename: loadedName, rows: loadedRows } = useStudy()
  const [dragOver, setDragOver] = useState(false)
  const [errors, setErrors] = useState([])
  const [processing, setProcessing] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    setProcessing(true)
    setErrors([])
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = String(e.target.result || '')
        const parsed = parseCsv(text)
        const { ok, rows, errors: errs } = validateRows(parsed)
        if (!ok) {
          setErrors(errs)
          setProcessing(false)
          return
        }
        loadRows(rows, file.name)
        setProcessing(false)
      } catch (err) {
        setErrors([{ row: 0, message: `Failed to parse CSV: ${err.message}` }])
        setProcessing(false)
      }
    }
    reader.onerror = () => {
      setErrors([{ row: 0, message: 'Failed to read file.' }])
      setProcessing(false)
    }
    reader.readAsText(file)
  }, [loadRows])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) handleFile(f)
  }

  const onPickFile = () => inputRef.current?.click()

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oe_study_template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const loadSample = async () => {
    setProcessing(true)
    setErrors([])
    try {
      const resp = await fetch(SAMPLE_HREF)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      const parsed = parseCsv(text)
      const { ok, rows, errors: errs } = validateRows(parsed)
      if (!ok) { setErrors(errs); setProcessing(false); return }
      loadRows(rows, 'sample_data.csv')
    } catch (err) {
      setErrors([{ row: 0, message: `Could not load sample_data.csv: ${err.message}` }])
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <h1 className="page-title">OpenEvidence Study analysis platform</h1>
      <p className="page-subtitle">
        Upload the per-question response CSV from the cardiology decision-making study.
        The platform validates the schema, adjudicates voluntary AI-use cases against the
        reference standard, and breaks out AI use rate, accuracy effects, and Net Beneficial
        Influence across reader experience and question uncertainty strata.
      </p>

      <div className="upload-layout">
        <div>
          <div
            className={`dropzone ${dragOver ? 'is-dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={onPickFile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickFile() } }}
            aria-label="Drop CSV here or click to choose a file"
          >
            <div className="dropzone-icon" aria-hidden="true">CSV</div>
            <div className="dropzone-title">Drop the study CSV here</div>
            <div className="dropzone-sub">
              3,000 rows expected (60 physicians × 50 questions).
              All rows are validated locally in your browser; nothing is uploaded.
            </div>
            <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-primary btn-sm" type="button" onClick={onPickFile}>
                Choose file
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={downloadTemplate}>
                Download template CSV
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={loadSample}>
                Load sample_data.csv
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          <div className="upload-status">
            {processing && (
              <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Validating…</div>
            )}
            {errors.length > 0 && (
              <div className="upload-error-card" role="alert">
                <div className="hdr">{errors.length} validation error{errors.length === 1 ? '' : 's'}</div>
                <ul className="upload-error-list">
                  {errors.slice(0, 200).map((e, i) => (
                    <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}</li>
                  ))}
                  {errors.length > 200 && (
                    <li className="muted">… {errors.length - 200} more error(s) suppressed</li>
                  )}
                </ul>
              </div>
            )}
            {hasData && errors.length === 0 && !processing && (
              <div className="upload-success-card">
                <div className="hdr">Loaded</div>
                <div className="body">
                  <strong>{loadedName || 'data.csv'}</strong> — {loadedRows.length.toLocaleString()} rows ready.
                  Go to <strong>Results</strong> to explore.
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="card upload-side">
          <h3>Expected schema</h3>
          <p>
            All {REQUIRED_COLUMNS.length} columns are required, in any order. Answer fields
            (<code className="formula">Di</code>, <code className="formula">A</code>,{' '}
            <code className="formula">R</code>, and whichever of{' '}
            <code className="formula">Df</code> / <code className="formula">F</code> is
            active for the row) must be a single character in <strong>A–E</strong>.
          </p>
          <dl className="schema-list">
            <dt>physician_id</dt><dd>P001 – P060</dd>
            <dt>physician_experience</dt><dd>Fellow | Attending_lt10 | Attending_gte10</dd>
            <dt>question_id</dt><dd>Q001 – Q050</dd>
            <dt>question_uncertainty</dt><dd>Guideline-Direct | Evidence-Equipoise | Extrapolation-Required</dd>
            <dt>question_order</dt><dd>1 – 50</dd>
            <dt>Di, A, R</dt><dd>One of A | B | C | D | E (always populated)</dd>
            <dt>oe_used</dt><dd>Yes | No</dd>
            <dt>Df</dt><dd>A | B | C | D | E when oe_used = Yes; empty otherwise</dd>
            <dt>F</dt><dd>A | B | C | D | E when oe_used = No; empty otherwise</dd>
            <dt>ts_Di_lock</dt><dd>ISO8601 UTC timestamp</dd>
            <dt>ts_oe_start</dt><dd>ISO8601 UTC; empty when oe_used = No</dd>
            <dt>ts_Df_lock</dt><dd>ISO8601 UTC; empty when oe_used = No</dd>
            <dt>ts_F_lock</dt><dd>ISO8601 UTC; empty when oe_used = Yes</dd>
            <dt>oe_time_seconds</dt><dd>Integer; empty when oe_used = No</dd>
          </dl>
        </aside>
      </div>
    </>
  )
}
