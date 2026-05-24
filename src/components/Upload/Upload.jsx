import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useStudy } from '../../context/StudyContext.jsx'
import {
  parseCsv, validateRows, validateResponses, validateRoster, validateQbank,
  joinSources,
  templateCsv, responsesTemplateCsv, rosterTemplateCsv, qbankTemplateCsv,
} from '../../lib/parse.js'
import SourceCard from './SourceCard.jsx'

const BASE = import.meta.env.BASE_URL || './'
const SAMPLE_JOINED = `${BASE}sample_data.csv`
const SAMPLE_RESPONSES = `${BASE}sample_responses.csv`
const SAMPLE_ROSTER = `${BASE}sample_roster.csv`
const SAMPLE_QBANK = `${BASE}sample_qbank.csv`

/**
 * Upload page. Two modes via tab strip:
 *   1. "Three sources" (default, recommended) — IP-isolated workflow.
 *      Upload OE Responses + Roster + Question Bank as separate CSVs;
 *      the join happens in the browser, never on a vendor surface.
 *   2. "Single joined CSV" — fallback for users with a pre-joined export
 *      (matches the v2 13-column schema).
 */
export default function Upload() {
  const { loadRows } = useStudy()
  const [mode, setMode] = useState('three') // 'three' | 'single'

  return (
    <>
      <h1 className="page-title">OpenEvidence Study analysis platform</h1>
      <p className="page-subtitle">
        Upload de-identified per-question response data. Validation, joining,
        and analysis all happen locally in your browser — nothing is sent
        anywhere. The recommended path keeps OE-vendor data, study-team
        strata, and the reference standard in three separate files; they are
        joined here and only here.
      </p>

      <div className="upload-mode-tabs" role="tablist" aria-label="Upload mode">
        <button
          role="tab"
          className={`upload-mode-tab ${mode === 'three' ? 'is-active' : ''}`}
          aria-selected={mode === 'three'}
          onClick={() => setMode('three')}
        >
          Three sources <span className="muted" style={{ fontWeight: 400 }}>· recommended</span>
        </button>
        <button
          role="tab"
          className={`upload-mode-tab ${mode === 'single' ? 'is-active' : ''}`}
          aria-selected={mode === 'single'}
          onClick={() => setMode('single')}
        >
          Single joined CSV
        </button>
      </div>

      {mode === 'three'
        ? <ThreeSourcesUpload onLoad={loadRows} />
        : <SingleCsvUpload onLoad={loadRows} />}
    </>
  )
}

// ─── Three-source upload pane ───────────────────────────────────────────────
function ThreeSourcesUpload({ onLoad }) {
  const [responses, setResponses] = useState(null) // {rows, filename}
  const [roster,    setRoster]    = useState(null)
  const [qbank,     setQbank]     = useState(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  const allLoaded = !!(responses && roster && qbank)

  // Live join preview (memoized) — drives the join-status block.
  const joinResult = useMemo(() => {
    if (!allLoaded) return null
    return joinSources({
      responses: responses.rows,
      roster: roster.rows,
      qbank: qbank.rows,
    })
  }, [allLoaded, responses, roster, qbank])

  const onCombine = () => {
    if (!joinResult || joinResult.errors.length > 0 || joinResult.rows.length === 0) return
    const sourcesLabel = `3 sources: ${responses.filename}, ${roster.filename}, ${qbank.filename}`
    onLoad(joinResult.rows, sourcesLabel)
  }

  // Load all three sample CSVs in one click for demoing the flow.
  const loadSamples = async () => {
    setBulkProcessing(true)
    setBulkError(null)
    try {
      const [respTxt, rosTxt, qbTxt] = await Promise.all([
        fetch(SAMPLE_RESPONSES).then(r => r.ok ? r.text() : Promise.reject(new Error(`responses: HTTP ${r.status}`))),
        fetch(SAMPLE_ROSTER).then(r => r.ok ? r.text() : Promise.reject(new Error(`roster: HTTP ${r.status}`))),
        fetch(SAMPLE_QBANK).then(r => r.ok ? r.text() : Promise.reject(new Error(`qbank: HTTP ${r.status}`))),
      ])
      const r1 = validateResponses(parseCsv(respTxt))
      const r2 = validateRoster(parseCsv(rosTxt))
      const r3 = validateQbank(parseCsv(qbTxt))
      if (!r1.ok || !r2.ok || !r3.ok) {
        throw new Error('sample CSVs failed validation — regenerate via `node scripts/generate_sample.js`.')
      }
      setResponses({ rows: r1.rows, filename: 'sample_responses.csv' })
      setRoster({ rows: r2.rows, filename: 'sample_roster.csv' })
      setQbank({ rows: r3.rows, filename: 'sample_qbank.csv' })
    } catch (e) {
      setBulkError(e.message)
    } finally {
      setBulkProcessing(false)
    }
  }

  return (
    <>
      <div className="three-sources-grid">
        <SourceCard
          index={1}
          title="OE Responses"
          subtitle="From OE vendor export. Per-question response data, no strata or R."
          source={responses}
          validate={validateResponses}
          template={{ name: 'oe_responses_template.csv', build: responsesTemplateCsv }}
          onLoad={(rows, filename) => setResponses({ rows, filename })}
          onClear={() => setResponses(null)}
        />
        <SourceCard
          index={2}
          title="Physician Roster"
          subtitle="Study team. Maps physician_id → physician_experience."
          source={roster}
          validate={validateRoster}
          template={{ name: 'physician_roster_template.csv', build: rosterTemplateCsv }}
          onLoad={(rows, filename) => setRoster({ rows, filename })}
          onClear={() => setRoster(null)}
        />
        <SourceCard
          index={3}
          title="Question Bank"
          subtitle="Study team. Maps question_id → question_uncertainty and R."
          source={qbank}
          validate={validateQbank}
          template={{ name: 'question_bank_template.csv', build: qbankTemplateCsv }}
          onLoad={(rows, filename) => setQbank({ rows, filename })}
          onClear={() => setQbank(null)}
        />
      </div>

      <div className="combine-bar">
        <div className="combine-bar-left">
          <button className="btn btn-ghost btn-sm" type="button" onClick={loadSamples} disabled={bulkProcessing}>
            {bulkProcessing ? 'Loading…' : 'Load sample sources'}
          </button>
          {bulkError && (
            <span className="combine-bar-error">Sample load failed: {bulkError}</span>
          )}
        </div>
        <div className="combine-bar-right">
          <button
            className="btn btn-primary"
            type="button"
            disabled={!allLoaded || !joinResult || joinResult.errors.length > 0 || joinResult.rows.length === 0}
            onClick={onCombine}
          >
            Combine and analyze →
          </button>
        </div>
      </div>

      {joinResult && (
        <JoinStatus result={joinResult} />
      )}
    </>
  )
}

// ─── Join status block ──────────────────────────────────────────────────────
function JoinStatus({ result }) {
  const { rows, errors, summary } = result
  const ok = errors.length === 0 && rows.length > 0
  return (
    <div className={`join-status ${ok ? 'is-ok' : 'is-error'}`}>
      <div className="join-status-hdr">
        {ok ? 'Ready to analyze' : 'Join errors — fix before combining'}
      </div>
      <div className="join-status-grid">
        <div><span className="num">{summary.responsesIn.toLocaleString()}</span><span className="lbl">responses in</span></div>
        <div><span className="num">{summary.joinedOut.toLocaleString()}</span><span className="lbl">rows joined</span></div>
        <div><span className="num">{summary.uniquePhysicians}</span><span className="lbl">physicians</span></div>
        <div><span className="num">{summary.uniqueQuestions}</span><span className="lbl">questions</span></div>
        {summary.rosterUnused > 0 && (
          <div><span className="num">{summary.rosterUnused}</span><span className="lbl muted">roster entries unused</span></div>
        )}
        {summary.qbankUnused > 0 && (
          <div><span className="num">{summary.qbankUnused}</span><span className="lbl muted">qbank entries unused</span></div>
        )}
      </div>
      {errors.length > 0 && (
        <div className="upload-error-card" role="alert" style={{ marginTop: 'var(--space-3)' }}>
          <div className="hdr">{errors.length} missing-ID error{errors.length === 1 ? '' : 's'}</div>
          <ul className="upload-error-list">
            {errors.slice(0, 30).map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
            {errors.length > 30 && (
              <li className="muted">… {errors.length - 30} more error(s) suppressed</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Single-CSV upload pane (fallback) ──────────────────────────────────────
function SingleCsvUpload({ onLoad }) {
  const { hasData, filename: loadedName, rows: loadedRows } = useStudy()
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
        const { ok, rows, errors: errs } = validateRows(parsed)
        if (!ok) {
          setErrors(errs); setProcessing(false); return
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
  }, [onLoad])

  const onPickFile = () => inputRef.current?.click()

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oe_study_joined_template.csv'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const loadSample = async () => {
    setProcessing(true)
    setErrors([])
    try {
      const resp = await fetch(SAMPLE_JOINED)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      const parsed = parseCsv(text)
      const { ok, rows, errors: errs } = validateRows(parsed)
      if (!ok) { setErrors(errs); setProcessing(false); return }
      onLoad(rows, 'sample_data.csv')
    } catch (err) {
      setErrors([{ row: 0, message: `Could not load sample_data.csv: ${err.message}` }])
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="upload-layout">
      <div>
        <div
          className={`dropzone ${dragOver ? 'is-dragover' : ''}`}
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
          aria-label="Drop joined CSV here"
        >
          <div className="dropzone-icon" aria-hidden="true">CSV</div>
          <div className="dropzone-title">Drop pre-joined CSV here</div>
          <div className="dropzone-sub">
            13-column joined schema. Use this if you already have a single CSV
            with experience, uncertainty, and R baked in.
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
          {processing && <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Validating…</div>}
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
                Go to <strong>Results</strong>.
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="card upload-side">
        <h3>Joined CSV schema (v2)</h3>
        <p>
          13 columns, in any order. Answer fields (Di, A, Df, R) must be A–E.
          Df is the final answer for every row; oe_used flags whether AI was
          consulted.
        </p>
        <dl className="schema-list">
          <dt>physician_id</dt><dd>e.g. P001 (study team)</dd>
          <dt>physician_experience</dt><dd>Fellow | Attending_lt10 | Attending_gte10</dd>
          <dt>question_id</dt><dd>e.g. Q001 (study team)</dd>
          <dt>question_uncertainty</dt><dd>Guideline-Direct | Evidence-Equipoise | Extrapolation-Required</dd>
          <dt>Di, A, Df, R</dt><dd>A | B | C | D | E</dd>
          <dt>oe_used</dt><dd>Yes | No</dd>
          <dt>ts_Di_lock, ts_Df_lock</dt><dd>ISO8601 UTC (always populated)</dd>
          <dt>ts_oe_start, oe_time_seconds</dt><dd>Empty when oe_used = No</dd>
        </dl>
      </aside>
    </div>
  )
}
