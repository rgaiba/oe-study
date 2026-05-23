import React from 'react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Rahul Gaiba, MD</span>
        <span aria-hidden="true">·</span>
        <span>OpenEvidence Study v1.0</span>
        <span aria-hidden="true">·</span>
        <span>Companion to <a href="https://nbi.rahulgaibamd.com">nbi.rahulgaibamd.com</a></span>
        <span aria-hidden="true">·</span>
        <span><code className="formula">oe.rahulgaibamd.com</code></span>
      </div>
    </footer>
  )
}
