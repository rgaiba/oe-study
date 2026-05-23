import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'

/**
 * Holds the parsed, validated rows for the active session. Lives in-memory
 * only — there's no localStorage persistence because this is a one-off
 * analytic session per CSV upload.
 */
const StudyContext = createContext(null)

export function StudyProvider({ children }) {
  const [rows, setRows] = useState([])           // validated row objects
  const [filename, setFilename] = useState(null) // string or null
  const [uploadedAt, setUploadedAt] = useState(null)

  const loadRows = useCallback((nextRows, name) => {
    setRows(nextRows)
    setFilename(name || null)
    setUploadedAt(new Date())
  }, [])

  const clear = useCallback(() => {
    setRows([])
    setFilename(null)
    setUploadedAt(null)
  }, [])

  const value = useMemo(() => ({
    rows,
    filename,
    uploadedAt,
    hasData: rows.length > 0,
    loadRows,
    clear,
  }), [rows, filename, uploadedAt, loadRows, clear])

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy must be used inside StudyProvider')
  return ctx
}
