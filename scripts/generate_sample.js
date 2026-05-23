#!/usr/bin/env node
// =============================================================================
//  GENERATE sample_data.csv
//  Plain Node, zero dependencies. Writes public/sample_data.csv with 3,000
//  rows (60 physicians × 50 questions) matching the spec's distributions:
//    - 20 Fellow, 20 Attending_lt10, 20 Attending_gte10
//    - Q001–Q017 Guideline-Direct, Q018–Q034 Evidence-Equipoise,
//      Q035–Q050 Extrapolation-Required
//    - R uniform A–E, fixed per question
//    - A matches R ~70%, Di matches R ~55%
//    - OE opt-in rates vary by experience and uncertainty
//    - On AI-used and Di wrong: Df=R 60% (B) / Df=Di 40% (IR)
//    - On AI-used and Di right: Df=Di 85% (AR) / Df≠Di 15% (H, random other)
//    - oe_time_seconds log-normal, median ~90s, range 20–400
// =============================================================================

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const OUT_PATH = join(__dirname, '..', 'public', 'sample_data.csv')

const ANSWERS = ['A', 'B', 'C', 'D', 'E']

// ── Deterministic RNG so re-runs match (Mulberry32) ─────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20260523)

const rand = () => rng()
const randInt = (n) => Math.floor(rand() * n)
const pick = (arr) => arr[randInt(arr.length)]
const otherThan = (val) => {
  const opts = ANSWERS.filter(a => a !== val)
  return opts[randInt(opts.length)]
}

// Box-Muller for normal samples → log-normal for oe_time_seconds.
function randn() {
  let u = 0, v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}
function lognormalTime() {
  // Median ~90s. mu = ln(90); sigma chosen to keep ~99% in 20–400.
  const mu = Math.log(90)
  const sigma = 0.55
  let s = Math.exp(mu + sigma * randn())
  if (s < 20) s = 20
  if (s > 400) s = 400
  return Math.round(s)
}

// ── Cohort definitions ──────────────────────────────────────────────────────
function physicians() {
  const out = []
  for (let i = 1; i <= 20; i++) out.push({ id: `P${String(i).padStart(3, '0')}`, experience: 'Fellow' })
  for (let i = 21; i <= 40; i++) out.push({ id: `P${String(i).padStart(3, '0')}`, experience: 'Attending_lt10' })
  for (let i = 41; i <= 60; i++) out.push({ id: `P${String(i).padStart(3, '0')}`, experience: 'Attending_gte10' })
  return out
}

function questions() {
  const out = []
  for (let i = 1; i <= 50; i++) {
    const id = `Q${String(i).padStart(3, '0')}`
    let unc
    if (i <= 17) unc = 'Guideline-Direct'
    else if (i <= 34) unc = 'Evidence-Equipoise'
    else unc = 'Extrapolation-Required'
    const R = pick(ANSWERS)
    // OE's recommendation A is fixed per question (deterministic per question
    // in real OE, so the synthetic data should reflect that). Probability that
    // A matches R is 0.70; otherwise uniform over the four wrong options.
    const A = rand() < 0.70 ? R : pick(ANSWERS.filter(a => a !== R))
    out.push({ id, uncertainty: unc, R, A })
  }
  return out
}

// Per-(experience × uncertainty) opt-in rate. Multiplicatively combines
// physician baseline with question-uncertainty baseline; clamps to [0.30, 0.92].
const EXP_OPT = {
  Fellow:           0.75,
  Attending_lt10:   0.65,
  Attending_gte10:  0.55,
}
const UNC_OPT = {
  'Guideline-Direct':       0.50,
  'Evidence-Equipoise':     0.65,
  'Extrapolation-Required': 0.75,
}
function optInProb(exp, unc) {
  // Blend (mean) the two so a Fellow on a Guideline question doesn't combine to extreme.
  const p = (EXP_OPT[exp] + UNC_OPT[unc]) / 2
  return Math.max(0.30, Math.min(0.92, p))
}

// Build a per-question Di distribution: R with mass 0.55, others ~ uniform 0.1125 each.
function diDistFor(R) {
  const dist = {}
  const others = ANSWERS.filter(a => a !== R)
  dist[R] = 0.55
  const remaining = 1 - 0.55
  for (const o of others) dist[o] = remaining / others.length
  return dist
}
function sampleFromDist(dist) {
  let x = rand()
  for (const [k, p] of Object.entries(dist)) {
    if (x < p) return k
    x -= p
  }
  return Object.keys(dist).pop()
}

// Fisher-Yates shuffle for per-physician question order.
function shuffled(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pad(n) { return String(n).padStart(2, '0') }
function isoUtc(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
}

function generate() {
  const phys = physicians()
  const qs = questions()
  const diDist = Object.fromEntries(qs.map(q => [q.id, diDistFor(q.R)]))

  // Schema v2: 13 columns. F and ts_F_lock dropped. Df populated on every row.
  const HEADERS = [
    'physician_id','physician_experience','question_id','question_uncertainty',
    'Di','A','oe_used','Df','R',
    'ts_Di_lock','ts_oe_start','ts_Df_lock','oe_time_seconds'
  ]
  const lines = [HEADERS.join(',')]

  // Anchor session timestamps to a fixed date so output is deterministic.
  const baseDate = new Date(Date.UTC(2026, 4, 15, 13, 0, 0)) // 2026-05-15T13:00:00Z

  for (let pi = 0; pi < phys.length; pi++) {
    const p = phys[pi]
    const order = shuffled(qs)
    let t = new Date(baseDate.getTime() + pi * 3 * 60 * 60 * 1000)

    for (let oi = 0; oi < order.length; oi++) {
      const q = order[oi]
      const Di = sampleFromDist(diDist[q.id])
      const useOE = rand() < optInProb(p.experience, q.uncertainty)

      // Timing.
      t = new Date(t.getTime() + (15 + Math.round(rand() * 30)) * 1000)
      const tsDiLock = new Date(t)

      let tsOeStart = null, tsDfLock = null, oeSeconds = null
      let Df = ''

      if (useOE) {
        tsOeStart = new Date(t)
        oeSeconds = lognormalTime()
        t = new Date(t.getTime() + oeSeconds * 1000)
        tsDfLock = new Date(t)

        if (Di !== q.R) {
          // Initially wrong: 60% B (Df=R), 40% IR (Df=Di).
          Df = rand() < 0.60 ? q.R : Di
        } else {
          // Initially right: 85% AR (Df=Di), 15% H (Df = random other).
          Df = rand() < 0.85 ? Di : otherThan(Di)
        }
      } else {
        // No AI consultation. Physician still commits a final answer; usually
        // it mirrors Di — 92% Df=Di, 8% Df flips to a random other answer.
        t = new Date(t.getTime() + (5 + Math.round(rand() * 20)) * 1000)
        tsDfLock = new Date(t)
        Df = rand() < 0.92 ? Di : otherThan(Di)
      }

      // Small gap before next question.
      t = new Date(t.getTime() + (3 + Math.round(rand() * 10)) * 1000)

      lines.push([
        p.id,
        p.experience,
        q.id,
        q.uncertainty,
        Di,
        q.A,
        useOE ? 'Yes' : 'No',
        Df,
        q.R,
        isoUtc(tsDiLock),
        tsOeStart ? isoUtc(tsOeStart) : '',
        isoUtc(tsDfLock),
        oeSeconds === null ? '' : oeSeconds,
      ].join(','))
    }
  }

  return lines.join('\n') + '\n'
}

const csv = generate()
mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, csv)
const rowCount = csv.split('\n').length - 2 // header + trailing newline
console.log(`wrote ${OUT_PATH} (${rowCount.toLocaleString()} data rows)`)
