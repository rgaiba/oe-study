// =============================================================================
//  CSV PARSING, PER-SOURCE VALIDATION, AND CLIENT-SIDE JOIN
//
//  Schema v3 (post-Google-Sheet IP-isolation design):
//    Three data sources are uploaded separately and joined in the browser.
//    OE never sees the strata or the reference standard.
//
//      OE Responses (vendor):  physician_id, question_id, Di, A, oe_used,
//                              Df, ts_Di_lock, ts_oe_start, ts_Df_lock,
//                              oe_time_seconds
//      Roster (study team):    physician_id, physician_experience  (+optional)
//      Qbank  (study team):    question_id, question_uncertainty, R  (+optional)
//
//    joinSources({responses, roster, qbank}) produces the 13-column joined
//    rows the analysis panels consume. The single-CSV "joined" path is kept
//    as a fallback for users who already have a pre-joined export.
// =============================================================================

// ── Domain constants ────────────────────────────────────────────────────────
export const EXPERIENCE_LEVELS = ['Fellow', 'Attending_lt10', 'Attending_gte10']
export const UNCERTAINTY_LEVELS = ['Guideline-Direct', 'Evidence-Equipoise', 'Extrapolation-Required']
const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D', 'E'])
const YES_NO = new Set(['Yes', 'No'])

// ── Per-source required columns ─────────────────────────────────────────────
export const RESPONSES_COLUMNS = [
  'physician_id', 'question_id', 'Di', 'A', 'oe_used', 'Df',
  'ts_Di_lock', 'ts_oe_start', 'ts_Df_lock', 'oe_time_seconds',
]
export const ROSTER_COLUMNS = ['physician_id', 'physician_experience']
export const QBANK_COLUMNS  = ['question_id', 'question_uncertainty', 'R']

// Joined schema — what the analysis app actually consumes (and what the
// single-CSV fallback path validates).
export const JOINED_COLUMNS = [
  'physician_id', 'physician_experience',
  'question_id', 'question_uncertainty',
  'Di', 'A', 'oe_used', 'Df', 'R',
  'ts_Di_lock', 'ts_oe_start', 'ts_Df_lock', 'oe_time_seconds',
]

// Legacy alias — older code referenced REQUIRED_COLUMNS for the joined schema.
export const REQUIRED_COLUMNS = JOINED_COLUMNS

// ────────────────────────────────────────────────────────────────────────────
//  CSV parsing (RFC 4180 — quoted fields, embedded commas, CRLF)
// ────────────────────────────────────────────────────────────────────────────

function tokenizeRow(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }
        else { inQuotes = false }
      } else {
        cur += ch
      }
    } else {
      if (ch === ',') { out.push(cur); cur = '' }
      else if (ch === '"') { inQuotes = true }
      else { cur += ch }
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

export function parseCsv(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = tokenizeRow(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = tokenizeRow(lines[i])
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] !== undefined ? cells[j] : ''
    }
    rows.push(row)
  }
  return { headers, rows }
}

// ────────────────────────────────────────────────────────────────────────────
//  Shared helpers
// ────────────────────────────────────────────────────────────────────────────

// Header check returns missing-cols error array (or empty if all present).
function checkHeaders(parsed, required) {
  const missing = required.filter(c => !parsed.headers.includes(c))
  return missing.length
    ? [{ row: 1, message: `Missing required column(s): ${missing.join(', ')}` }]
    : []
}

// ────────────────────────────────────────────────────────────────────────────
//  Source 1 — OE Responses (vendor export)
// ────────────────────────────────────────────────────────────────────────────

export function validateResponses(parsed) {
  const errors = checkHeaders(parsed, RESPONSES_COLUMNS)
  if (errors.length) return { ok: false, rows: [], errors }

  const out = []
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i]
    const csvRow = i + 2
    const e = []

    if (!r.physician_id) e.push('physician_id is empty')
    if (!r.question_id) e.push('question_id is empty')
    if (!YES_NO.has(r.oe_used)) e.push(`oe_used must be Yes | No (got "${r.oe_used}")`)
    if (!VALID_ANSWERS.has(r.Di)) e.push(`Di must be A-E (got "${r.Di}")`)
    if (!VALID_ANSWERS.has(r.A))  e.push(`A must be A-E (got "${r.A}")`)
    if (!VALID_ANSWERS.has(r.Df)) e.push(`Df must be A-E (got "${r.Df}")`)

    if (r.oe_used === 'Yes') {
      if (!r.ts_oe_start) e.push('ts_oe_start must be populated when oe_used=Yes')
      if (r.oe_time_seconds === '' || r.oe_time_seconds == null) {
        e.push('oe_time_seconds must be populated when oe_used=Yes')
      }
    } else if (r.oe_used === 'No') {
      if (r.ts_oe_start) e.push(`ts_oe_start must be empty when oe_used=No (got "${r.ts_oe_start}")`)
      if (r.oe_time_seconds) e.push(`oe_time_seconds must be empty when oe_used=No (got "${r.oe_time_seconds}")`)
    }

    if (e.length === 0) {
      out.push({
        physician_id: r.physician_id,
        question_id: r.question_id,
        Di: r.Di,
        A: r.A,
        oe_used: r.oe_used,
        Df: r.Df,
        ts_Di_lock: r.ts_Di_lock || '',
        ts_oe_start: r.ts_oe_start || '',
        ts_Df_lock: r.ts_Df_lock || '',
        oe_time_seconds: r.oe_time_seconds === '' ? null : Number(r.oe_time_seconds),
        _csvRow: csvRow,
      })
    } else {
      for (const msg of e) errors.push({ row: csvRow, message: msg })
    }
  }
  return { ok: errors.length === 0, rows: out, errors }
}

// ────────────────────────────────────────────────────────────────────────────
//  Source 2 — Physician Roster (study team)
// ────────────────────────────────────────────────────────────────────────────

export function validateRoster(parsed) {
  const errors = checkHeaders(parsed, ROSTER_COLUMNS)
  if (errors.length) return { ok: false, rows: [], errors }

  const seen = new Set()
  const out = []
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i]
    const csvRow = i + 2
    const e = []

    if (!r.physician_id) e.push('physician_id is empty')
    if (!EXPERIENCE_LEVELS.includes(r.physician_experience)) {
      e.push(`physician_experience must be one of ${EXPERIENCE_LEVELS.join(' | ')} (got "${r.physician_experience}")`)
    }
    if (r.physician_id && seen.has(r.physician_id)) {
      e.push(`Duplicate physician_id "${r.physician_id}"`)
    }

    if (e.length === 0) {
      seen.add(r.physician_id)
      out.push({
        physician_id: r.physician_id,
        physician_experience: r.physician_experience,
        _csvRow: csvRow,
      })
    } else {
      for (const msg of e) errors.push({ row: csvRow, message: msg })
    }
  }
  return { ok: errors.length === 0, rows: out, errors }
}

// ────────────────────────────────────────────────────────────────────────────
//  Source 3 — Question Bank (study team)
// ────────────────────────────────────────────────────────────────────────────

export function validateQbank(parsed) {
  const errors = checkHeaders(parsed, QBANK_COLUMNS)
  if (errors.length) return { ok: false, rows: [], errors }

  const seen = new Set()
  const out = []
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i]
    const csvRow = i + 2
    const e = []

    if (!r.question_id) e.push('question_id is empty')
    if (!UNCERTAINTY_LEVELS.includes(r.question_uncertainty)) {
      e.push(`question_uncertainty must be one of ${UNCERTAINTY_LEVELS.join(' | ')} (got "${r.question_uncertainty}")`)
    }
    if (!VALID_ANSWERS.has(r.R)) e.push(`R must be A-E (got "${r.R}")`)
    if (r.question_id && seen.has(r.question_id)) {
      e.push(`Duplicate question_id "${r.question_id}"`)
    }

    if (e.length === 0) {
      seen.add(r.question_id)
      out.push({
        question_id: r.question_id,
        question_uncertainty: r.question_uncertainty,
        R: r.R,
        _csvRow: csvRow,
      })
    } else {
      for (const msg of e) errors.push({ row: csvRow, message: msg })
    }
  }
  return { ok: errors.length === 0, rows: out, errors }
}

// ────────────────────────────────────────────────────────────────────────────
//  Join the three sources into the 13-column analysis format
//
//  Returns { rows, errors, summary } where errors is a [{ row, message }]
//  array (row refers to the OE Responses CSV row of the unmatched record)
//  and summary is a small object the UI uses to show counts.
// ────────────────────────────────────────────────────────────────────────────

export function joinSources({ responses, roster, qbank }) {
  const rosterMap = new Map(roster.map(r => [r.physician_id, r]))
  const qbankMap  = new Map(qbank.map(q => [q.question_id, q]))

  // Track missing IDs by occurrence count so we can roll up errors instead of
  // showing the same physician_id error 50 times.
  const missingPhys = new Map() // id → [{row, ...}]
  const missingQ    = new Map()
  const rows = []

  for (const r of responses) {
    const phys = rosterMap.get(r.physician_id)
    const q = qbankMap.get(r.question_id)
    if (!phys || !q) {
      if (!phys) {
        if (!missingPhys.has(r.physician_id)) missingPhys.set(r.physician_id, [])
        missingPhys.get(r.physician_id).push(r._csvRow)
      }
      if (!q) {
        if (!missingQ.has(r.question_id)) missingQ.set(r.question_id, [])
        missingQ.get(r.question_id).push(r._csvRow)
      }
      continue
    }
    rows.push({
      physician_id: r.physician_id,
      physician_experience: phys.physician_experience,
      question_id: r.question_id,
      question_uncertainty: q.question_uncertainty,
      Di: r.Di,
      A: r.A,
      oe_used: r.oe_used,
      Df: r.Df,
      R: q.R,
      ts_Di_lock: r.ts_Di_lock,
      ts_oe_start: r.ts_oe_start,
      ts_Df_lock: r.ts_Df_lock,
      oe_time_seconds: r.oe_time_seconds,
    })
  }

  const errors = []
  for (const [id, csvRows] of missingPhys) {
    const sample = csvRows.slice(0, 3).join(', ')
    const more = csvRows.length > 3 ? ` … (+${csvRows.length - 3} more)` : ''
    errors.push({
      row: csvRows[0],
      message: `physician_id "${id}" appears in ${csvRows.length} response row(s) [${sample}${more}] but is not in the Roster.`,
    })
  }
  for (const [id, csvRows] of missingQ) {
    const sample = csvRows.slice(0, 3).join(', ')
    const more = csvRows.length > 3 ? ` … (+${csvRows.length - 3} more)` : ''
    errors.push({
      row: csvRows[0],
      message: `question_id "${id}" appears in ${csvRows.length} response row(s) [${sample}${more}] but is not in the Question Bank.`,
    })
  }

  // Informational counts (not blocking).
  const respPhysIds = new Set(responses.map(r => r.physician_id))
  const respQIds = new Set(responses.map(r => r.question_id))
  const rosterUnused = roster.filter(r => !respPhysIds.has(r.physician_id)).length
  const qbankUnused = qbank.filter(q => !respQIds.has(q.question_id)).length

  return {
    rows,
    errors,
    summary: {
      responsesIn: responses.length,
      joinedOut: rows.length,
      uniquePhysicians: respPhysIds.size,
      uniqueQuestions: respQIds.size,
      missingPhysicianIds: missingPhys.size,
      missingQuestionIds: missingQ.size,
      rosterUnused,
      qbankUnused,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Single-CSV joined path (fallback for users with a pre-joined export)
// ────────────────────────────────────────────────────────────────────────────

export function validateRows(parsed) {
  const errors = checkHeaders(parsed, JOINED_COLUMNS)
  if (errors.length) return { ok: false, rows: [], errors }

  const out = []
  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i]
    const csvRow = i + 2
    const e = []

    if (!EXPERIENCE_LEVELS.includes(r.physician_experience)) {
      e.push(`physician_experience must be one of ${EXPERIENCE_LEVELS.join(' | ')} (got "${r.physician_experience}")`)
    }
    if (!UNCERTAINTY_LEVELS.includes(r.question_uncertainty)) {
      e.push(`question_uncertainty must be one of ${UNCERTAINTY_LEVELS.join(' | ')} (got "${r.question_uncertainty}")`)
    }
    if (!YES_NO.has(r.oe_used)) e.push(`oe_used must be Yes | No (got "${r.oe_used}")`)
    if (!VALID_ANSWERS.has(r.Di)) e.push(`Di must be A-E (got "${r.Di}")`)
    if (!VALID_ANSWERS.has(r.A))  e.push(`A must be A-E (got "${r.A}")`)
    if (!VALID_ANSWERS.has(r.Df)) e.push(`Df must be A-E (got "${r.Df}")`)
    if (!VALID_ANSWERS.has(r.R))  e.push(`R must be A-E (got "${r.R}")`)

    if (r.oe_used === 'Yes') {
      if (!r.ts_oe_start) e.push('ts_oe_start must be populated when oe_used=Yes')
      if (r.oe_time_seconds === '' || r.oe_time_seconds == null) {
        e.push('oe_time_seconds must be populated when oe_used=Yes')
      }
    } else if (r.oe_used === 'No') {
      if (r.ts_oe_start) e.push(`ts_oe_start must be empty when oe_used=No (got "${r.ts_oe_start}")`)
      if (r.oe_time_seconds) e.push(`oe_time_seconds must be empty when oe_used=No (got "${r.oe_time_seconds}")`)
    }

    if (e.length === 0) {
      out.push({
        physician_id: r.physician_id,
        physician_experience: r.physician_experience,
        question_id: r.question_id,
        question_uncertainty: r.question_uncertainty,
        Di: r.Di,
        A: r.A,
        oe_used: r.oe_used,
        Df: r.Df,
        R: r.R,
        ts_Di_lock: r.ts_Di_lock || '',
        ts_oe_start: r.ts_oe_start || '',
        ts_Df_lock: r.ts_Df_lock || '',
        oe_time_seconds: r.oe_time_seconds === '' ? null : Number(r.oe_time_seconds),
      })
    } else {
      for (const msg of e) errors.push({ row: csvRow, message: msg })
    }
  }
  return { ok: errors.length === 0, rows: out, errors }
}

// ────────────────────────────────────────────────────────────────────────────
//  Template CSVs (downloadable from the UI)
// ────────────────────────────────────────────────────────────────────────────

export function responsesTemplateCsv() {
  const header = RESPONSES_COLUMNS.join(',')
  const ex = [
    // AI consulted, initially wrong, switched to AI's answer
    'P001,Q001,B,C,Yes,C,2026-05-23T14:00:00Z,2026-05-23T14:00:12Z,2026-05-23T14:01:38Z,86',
    // AI declined, final mirrors initial
    'P021,Q018,B,A,No,B,2026-05-23T14:05:00Z,,2026-05-23T14:05:34Z,',
    // AI consulted, initially right, stayed (appropriate resistance)
    'P041,Q040,D,D,Yes,D,2026-05-23T14:10:00Z,2026-05-23T14:10:15Z,2026-05-23T14:12:02Z,107',
  ]
  return [header, ...ex].join('\n') + '\n'
}

export function rosterTemplateCsv() {
  const header = ROSTER_COLUMNS.join(',')
  const ex = [
    'P001,Fellow',
    'P021,Attending_lt10',
    'P041,Attending_gte10',
  ]
  return [header, ...ex].join('\n') + '\n'
}

export function qbankTemplateCsv() {
  const header = QBANK_COLUMNS.join(',')
  const ex = [
    'Q001,Guideline-Direct,C',
    'Q018,Evidence-Equipoise,A',
    'Q040,Extrapolation-Required,D',
  ]
  return [header, ...ex].join('\n') + '\n'
}

// Legacy joined-CSV template (kept for the single-CSV fallback path).
export function templateCsv() {
  const header = JOINED_COLUMNS.join(',')
  const ex = [
    'P001,Fellow,Q001,Guideline-Direct,B,C,Yes,C,C,2026-05-23T14:00:00Z,2026-05-23T14:00:12Z,2026-05-23T14:01:38Z,86',
    'P021,Attending_lt10,Q018,Evidence-Equipoise,B,A,No,B,A,2026-05-23T14:05:00Z,,2026-05-23T14:05:34Z,',
    'P041,Attending_gte10,Q040,Extrapolation-Required,D,D,Yes,D,D,2026-05-23T14:10:00Z,2026-05-23T14:10:15Z,2026-05-23T14:12:02Z,107',
  ]
  return [header, ...ex].join('\n') + '\n'
}
