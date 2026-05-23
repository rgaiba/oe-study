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

/**
 * Accuracy summary over a row collection. Schema v2: Df is the final answer
 * for every row, so Df accuracy is computed on all rows. The "AI consulted"
 * vs "AI declined" split is reported separately for the lift analysis.
 */
export function accuracySummary(rows) {
  let nAll = 0, diCorrect = 0, dfCorrect = 0
  let nUsed = 0, dfUsedCorrect = 0
  let nNot = 0, dfNotCorrect = 0
  for (const r of rows) {
    nAll += 1
    if (r.Di === r.R) diCorrect += 1
    if (r.Df === r.R) dfCorrect += 1
    if (r.oe_used === 'Yes') {
      nUsed += 1
      if (r.Df === r.R) dfUsedCorrect += 1
    } else if (r.oe_used === 'No') {
      nNot += 1
      if (r.Df === r.R) dfNotCorrect += 1
    }
  }
  return {
    Di:         { n: nAll, k: diCorrect,    pct: nAll  > 0 ? (diCorrect    / nAll)  * 100 : null },
    Df:         { n: nAll, k: dfCorrect,    pct: nAll  > 0 ? (dfCorrect    / nAll)  * 100 : null },
    DfAiUsed:   { n: nUsed, k: dfUsedCorrect, pct: nUsed > 0 ? (dfUsedCorrect / nUsed) * 100 : null },
    DfAiDecl:   { n: nNot, k: dfNotCorrect,  pct: nNot  > 0 ? (dfNotCorrect  / nNot)  * 100 : null },
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

// ─────────────────────────────────────────────────────────────────────────────
//  AUROC for hard categorical predictions (5-way: A B C D E)
//
//  For each class c, treat the 5-way problem as a one-vs-rest binary task.
//  The "predictor" is the hard pick (1 if predicted == c, else 0). With a
//  binary score the ROC has just three vertices: (0,0), (FPR_c, TPR_c), (1,1).
//  Trapezoidal AUC then reduces algebraically to balanced accuracy:
//    AUC_c = (sensitivity_c + specificity_c) / 2
//  Macro-AUROC averages AUC_c across all five classes (Macy & Hand 2001).
//
//  This is not a fully discriminative AUROC — there is no probabilistic
//  output to threshold — but it is the standard AUROC reduction used in
//  medical AI papers when raters provide categorical (rather than continuous)
//  predictions, and it stays comparable across raters and AI.
// ─────────────────────────────────────────────────────────────────────────────

const CLASSES = ['A', 'B', 'C', 'D', 'E']

/** Per-class one-vs-rest AUC. `getPred(row)` returns the predicted A–E. */
export function perClassAuc(rows, getPred) {
  return CLASSES.map(c => {
    let tp = 0, fn = 0, fp = 0, tn = 0
    for (const r of rows) {
      const truth = r.R === c
      const pred = getPred(r) === c
      if (truth && pred) tp++
      else if (truth && !pred) fn++
      else if (!truth && pred) fp++
      else tn++
    }
    const tpr = tp + fn > 0 ? tp / (tp + fn) : null
    const fpr = fp + tn > 0 ? fp / (fp + tn) : null
    if (tpr === null || fpr === null) return null
    return (tpr + (1 - fpr)) / 2
  })
}

/** Macro-averaged AUROC across the five answer classes. */
export function macroAuc(rows, getPred) {
  const aucs = perClassAuc(rows, getPred).filter(a => a !== null)
  if (aucs.length === 0) return null
  return aucs.reduce((s, a) => s + a, 0) / aucs.length
}

/** Per-row sensitivity/specificity for class c (for an ROC overlay if needed). */
export function perClassRates(rows, getPred) {
  return CLASSES.map(c => {
    let tp = 0, fn = 0, fp = 0, tn = 0
    for (const r of rows) {
      const truth = r.R === c
      const pred = getPred(r) === c
      if (truth && pred) tp++
      else if (truth && !pred) fn++
      else if (!truth && pred) fp++
      else tn++
    }
    const tpr = tp + fn > 0 ? tp / (tp + fn) : null
    const fpr = fp + tn > 0 ? fp / (fp + tn) : null
    return { class: c, tpr, fpr, n: tp + fn }
  })
}

// Mulberry32 — same generator the sample-data script uses. Seeded so the
// bootstrap CI is stable across renders (otherwise CI endpoints jitter on
// every filter change, which looks like a bug to a reader).
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Percentile bootstrap 95% CI for macro-AUROC. Resamples rows with replacement
 * (row-level, no clustering correction — same convention as most medical-AI
 * accuracy comparisons; conservative when there is within-physician dependence).
 * Default B=500 keeps the panel responsive on the full 3,000-row sample.
 */
export function bootstrapAucCI(rows, getPred, B = 500, seed = 20260523) {
  const n = rows.length
  if (n === 0) return null
  const rng = makeRng(seed)
  const aucs = []
  const sample = new Array(n)
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) sample[i] = rows[Math.floor(rng() * n)]
    const auc = macroAuc(sample, getPred)
    if (auc !== null) aucs.push(auc)
  }
  if (aucs.length === 0) return null
  aucs.sort((a, b) => a - b)
  return {
    lo: aucs[Math.floor(0.025 * aucs.length)],
    hi: aucs[Math.floor(0.975 * aucs.length)],
  }
}

/** Row-level getters for the three prediction streams.
 *  Schema v2: Df is the final answer for every row, regardless of oe_used. */
export const STREAM = {
  Di:    r => r.Di,
  Final: r => r.Df,
  A:     r => r.A,
}

/** Convenience: compute AUROC + CI for each stratum × stream + AI baseline. */
export function aucBreakdown(rows, experienceLevels) {
  const out = {
    AI: {
      label: 'OpenEvidence (A)',
      auc: macroAuc(rows, STREAM.A),
      ci: bootstrapAucCI(rows, STREAM.A),
      n: rows.length,
    },
    strata: [],
  }
  for (const exp of experienceLevels) {
    const stratumRows = rows.filter(r => r.physician_experience === exp)
    out.strata.push({
      experience: exp,
      n: stratumRows.length,
      Di:    { auc: macroAuc(stratumRows, STREAM.Di),    ci: bootstrapAucCI(stratumRows, STREAM.Di) },
      Final: { auc: macroAuc(stratumRows, STREAM.Final), ci: bootstrapAucCI(stratumRows, STREAM.Final) },
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  Top-1 accuracy + paired McNemar + Δ-accuracy lift
//
//  Three sub-sections of the secondary "accuracy" panel. These are intended
//  to replace the AUROC reduction with metrics that are directly meaningful
//  for a 5-way categorical task and a paired-by-question study design.
// ─────────────────────────────────────────────────────────────────────────────

/** Top-1 accuracy with Wilson 95% CI for a row collection and stream getter. */
export function accuracy(rows, getPred) {
  let n = 0, k = 0
  for (const r of rows) {
    n += 1
    if (getPred(r) === r.R) k += 1
  }
  if (n === 0) return { n: 0, k: 0, p: null, ci: null }
  const p = k / n
  const ci = wilsonCI(k, n)
  return { n, k, p, ci }
}

/** Convenience: accuracy per stratum × stream + AI baseline. Same shape as aucBreakdown. */
export function accuracyBreakdown(rows, experienceLevels) {
  const out = {
    AI: { label: 'OpenEvidence (A)', ...accuracy(rows, STREAM.A) },
    strata: [],
  }
  for (const exp of experienceLevels) {
    const stratumRows = rows.filter(r => r.physician_experience === exp)
    out.strata.push({
      experience: exp,
      n: stratumRows.length,
      Di:    accuracy(stratumRows, STREAM.Di),
      Final: accuracy(stratumRows, STREAM.Final),
    })
  }
  return out
}

/**
 * Paired McNemar comparison vs the AI baseline on the SAME questions.
 * Each row contributes one pair: (physician_correct, AI_correct).
 *
 * 2×2 disagreement table:
 *           AI correct   AI wrong
 *   P corr     a            b      (physician right, AI right) | (physician right, AI wrong)
 *   P wrong    c            d      (physician wrong, AI right) | (physician wrong, AI wrong)
 *
 * - b = cases where physician beat AI
 * - c = cases where AI beat physician
 * - OR = b / c (continuity-corrected when either is 0)
 * - Two-sided exact mid-p value (binomial on b out of b+c with p=0.5).
 *
 * Skip pairs with non-A–E values (degenerate rows).
 */
export function mcnemarVsAI(rows, getPred) {
  let a = 0, b = 0, c = 0, d = 0
  for (const r of rows) {
    const pCorrect = getPred(r) === r.R
    const aCorrect = r.A === r.R
    if (pCorrect && aCorrect) a += 1
    else if (pCorrect && !aCorrect) b += 1
    else if (!pCorrect && aCorrect) c += 1
    else d += 1
  }
  const n = a + b + c + d
  if (n === 0) return { a: 0, b: 0, c: 0, d: 0, n: 0, or: null, p: null, discordant: 0 }

  const discordant = b + c
  // Odds ratio with Haldane–Anscombe 0.5 correction when either cell is 0.
  let or = null
  if (b > 0 && c > 0) or = b / c
  else if (discordant > 0) or = (b + 0.5) / (c + 0.5)

  // Two-sided exact mid-p: P(X ≤ min(b,c)) under Binomial(b+c, 0.5), doubled,
  // minus half the point mass at the observed value (mid-p adjustment).
  let p = null
  if (discordant > 0) {
    const k = Math.min(b, c)
    const n2 = discordant
    // Iterative log-space binomial CDF to stay stable for large n2.
    const logBin = (n, x) => {
      let s = 0
      for (let i = 1; i <= x; i++) s += Math.log(n - i + 1) - Math.log(i)
      return s
    }
    let cdf = 0
    let pmf_at_k = 0
    const log05_n = n2 * Math.log(0.5)
    for (let x = 0; x <= k; x++) {
      const pmf = Math.exp(logBin(n2, x) + log05_n)
      cdf += pmf
      if (x === k) pmf_at_k = pmf
    }
    const midP = 2 * cdf - pmf_at_k
    p = Math.min(1, Math.max(0, midP))
  }

  return { a, b, c, d, n, discordant, or, p }
}

/** Convenience: McNemar (Di vs AI) and (Final vs AI) per stratum. */
export function mcnemarBreakdown(rows, experienceLevels) {
  return experienceLevels.map(exp => {
    const stratumRows = rows.filter(r => r.physician_experience === exp)
    return {
      experience: exp,
      n: stratumRows.length,
      Di:    mcnemarVsAI(stratumRows, STREAM.Di),
      Final: mcnemarVsAI(stratumRows, STREAM.Final),
    }
  })
}

/**
 * Δ-accuracy (Final − Initial) per stratum, split by whether AI was used.
 * The "lift" is the per-row change Final_correct - Di_correct. Each row
 * contributes one of {+1, 0, -1} (Wrong→Right, Unchanged, Right→Wrong).
 * Mean Δ ≈ (# improved − # worsened) / n. 95% CI by normal-approx on the
 * mean of these ±1/0 outcomes.
 *
 * Stratified by oe_used so a reader can see how much of any lift is
 * attributable to consultation vs other factors.
 */
function deltaAccuracy(rows) {
  let n = 0, sum = 0, sumSq = 0
  for (const r of rows) {
    const di = r.Di === r.R ? 1 : 0
    const final = r.Df === r.R ? 1 : 0
    const delta = final - di
    n += 1
    sum += delta
    sumSq += delta * delta
  }
  if (n === 0) return { n: 0, mean: null, ci: null }
  const mean = sum / n
  if (n < 2) return { n, mean, ci: null }
  const variance = (sumSq - n * mean * mean) / (n - 1)
  const se = Math.sqrt(variance / n)
  return {
    n,
    mean,
    ci: { lo: mean - 1.959964 * se, hi: mean + 1.959964 * se },
  }
}

/** Lift breakdown: per stratum, overall Δ and Δ split by AI use. */
export function liftBreakdown(rows, experienceLevels) {
  return experienceLevels.map(exp => {
    const stratumRows = rows.filter(r => r.physician_experience === exp)
    return {
      experience: exp,
      n: stratumRows.length,
      overall:    deltaAccuracy(stratumRows),
      aiUsed:     deltaAccuracy(stratumRows.filter(r => r.oe_used === 'Yes')),
      aiDeclined: deltaAccuracy(stratumRows.filter(r => r.oe_used === 'No')),
    }
  })
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
