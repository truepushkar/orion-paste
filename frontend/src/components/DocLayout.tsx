import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Shell } from './Shell'
import styles from './DocLayout.module.css'

export interface DocSection {
  id: string
  heading: string
}

/**
 * The reading surface for every document in the product: the API reference,
 * the terms, the privacy policy, the about page.
 *
 * It renders its own Shell, so a document cannot accidentally lose the top bar
 * and status strip by forgetting to wrap itself.
 *
 * Left: a sticky contents rail that tracks where you are. Right: one measured
 * column. On narrow screens the rail becomes a scrolling strip above the text,
 * because a 200px sidebar beside 340px of prose serves nobody.
 */
export function DocLayout({
  title,
  lede,
  sections,
  children,
  meta,
  status,
}: {
  title: string
  lede?: ReactNode
  sections: DocSection[]
  children: ReactNode
  meta?: ReactNode
  status?: ReactNode
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const body = useRef<HTMLDivElement>(null)

  // Scroll-spy: the current section is the last heading to cross the top
  // eighth of the viewport. Uses the scroll container, not the window, since
  // the shell owns the scroll.
  useEffect(() => {
    const container = body.current
    if (!container || sections.length === 0) return

    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null)

    if (headings.length === 0) return

    const onScroll = () => {
      const threshold = container.getBoundingClientRect().top + 96
      let current = headings[0].id
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= threshold) current = heading.id
      }
      setActive(current)
    }

    onScroll()
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [sections])

  const jump = (id: string) => {
    const target = document.getElementById(id)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Shell
      band={<span className={styles.bandTitle}>{title}</span>}
      status={status ?? <span>document</span>}
    >
      <div className={styles.layout} ref={body}>
        <div className={styles.grid}>
          <nav className={styles.toc} aria-label="Contents">
            <p className={styles.tocLabel}>Contents</p>
            <ul className={styles.tocList}>
              {sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className={styles.tocLink}
                    data-active={active === section.id ? 'true' : undefined}
                    aria-current={active === section.id ? 'true' : undefined}
                    onClick={() => jump(section.id)}
                  >
                    {section.heading}
                  </button>
                </li>
              ))}
            </ul>
            {meta ? <div className={styles.tocMeta}>{meta}</div> : null}
          </nav>

          <article className={styles.doc}>
            <header className={styles.head}>
              <h1 className={styles.title}>{title}</h1>
              {lede ? <div className={styles.lede}>{lede}</div> : null}
            </header>
            <div className={styles.body}>{children}</div>
          </article>
        </div>
      </div>
    </Shell>
  )
}

/** One numbered section of a document. */
export function DocSection({
  id,
  heading,
  children,
}: {
  id: string
  heading: string
  children: ReactNode
}) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.heading}>{heading}</h2>
      <div className={styles.prose}>{children}</div>
    </section>
  )
}

/** A paragraph that introduces or qualifies what follows. */
export function Note({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>
}

/** An inline code reference inside prose. */
export function Code({ children }: { children: ReactNode }) {
  return <code className={styles.inlineCode}>{children}</code>
}
