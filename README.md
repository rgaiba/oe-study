# OpenEvidence Study

Companion analysis platform for the OpenEvidence cardiology decision-making study.
Sibling of [nbi-framework](https://github.com/rgaiba/nbi-framework) — same visual
language, same academic tone.

Live: **[oe.rahulgaibamd.com](https://oe.rahulgaibamd.com)**

## What it does

- Upload the per-question response CSV (3,000 rows = 60 physicians × 50 questions).
- Validate every row against the study schema (A–E enforcement on answer fields,
  Yes/No on `oe_used`, conditional populated/empty on `Df`/`F`).
- Surface three analysis panels with live strata filters (reader experience ×
  question uncertainty):
  - **Panel 4a — AI use rate.** 3×3 heatmap of `oe_used = Yes` share.
  - **Panel 4b — Effect of voluntary AI use.** Grouped accuracy bars for the
    three decision streams (`Di` initial, `Df` AI-used final, `F` AI-declined
    final), overall and per uncertainty stratum.
  - **Panel 4c — Net influence breakdown.** Adjudication matrix (B / H / IR / AR)
    on AI-used cases, plus the NBI hero card and four supporting metrics (AIR,
    ECR, EIR, DIR) with 95% confidence intervals.

All processing is local — the CSV never leaves your browser.

## Adjudication scope

AI-used cases only (`oe_used = "Yes"`). `F` cases are excluded from the matrix —
they have no `Df` and are not adjudicated. Unlike the canonical NBI framework,
disagreement between `Di` and `A` is **not** required for inclusion; every
voluntary consultation is adjudicated. Denominator for all metrics is
`N_oe_used`.

| | `Df ≠ Di` (Changed) | `Df = Di` (Unchanged) |
|---|---|---|
| **`Di ≠ R`** (Initially Wrong) | **B** — Beneficial change | **IR** — Inappropriate resistance |
| **`Di = R`** (Initially Right) | **H** — Harmful change | **AR** — Appropriate resistance |

| Metric | Formula | CI |
|---|---|---|
| NBI | `(B − H) / N_oe_used × 100` | Multinomial difference |
| AIR | `B / (B + H)` | Wilson 95% |
| ECR | `B / (B + IR) × 100` | Wilson 95% |
| EIR | `H / (H + AR) × 100` | Wilson 95% |
| DIR | `(B + H) / N_oe_used × 100` | Wilson 95% |

## Data architecture (v3)

The upload page has **two modes**, both client-side, both ending at the same
analysis.

### Three sources (recommended)

Three separate CSVs are uploaded; the join happens in the browser. OE never
sees the strata or the reference standard.

| Source | Owner | Columns |
|---|---|---|
| **OE Responses** | OE vendor | `physician_id`, `question_id`, `Di`, `A`, `oe_used`, `Df`, `ts_Di_lock`, `ts_oe_start`, `ts_Df_lock`, `oe_time_seconds` |
| **Physician Roster** | Study team | `physician_id`, `physician_experience` |
| **Question Bank** | Study team | `question_id`, `question_uncertainty`, `R` |

Each file is validated against its own schema. Joining catches missing IDs
and reports them by source-CSV row number. Download per-source templates
from the upload page, or grab the three sample CSVs (`public/sample_responses.csv`,
`public/sample_roster.csv`, `public/sample_qbank.csv`).

### Single joined CSV (fallback)

13-column pre-joined schema for users who already have an export with
experience, uncertainty, and R baked in. Same format the joined output of
mode 1 produces, so a CSV exported from the analysis is re-uploadable.

```
physician_id, physician_experience, question_id, question_uncertainty,
Di, A, oe_used, Df, R,
ts_Di_lock, ts_oe_start, ts_Df_lock, oe_time_seconds
```

Answer fields (`Di`, `A`, `Df`, `R`) must be `A`–`E` and populated on every
row. `Df` is the final answer regardless of whether AI was consulted;
`oe_used` flags whether consultation actually happened. `ts_oe_start` and
`oe_time_seconds` must be empty when `oe_used = No`; `ts_Di_lock` and
`ts_Df_lock` are always populated. Sample: `public/sample_data.csv` (3,000
synthetic rows).

## Local development

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm run sample     # regenerate the 4 sample CSVs (joined + 3 sources)
```

Stack: Vite + React 18, self-hosted fonts via `@fontsource`. Zero runtime
dependencies beyond React. Vanilla CSS with design tokens in
`src/styles/theme.css` (ported from `nbi-framework`).

## Deployment

Push to `main` → the workflow in `.github/workflows/deploy.yml` builds and
publishes to GitHub Pages. Custom domain is set via `public/CNAME`
(`oe.rahulgaibamd.com`).

**Domain setup:**
1. In your DNS provider, add a CNAME record:
   `oe.rahulgaibamd.com → rgaiba.github.io`
2. In the repo's **Settings → Pages**, set the custom domain to
   `oe.rahulgaibamd.com` and enable "Enforce HTTPS" once the cert provisions.

## File layout

```
src/
├── App.jsx
├── main.jsx
├── context/StudyContext.jsx
├── components/
│   ├── Nav.jsx
│   ├── Footer.jsx
│   ├── Upload/Upload.jsx
│   ├── Results/
│   │   ├── Results.jsx
│   │   ├── StrataFilters.jsx
│   │   ├── AiUseHeatmap.jsx       (Panel 4a)
│   │   ├── AccuracyChart.jsx      (Panel 4b)
│   │   └── NbiPanel.jsx           (Panel 4c)
│   └── shared/
│       ├── AdjudicationMatrix.jsx
│       ├── NbiHero.jsx
│       ├── SmallMetrics.jsx
│       └── Chip.jsx
├── lib/
│   ├── nbi.js       — adjudication, metrics, Wilson + multinomial CIs
│   └── parse.js     — CSV parsing, validation, A–E enforcement
└── styles/
    ├── theme.css
    ├── nav.css
    ├── upload.css
    ├── results.css
    └── shared.css
scripts/generate_sample.js
public/{CNAME, favicon.svg, sample_data.csv}
```

## License

Code MIT. Authored by Rahul Gaiba, MD.
