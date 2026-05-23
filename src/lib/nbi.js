// =============================================================================
//  OE STUDY . NBI ADJUDICATION & METRICS
//
//  Adjudication scope: all voluntary AI-use cases (oe_used = "Yes").
//  F cases (no AI use) are excluded — they have no Df and are not adjudicated.
//  Unlike the canonical NBI framework, disagreement between Di and A is NOT
//  required for inclusion. Every voluntary consultation is adjudicated.
//  All answers are single characters (A–E); correctness is strict equality
//  against R. Denominator for all metrics is N_oe_used.
//
//  Outcome classes (AI-used rows only):
//        Df ≠ Di (Changed)        Df = Di (Unchanged)
//   Di ≠ R   B  (Beneficial)       IR (Inappropriate resistance)
//   Di = R   H  (Harmful)          AR (Appropriate resistance)
//
//  Five metrics (N = N_oe_used):
//   NBI = (B - H) / N * 100
//   AIR = B / (B + H)
//   ECR = B / (B + IR) * 100
//   EIR = H / (H + AR) * 100
//   DIR = (B + H) / N * 100
// =============================================================================

const Z_95 = 1.959964 // two-sided 95% z

/** Adjudicate one AI-used row to B / H / IR / AR. */
export function adjudicateRow(row) {
  if (row.oe_used !== 'Yes') return null
  const initiallyRight = row.Di === row.R
  const changed = row.Df !== row.Di
  if (!initiallyRight && changed) return 'B'
  if (!initiallyRight && !changed) return 'IR'
  if (initiallyRight && changed) return 'H'
  return 'AR'
}

/** Tally B/H/IR/AR over a row collection. */
export function aggregate(rows) {
  const counts = { B: 0, H: 0, IR: 0, AR: 0 }
  let N_oe_used = 0
  for (const r of rows) {
    if (r.oe_used !== 'Yes') continue
    N_oe_used += 1
    const cls = adjudicateRow(r)
    if (cls) counts[cls] += 1
  }
  return { ...counts, N_oe_used }
}

/**
 * Wilson score 95% CI for a proportion. Returns proportions in [0,1].
 * Returns null when denominator is zero.
 */
export function wilsonCI(numerator, denominator) {
  const n = denominator
  if (!n || n <= 0) return null
  const p = numerator / n
  const z = Z_95
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) }
}

/**
 * 95% CI for NBI = (B - H) / N, treating B and H as two cells of a multinomial.
 *   Var(p_B - p_H) = (p_B + p_H - (p_B - p_H)²) / N
 * Returns endpoints as percentages, clipped to [-100, 100].
 */
export function nbiCI(B, H, N) {
  if (!N || N <= 0) return null
  const pB = B / N
  const pH = H / N
  const diff = pB - pH
  const variance = (pB + pH - diff * diff) / N
  const se = Math.sqrt(Math.max(0, variance))
  const half = Z_95 * se
  return {
    lo: Math.max(-1, diff - half) * 100,
    hi: Math.min(1, diff + half) * 100,
  }
}

/** Compute the five metrics with 95% CIs from aggregate counts. */
export function computeMetrics({ B = 0, H = 0, IR = 0, AR = 0, N_oe_used = 0 } = {}) {
  const b = Math.max(0, Number(B) || 0)
  const h = Math.max(0, Number(H) || 0)
  const ir = Math.max(0, Number(IR) || 0)
  const ar = Math.max(0, Number(AR) || 0)
  const N = Math.max(0, Number(N_oe_used) || 0)

  const NBI = N > 0 ? ((b - h) / N) * 100 : null
  const AIR = b + h > 0 ? b / (b + h) : null
  const ECR = b + ir > 0 ? (b / (b + ir)) * 100 : null
  const EIR = h + ar > 0 ? (h / (h + ar)) * 100 : null
  const DIR = N > 0 ? ((b + h) / N) * 100 : null

  const airCI = wilsonCI(b, b + h)
  const ecrCIp = wilsonCI(b, b + ir)
  const eirCIp = wilsonCI(h, h + ar)
  const dirCIp = wilsonCI(b + h, N)

  return {
    B: b, H: h, IR: ir, AR: ar,
    N_oe_used: N,
    NBI, AIR, ECR, EIR, DIR,
    NBI_CI: nbiCI(b, h, N),
    AIR_CI: airCI,
    ECR_CI: ecrCIp ? { lo: ecrCIp.lo * 100, hi: ecrCIp.hi * 100 } : null,
    EIR_CI: eirCIp ? { lo: eirCIp.lo * 100, hi: eirCIp.hi * 100 } : null,
    DIR_CI: dirCIp ? { lo: dirCIp.lo * 100, hi: dirCIp.hi * 100 } : null,
  }
}

/** Filter rows by a {experience: Set, uncertainty: Set} selection. */
export function filterRows(rows, selection) {
  const exp = selection?.experience
  const unc = selection?.uncertainty
  return rows.filter(r => {
    if (exp && exp.size > 0 && !exp.has(r.physician_experience)) return false
    if (unc && unc.size > 0 && !unc.has(r.question_uncertainty)) return false
    return true
  })
}

/** Accuracy summary over a row collection, separating the three streams. */
export function accuracySummary(rows) {
  let nAll = 0, diCorrect = 0
  let nOe = 0, dfCorrect = 0
  let nNoOe = 0, fCorrect = 0
  for (const r of rows) {
    nAll += 1
    if (r.Di === r.R) diCorrect += 1
    if (r.oe_used === 'Yes') {
      nOe += 1
      if (r.Df === r.R) dfCorrect += 1
    } else if (r.oe_used === 'No') {
      nNoOe += 1
      if (r.F === r.R) fCorrect += 1
    }
  }
  return {
    Di: { n: nAll, k: diCorrect, pct: nAll > 0 ? (diCorrect / nAll) * 100 : null },
    Df: { n: nOe,  k: dfCorrect, pct: nOe  > 0 ? (dfCorrect / nOe)  * 100 : null },
    F:  { n: nNoOe, k: fCorrect, pct: nNoOe > 0 ? (fCorrect / nNoOe) * 100 : null },
  }
}

/** AI use rate per (experience × uncertainty) cell. */
export function aiUseMatrix(rows, experienceLevels, uncertaintyLevels) {
  const cells = experienceLevels.map(exp => uncertaintyLevels.map(unc => ({
    experience: exp,
    uncertainty: unc,
    n: 0,
    used: 0,
    pct: null,
  })))
  for (const r of rows) {
    const ei = experienceLevels.indexOf(r.physician_experience)
    const ui = uncertaintyLevels.indexOf(r.question_uncertainty)
    if (ei < 0 || ui < 0) continue
    const c = cells[ei][ui]
    c.n += 1
    if (r.oe_used === 'Yes') c.used += 1
  }
  for (const row of cells) {
    for (const c of row) {
      c.pct = c.n > 0 ? (c.used / c.n) * 100 : null
    }
  }
  return cells
}

/** Per-uncertainty stratum accuracy summary — drives the grouped bar chart. */
export function accuracyByUncertainty(rows, uncertaintyLevels) {
  const out = { Overall: accuracySummary(rows) }
  for (const u of uncertaintyLevels) {
    out[u] = accuracySummary(rows.filter(r => r.question_uncertainty === u))
  }
  return out
}

/** Display formatters. */
export function formatMetric(metric, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a'
  if (metric === 'AIR') return value.toFixed(3)
  return `${value.toFixed(1)}%`
}

export function formatCI(metric, ci) {
  if (!ci) return ''
  if (metric === 'AIR') return `(${ci.lo.toFixed(2)} to ${ci.hi.toFixed(2)})`
  const sign = n => (n > 0 ? '+' : '') + n.toFixed(1)
  if (metric === 'NBI') return `(${sign(ci.lo)} to ${sign(ci.hi)})`
  return `(${ci.lo.toFixed(1)} to ${ci.hi.toFixed(1)})`
}

export function interpretMetric(metric, value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Not computable. Denominator is zero.'
  }
  switch (metric) {
    case 'AIR':
      if (value > 0.5) return 'Most AI-driven changes were beneficial.'
      if (value < 0.5) return 'Most AI-driven changes were harmful.'
      return 'Beneficial and harmful changes balance.'
    case 'ECR':
      if (value >= 75) return 'High error correction by AI.'
      if (value >= 25) return 'Moderate error correction.'
      return 'Low error correction. Possible algorithm aversion.'
    case 'EIR':
      if (value <= 5)  return 'Low error induction by AI.'
      if (value <= 25) return 'Moderate error induction.'
      return 'High error induction. Possible automation bias.'
    case 'DIR':
      if (value >= 80) return 'Very high change rate.'
      if (value <= 10) return 'Very low change rate.'
      return 'Moderate change rate.'
    default:
      return ''
  }
}
