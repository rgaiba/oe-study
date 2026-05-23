import React from 'react'
import { useStudy } from '../context/StudyContext.jsx'

export default function Nav({ view, setView }) {
  const { hasData } = useStudy()
  return (
    <header className="nav">
      <div className="container nav-inner">
        <button
          className="nav-brand"
          onClick={() => setView('upload')}
          aria-label="OpenEvidence Study, go to upload"
        >
          <span className="nav-mark">OE</span>
          <span className="nav-divider" aria-hidden="true" />
          <span className="nav-wordmark">OpenEvidence Study</span>
        </button>
        <nav className="nav-tabs" aria-label="Primary">
          <button
            className={`nav-tab ${view === 'upload' ? 'is-active' : ''}`}
            onClick={() => setView('upload')}
            aria-current={view === 'upload' ? 'page' : undefined}
          >
            Upload
          </button>
          <button
            className={`nav-tab ${view === 'results' ? 'is-active' : ''}`}
            onClick={() => hasData && setView('results')}
            aria-current={view === 'results' ? 'page' : undefined}
            disabled={!hasData}
            title={hasData ? undefined : 'Upload a CSV to view results'}
          >
            Results
          </button>
        </nav>
      </div>
    </header>
  )
}
