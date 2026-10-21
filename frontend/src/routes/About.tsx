import { Link } from 'react-router-dom'
import styles from './About.module.css'
import atoms from '../styles/atoms.module.css'
import { Shell } from '../components/Shell'

const SECTIONS = [
  {
    heading: 'What Stow does',
    body: 'You paste text, Stow stores it, and you get a short link. That link shows the text to whoever opens it, in a monospaced document with line numbers, a raw endpoint, and a copy button. There is no account and nothing to sign into.',
  },
  {
    heading: 'Retention',
    body: 'Every entry can carry an expiry from one day to ninety, or none at all. An expired entry is deleted the next time it is opened, and the link returns a 404. Nothing is kept in a recycle bin, because a route that hides data has to show it again.',
  },
  {
    heading: 'Protection',
    body: 'A password can be attached to an entry. If read protection is on, the server withholds the body until the password is checked, so the link alone opens nothing. Edit access always requires the password, even when reading does not.',
  },
  {
    heading: 'What it will not do',
    body: 'Stow does not run your code, render pasted HTML, track readers, or host files. Pasted text is stored as text and shown as text, which is what keeps a shared paste link safe to open.',
  },
]

export function About() {
  return (
    <Shell
      status={
        <>
          <span>no account</span>
          <span aria-hidden="true">/</span>
          <span>no tracking</span>
        </>
      }
    >
      <div className={styles.wrap}>
        <article className={styles.article}>
          <header className={styles.head}>
            <h1 className={styles.headline}>
              Put text away so a link can carry it.
            </h1>
            <p className={styles.lede}>
              A paste tool for people who are already mid-task. Paste, stow, send
              the link. Everything else is optional.
            </p>
            <Link to="/" className={`${atoms.button} ${atoms.buttonPrimary} ${styles.cta}`}>
              Write an entry
            </Link>
          </header>

          <div className={styles.body}>
            {SECTIONS.map((section) => (
              <section key={section.heading} className={styles.section}>
                <h2 className={styles.sectionHeading}>{section.heading}</h2>
                <p className={styles.sectionBody}>{section.body}</p>
              </section>
            ))}
          </div>

          {/* The standing links in the status strip are hidden on narrow
              screens, so the reading path through the product ends here too.
              Every document is one tap from this list at any width. */}
          <nav className={styles.reference} aria-label="Reference">
            <Link to="/api" className={styles.referenceLink}>
              API reference
            </Link>
            <Link to="/privacy" className={styles.referenceLink}>
              Privacy notice
            </Link>
            <Link to="/terms" className={styles.referenceLink}>
              Terms of use
            </Link>
            <a
              className={styles.referenceLink}
              href="https://github.com/truepushkar/orion-paste"
              target="_blank"
              rel="noreferrer noopener"
            >
              Source
            </a>
          </nav>
        </article>
      </div>
    </Shell>
  )
}
