import React, { useCallback, useRef, useState } from 'react'
import { parseCsv } from '../../lib/parse.js'

/**
 * One of the three source-CSV dropzones on the upload page. Self-contained:
 * holds its own dragover/processing state and surfaces parse + validation
 * errors inline. When the file is valid, it calls `onLoad(rows, filename)`
 * with the source-specific validated rows; on clear, `onClear()`.
 *
 * Props:
 *   index           — 1, 2, or 3 (just for the eyebrow numbering)
 *   title           — short label, e.g. "OE Responses"
 *   subtitle        — one-line description
 *   source          — current state { rows, filename, errors } | null
 *   validate(parsed)— validator returning { ok, rows, errors }
 *   template        — { name, build() } for the Download Template button
 *   onLoad, onClear — state setters
 */
export default function SourceCard({
  index, title, subtitle,
  source, validate, template,
  onLoad, onClear,
}) {
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [errors, setErrors] = useState([])
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
        const { ok, rows, errors: errs } = validate(parsed)
        if (!ok) {
          setErrors(errs)
          setProcessing(false)
          return
        }
        onLoad(rows, file.name)
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
  }, [validate, onLoad])

  const onPickFile = () => inputRef.current?.click()

  const downloadTemplate = () => {
    const blob = new Blob([template.build()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = template.name
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const clear = () => {
    setErrors([])
    setProcessing(false)
    onClear()
  }

  const loaded = !!source

  return (
    <div className={`source-card ${loaded ? 'is-loaded' : ''}`}>
      <div className="source-card-header">
        <div className="source-card-eyebrow">Source · {index}</div>
        <h3 className="source-card-title">{title}</h3>
        <p className="source-card-sub">{subtitle}</p>
      </div>

      {!loaded && (
        <>
          <div
            className={`dropzone source-card-zone ${dragOver ? 'is-dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer?.files?.[0]
              if (f) handleFile(f)
            }}
            onClick={onPickFile}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickFile() }
            }}
            aria-label={`Drop ${title} CSV here`}
          >
            <div className="dropzone-icon" aria-hidden="true">CSV</div>
            <div className="source-card-zone-title">Drop CSV here</div>
            <div className="dropzone-actions" onClick={(e) => e.stopPropagation()}>
              <button className="btn btn-primary btn-sm" type="button" onClick={onPickFile}>
                Choose file
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={downloadTemplate}>
                Template
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {processing && (
            <div className="source-card-status muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Validating…
            </div>
          )}
          {errors.length > 0 && (
            <div className="upload-error-card" role="alert">
              <div className="hdr">{errors.length} validation error{errors.length === 1 ? '' : 's'}</div>
              <ul className="upload-error-list">
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}</li>
                ))}
                {errors.length > 50 && (
                  <li className="muted">… {errors.length - 50} more error(s) suppressed</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}

      {loaded && (
        <div className="source-card-loaded">
          <div className="source-card-check" aria-hidden="true">✓</div>
          <div className="source-card-loaded-body">
            <div className="source-card-loaded-filename">{source.filename || 'file.csv'}</div>
            <div className="source-card-loaded-rows">
              {source.rows.length.toLocaleString()} row{source.rows.length === 1 ? '' : 's'} ready
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={clear}>
            Replace
          </button>
        </div>
      )}
    </div>
  )
}
