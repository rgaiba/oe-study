import React from 'react'

export default function Chip({ kind, children }) {
  return <span className={`def-chip def-chip-${kind}`}>{children}</span>
}
