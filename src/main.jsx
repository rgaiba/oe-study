import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { StudyProvider } from './context/StudyContext.jsx'

// Self-hosted fonts via @fontsource — no CDN calls. Matches nbi-framework.
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/400-italic.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/source-serif-4/700.css'
import '@fontsource/dm-sans/300.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/400-italic.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import './styles/theme.css'
import './styles/shared.css'
import './styles/nav.css'
import './styles/upload.css'
import './styles/results.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StudyProvider>
      <App />
    </StudyProvider>
  </React.StrictMode>
)
