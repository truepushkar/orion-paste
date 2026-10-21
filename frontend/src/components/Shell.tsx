import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import styles from './Shell.module.css'
import atoms from '../styles/atoms.module.css'

/**
 * The shell. Two persistent bands, top and bottom, and a full-bleed middle.
 * Nothing here is a card and nothing floats: the page is the container, and
 * the seams between bands are the only structure.
 */
export function Shell({
  children,
  actions,
  status,
  band,
}: {
  children: ReactNode
  actions?: ReactNode
  status?: ReactNode
  band?: ReactNode
}) {
  return (
    <div className={styles.app}>
      <TopBar actions={actions}>{band}</TopBar>
      <main className={styles.main}>{children}</main>
      <StatusStrip>{status}</StatusStrip>
    </div>
  )
}

function TopBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  const { pathname } = useLocation()

  const links = [
    { to: '/', label: 'Write', exact: true },
    { to: '/api', label: 'API' },
    { to: '/about', label: 'How it works' },
  ]

  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.brand} aria-label="Stow, new entry">
        <Wordmark />
        <span className={styles.brandName}>Stow</span>
      </Link>

      <nav className={styles.nav} aria-label="Primary">
        {links.map((link) => {
          const active = link.exact ? pathname === link.to : pathname.startsWith(link.to)
          return (
            <Link
              key={link.to}
              to={link.to}
              className={styles.navLink}
              data-active={active ? 'true' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      {children ? <div className={styles.band}>{children}</div> : null}

      <div className={styles.barActions}>{actions}</div>
    </header>
  )
}

/**
 * The status strip carries the page's own metadata on the left and the
 * product's standing links on the right. Those links are here rather than in
 * the top bar because they are reference material, not actions: a paste tool
 * should not spend its primary navigation on a privacy policy.
 */
function StatusStrip({ children }: { children?: ReactNode }) {
  return (
    <footer className={styles.status}>
      <span className={styles.statusLeft}>{children}</span>
      <nav className={styles.statusNav} aria-label="Footer">
        <Link to="/api" className={styles.statusLink}>
          API
        </Link>
        <Link to="/privacy" className={styles.statusLink}>
          Privacy
        </Link>
        <Link to="/terms" className={styles.statusLink}>
          Terms
        </Link>
        <a
          className={styles.statusLink}
          href="https://github.com/truepushkar/stow"
          target="_blank"
          rel="noreferrer noopener"
        >
          Source
        </a>
      </nav>
    </footer>
  )
}

/** The mark is drawn, not typed: an open crate with its lid seam. */
export function Wordmark() {
  return (
    <svg
      className={styles.mark}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
    >
      <path d="M2 5.2 8 2.2l6 3v6.2l-6 3-6-3z" strokeLinejoin="round" />
      <path d="M2 5.2 8 8.2l6-3" strokeLinejoin="round" />
      <path d="M8 8.2v6.2" />
    </svg>
  )
}

export const Seam = {
  H: ({ className }: { className?: string }) => (
    <div className={`${atoms.seam} ${atoms.seamH} ${className ?? ''}`} role="presentation" />
  ),
  V: ({ className }: { className?: string }) => (
    <div className={`${atoms.seam} ${atoms.seamV} ${className ?? ''}`} role="presentation" />
  ),
}
