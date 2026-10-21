import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import styles from './Read.module.css'
import atoms from '../styles/atoms.module.css'
import markdownStyles from '../styles/markdown.module.css'
import { Shell } from '../components/Shell'
import { CodeView } from '../components/CodeView'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toaster'
import { usePaste } from '../lib/usePaste'
import { renderMarkdown } from '../lib/markdown'
import { UnlockPanel } from './Unlock'
import { Missing } from './Missing'
import { copyText, absoluteTime, expiryLabel } from '../lib/format'
import { labelFor, EXTENSIONS } from '../lib/language'

export function Read() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const justStowed = params.get('stowed') === '1'
  const { state, unlock, unlocking } = usePaste(slug)
  const { announce } = useToast()
  const [copied, setCopied] = useState<'link' | 'raw' | null>(null)
  // Markdown opens rendered, because that is what the author meant by choosing
  // it. The source is one toggle away, and the choice is remembered per tab.
  const [showSource, setShowSource] = useState(false)

  const pageUrl = useMemo(
    () => (typeof window === 'undefined' ? '' : `${window.location.origin}/p/${slug}`),
    [slug],
  )

  const copy = useCallback(
    async (kind: 'link' | 'raw') => {
      const value =
        kind === 'link'
          ? pageUrl
          : `${window.location.origin}/raw/${slug}${state.status === 'ready' && state.paste.protected ? `?token=${encodeURIComponent(sessionStorage.getItem(`stow:token:${slug}`) ?? '')}` : ''}`
      const ok = await copyText(value)
      if (ok) {
        setCopied(kind)
        announce(kind === 'link' ? 'Link copied' : 'Raw link copied')
        window.setTimeout(() => setCopied(null), 1600)
      } else {
        announce('The browser blocked the clipboard. Select the address and copy it.', 'failed')
      }
    },
    [announce, pageUrl, slug, state],
  )

  useEffect(() => {
    if (justStowed) announce('Entry stowed. Share this link.')
  }, [announce, justStowed])

  useEffect(() => {
    if (state.status !== 'ready') return
    const previous = document.title
    document.title = `${state.paste.title || `Entry ${state.paste.slug}`} - Stow`
    return () => {
      document.title = previous
    }
  }, [state])

  if (state.status === 'loading') {
    return <ReadSkeleton />
  }

  if (state.status === 'missing') {
    return <Missing />
  }

  if (state.status === 'failed') {
    return (
      <Shell>
        <div className={styles.centered}>
          <div className={styles.panel}>
            <span className={atoms.chip}>Unavailable</span>
            <h1 className={styles.panelTitle}>This entry could not be opened</h1>
            <p className={styles.panelNote}>{state.message}</p>
            <Link to="/" className={atoms.button}>
              Write a new entry
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  if (state.status === 'locked') {
    return (
      <UnlockPanel
        slug={slug}
        title={state.title}
        createdAt={state.createdAt}
        onUnlock={unlock}
        unlocking={unlocking}
      />
    )
  }

  const { paste } = state
  const extension = EXTENSIONS[paste.language] ?? 'txt'
  const filename = `${paste.title ? slugify(paste.title) : paste.slug}.${extension}`
  const downloadUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(paste.content)}`
  const isMarkdown = paste.language === 'markdown'
  const rendered = isMarkdown
    ? renderMarkdown(paste.content)
    : { html: '', headings: [] }

  return (
    <Shell
      band={
        <>
          <h1 className={styles.title} title={paste.title || 'Untitled entry'}>
            {paste.title || 'Untitled entry'}
          </h1>
          <span className={`${atoms.chip} ${styles.slugChip}`}>{paste.slug}</span>
          {paste.protected ? (
            <span className={`${atoms.chip} ${atoms.chipSignal}`}>
              <Icon.Lock size={11} />
              protected
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <a
            className={`${atoms.button} ${atoms.buttonCompactable}`}
            href={`/raw/${slug}${paste.protected ? `?token=${encodeURIComponent(sessionStorage.getItem(`stow:token:${slug}`) ?? '')}` : ''}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open the raw text"
            title="Raw"
          >
            <Icon.Raw />
            <span className={atoms.buttonLabel}>Raw</span>
          </a>
          <a
            className={`${atoms.button} ${atoms.buttonCompactable}`}
            href={downloadUrl}
            download={filename}
            aria-label="Download the entry"
            title="Download"
          >
            <Icon.Download />
            <span className={atoms.buttonLabel}>Download</span>
          </a>
          {paste.editable ? (
            <Link
              className={`${atoms.button} ${atoms.buttonCompactable}`}
              to={`/edit/${slug}`}
              aria-label="Edit the entry"
              title="Edit"
            >
              <Icon.Edit />
              <span className={atoms.buttonLabel}>Edit</span>
            </Link>
          ) : null}
          <button
            type="button"
            className={`${atoms.button} ${atoms.buttonPrimary}`}
            onClick={() => void copy('link')}
          >
            {copied === 'link' ? <Icon.Check /> : <Icon.Link />}
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </>
      }
      status={
        <>
          <span>{labelFor(paste.language)}</span>
          <span aria-hidden="true">/</span>
          <span>
            {paste.lines} {paste.lines === 1 ? 'line' : 'lines'}
          </span>
          <span aria-hidden="true">/</span>
          <span>{paste.chars.toLocaleString()} chars</span>
          {isMarkdown ? (
            <>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                className={styles.rawCopy}
                onClick={() => setShowSource((value) => !value)}
                aria-pressed={showSource}
              >
                {showSource ? 'view rendered' : 'view source'}
              </button>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <button type="button" className={styles.rawCopy} onClick={() => void copy('raw')}>
            {copied === 'raw' ? 'raw copied' : 'copy raw'}
          </button>
        </>
      }
    >
      <div className={styles.document}>
        {isMarkdown && !showSource ? (
          <div className={styles.proseScroll}>
            <article
              className={`${markdownStyles.markdown} markdown-body`}
              // markdown-it runs with html:false, so raw HTML in the source is
              // escaped rather than injected; every link is rel-scoped above.
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
          </div>
        ) : (
          <CodeView code={paste.content} language={paste.language} />
        )}
        <div className={styles.facts}>
          <dl className={styles.factList}>
            <div>
              <dt>Stowed</dt>
              <dd>{absoluteTime(paste.createdAt)}</dd>
            </div>
            {paste.updatedAt ? (
              <div>
                <dt>Edited</dt>
                <dd>{absoluteTime(paste.updatedAt)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Expires</dt>
              <dd>{expiryLabel(paste.expiresAt)}</dd>
            </div>
            <div>
              <dt>Read access</dt>
              <dd>{paste.protected ? 'password required' : 'anyone with the link'}</dd>
            </div>
            <div>
              <dt>Edit access</dt>
              <dd>{paste.editable ? 'password required' : 'closed'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Shell>
  )
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'entry'
  )
}

function ReadSkeleton() {
  return (
    <Shell
      band={<span className={`${atoms.skeleton} ${styles.skeletonTitle}`} aria-hidden="true" />}
      status={<span className={styles.loadingNote}>Opening entry</span>}
    >
      <div className={styles.skeletonBody} aria-busy="true" aria-label="Loading entry">
        {Array.from({ length: 12 }, (_, index) => (
          <span
            key={index}
            className={`${atoms.skeleton} ${styles.skeletonLine}`}
            style={{ width: `${38 + ((index * 17) % 54)}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </Shell>
  )
}
