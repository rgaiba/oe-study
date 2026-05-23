import React, { useEffect, useState } from 'react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Upload from './components/Upload/Upload.jsx'
import Results from './components/Results/Results.jsx'
import { useStudy } from './context/StudyContext.jsx'

/**
 * Two-view app: 'upload' (default) and 'results' (only reachable once a CSV
 * is loaded). View state is mirrored to the URL hash so refresh and back/forward
 * behave naturally, without bringing in a router library.
 */
function readHash() {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  return h === 'results' ? 'results' : 'upload'
}

export default function App() {
  const { hasData } = useStudy()
  const [view, setViewState] = useState(readHash())

  const setView = (next) => {
    setViewState(next)
    const target = `#/${next}`
    if (window.location.hash !== target) window.location.hash = target
  }

  // Sync from hash changes (back/forward navigation).
  useEffect(() => {
    const onHash = () => setViewState(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // After a successful upload, surface results automatically.
  useEffect(() => {
    if (hasData && view !== 'results') setView('results')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasData])

  // Guard: if user lands on /results without data (cold link), bounce home.
  useEffect(() => {
    if (view === 'results' && !hasData) setView('upload')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, hasData])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Nav view={view} setView={setView} />
      <main id="main" className="main">
        <div className="container">
          {view === 'results' && hasData ? <Results /> : <Upload setView={setView} />}
        </div>
      </main>
      <Footer />
    </>
  )
}
