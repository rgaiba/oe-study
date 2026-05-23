// =============================================================================
//  CSV PARSING & VALIDATION
//  Hand-rolled parser (no papaparse dependency to satisfy the "zero runtime
//  deps beyond React" rule). Handles quoted fields, embedded commas, and CRLF
//  line endings, which is the only RFC 4180 surface we need for this study.
// =============================================================================

export const REQUIRED_COLUMNS = [
  'physician_id',
  'physician_experience',
  'question_id',
  'question_uncertainty',
  'question_order',
  'Di',
  'A',
  'oe_used',
  'Df',
  'F',
  'R',
  'ts_Di_lock',
  'ts_oe_start',
  'ts_Df_lock',
  'ts_F_lock',
  'oe_time_seconds',
]

export const EXPERIENCE_LEVELS = ['Fellow', 'Attending_lt10', 'Attending_gte10']
export const UNCERTAINTY_LEVELS = ['Guideline-Direct', 'Evidence-Equipoise', 'Extrapolation-Required']
const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D', 'E'])
const YES_NO = new Set(['Yes', 'No'])

/**
 * Tokenize one CSV row, respecting RFC 4180 double-quoted fields.
 * Treats two consecutive quotes inside a quoted field as a literal quote.
 */
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

/**
 * Parse CSV text into an array of row objects keyed by header.
 * Returns { headers, rows }. Skips fully blank lines.
 */
export function parseCsv(text) {
  // Normalize line endings; split; drop trailing blank lines.
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

/**
 * Validate parsed rows against the study schema.
 * Returns { ok, rows, errors }. errors is an array of {row, message} where
 * `row` is the 1-indexed CSV row (header is row 1, first data row is row 2).
 */
export function validateRows(parsed) {
  const errors = []
  const { headers, rows } = parsed

  // Header presence check.
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c))
  if (missing.length) {
    errors.push({ row: 1, message: `Missing required column(s): ${missing.join(', ')}` })
    return { ok: false, rows: [], errors }
  }

  const out = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const csvRow = i + 2 // header is row 1
    const e = []

    if (!EXPERIENCE_LEVELS.includes(r.physician_experience)) {
      e.push(`physician_experience must be one of ${EXPERIENCE_LEVELS.join(' | ')} (got "${r.physician_experience}")`)
    }
    if (!UNCERTAINTY_LEVELS.includes(r.question_uncertainty)) {
      e.push(`question_uncertainty must be one of ${UNCERTAINTY_LEVELS.join(' | ')} (got "${r.question_uncertainty}")`)
    }
    if (!YES_NO.has(r.oe_used)) {
      e.push(`oe_used must be Yes | No (got "${r.oe_used}")`)
    }
    if (!VALID_ANSWERS.has(r.Di)) e.push(`Di must be A-E (got "${r.Di}")`)
    if (!VALID_ANSWERS.has(r.A))  e.push(`A must be A-E (got "${r.A}")`)
    if (!VALID_ANSWERS.has(r.R))  e.push(`R must be A-E (got "${r.R}")`)

    if (r.oe_used === 'Yes') {
      if (!VALID_ANSWERS.has(r.Df)) e.push(`Df must be A-E when oe_used=Yes (got "${r.Df}")`)
      if (r.F !== '' && r.F !== undefined && r.F !== null) {
        e.push(`F must be empty when oe_used=Yes (got "${r.F}")`)
      }
    } else if (r.oe_used === 'No') {
      if (!VALID_ANSWERS.has(r.F)) e.push(`F must be A-E when oe_used=No (got "${r.F}")`)
      if (r.Df !== '' && r.Df !== undefined && r.Df !== null) {
        e.push(`Df must be empty when oe_used=No (got "${r.Df}")`)
      }
    }

    const qOrder = Number(r.question_order)
    if (!Number.isFinite(qOrder) || qOrder < 1) {
      e.push(`question_order must be a positive integer (got "${r.question_order}")`)
    }

    if (e.length === 0) {
      // Coerce numeric/typed fields once validated.
      out.push({
        physician_id: r.physician_id,
        physician_experience: r.physician_experience,
        question_id: r.question_id,
        question_uncertainty: r.question_uncertainty,
        question_order: qOrder,
        Di: r.Di,
        A: r.A,
        oe_used: r.oe_used,
        Df: r.Df || '',
        F: r.F || '',
        R: r.R,
        ts_Di_lock: r.ts_Di_lock || '',
        ts_oe_start: r.ts_oe_start || '',
        ts_Df_lock: r.ts_Df_lock || '',
        ts_F_lock: r.ts_F_lock || '',
        oe_time_seconds: r.oe_time_seconds === '' ? null : Number(r.oe_time_seconds),
      })
    } else {
      for (const msg of e) errors.push({ row: csvRow, message: msg })
    }
  }

  return { ok: errors.length === 0, rows: out, errors }
}

/** Template CSV with three example rows covering AI-used and AI-declined cases. */
export function templateCsv() {
  const header = REQUIRED_COLUMNS.join(',')
  const examples = [
    // Fellow, Guideline-Direct, used OE, initially wrong (Di=B), AI correct (A=C), changed to C → B
    'P001,Fellow,Q001,Guideline-Direct,1,B,C,Yes,C,,C,2026-05-23T14:00:00Z,2026-05-23T14:00:12Z,2026-05-23T14:01:38Z,,86',
    // Attending_lt10, Evidence-Equipoise, declined OE, answered B with R=A (F wrong)
    'P021,Attending_lt10,Q018,Evidence-Equipoise,2,B,A,No,,B,A,2026-05-23T14:05:00Z,,,2026-05-23T14:05:34Z,',
    // Attending_gte10, Extrapolation-Required, used OE, initially right (Di=R=D), stayed D → AR
    'P041,Attending_gte10,Q040,Extrapolation-Required,3,D,D,Yes,D,,D,2026-05-23T14:10:00Z,2026-05-23T14:10:15Z,2026-05-23T14:12:02Z,,107',
  ]
  return [header, ...examples].join('\n') + '\n'
}
