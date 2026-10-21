import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import styles from './Edit.module.css'
import atoms from '../styles/atoms.module.css'
import { Shell } from '../components/Shell'
import { Editor } from '../components/Editor'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toaster'
import { Missing } from './Missing'
import { editPaste, readPaste, hasContent } from '../lib/api'
import type { Paste } from '../lib/api'
import { lineCount, modKey } from '../lib/format'
import { labelFor } from '../lib/language'

/**
 * Editing an existing entry. A password is required even when the entry is
 * already open, because reading and writing are different permissions.
 */
export function Edit() {
  const { slug = '' } = useParams()
  const { announce } = useToast()

  const [original, setOriginal] = useState<Paste | null>(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('plain')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'loading' | 'locked' | 'ready' | 'missing' | 'failed'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // The password typed on the create screen is remembered for this tab only,
  // so the author does not have to retype it to fix a typo in their own entry.
  const rememberedPassword = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(`stow:own:${slug}`)
      return raw ? (JSON.parse(raw) as { password?: string }).password ?? '' : ''
    } catch {
      return ''
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = sessionStorage.getItem(`stow:token:${slug}`) ?? undefined
        const result = await readPaste(slug, token)
        if (cancelled) return
        if (!hasContent(result)) {
          setState('locked')
          return
        }
        setOriginal(result)
        setContent(result.content)
        setTitle(result.title)
        setLanguage(result.language)
        setState('ready')
        if (rememberedPassword) setPassword(rememberedPassword)
      } catch (failure) {
        if (cancelled) return
        const status = (failure as { status?: number }).status
        setState(status === 404 ? 'missing' : 'failed')
        setError(failure instanceof Error ? failure.message : 'This entry could not be loaded.')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug, rememberedPassword])

  const save = useCallback(async () => {
    if (saving) return
    if (!content.trim()) {
      setError('An entry cannot be saved empty.')
      return
    }
    if (!password) {
      setError('Enter the entry password to save changes.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await editPaste(slug, { content, title, language, password })
      setOriginal(updated)
      setMessage('Saved')
      announce('Changes saved')
    } catch (failure) {
      const text = failure instanceof Error ? failure.message : 'Changes were not saved.'
      setError(text)
      announce(text, 'failed')
    } finally {
      setSaving(false)
    }
  }, [announce, content, language, password, saving, slug, title])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  if (state === 'missing') return <Missing />

  if (state === 'loading') {
    return (
      <Shell status={<span>Opening entry</span>}>
        <div className={styles.loading}>
          {Array.from({ length: 10 }, (_, index) => (
            <span
              key={index}
              className={`${atoms.skeleton} ${styles.skeletonLine}`}
              style={{ width: `${40 + ((index * 13) % 50)}%` }}
            />
          ))}
        </div>
      </Shell>
    )
  }

  if (state === 'locked' || state === 'failed') {
    return (
      <Shell status={<span>{state === 'locked' ? 'sealed' : 'unavailable'}</span>}>
        <div className={styles.notice}>
          <h1 className={styles.noticeTitle}>
            {state === 'locked' ? 'This entry is sealed' : 'This entry could not be opened'}
          </h1>
          <p className={styles.noticeNote}>
            {state === 'locked'
              ? 'Open the entry first on its read page, then come back to edit it.'
              : error}
          </p>
          <div className={styles.noticeActions}>
            <Link to={`/p/${slug}`} className={`${atoms.button} ${atoms.buttonPrimary}`}>
              Open the entry
            </Link>
            <Link to="/" className={atoms.button}>
              Write a new one
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  const dirty =
    original !== null &&
    (content !== original.content || title !== original.title || language !== original.language)

  return (
    <Shell
      band={
        <>
          <h1 className={styles.bandTitle}>{title || 'Untitled entry'}</h1>
          <span className={atoms.chip}>{slug}</span>
          {dirty ? <span className={`${atoms.chip} ${atoms.chipSignal}`}>unsaved</span> : null}
        </>
      }
      actions={
        <>
          <Link to={`/p/${slug}`} className={atoms.button}>
            Cancel
          </Link>
          <button
            type="button"
            className={`${atoms.button} ${atoms.buttonPrimary}`}
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? <Icon.Spinner /> : <Icon.Check />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </>
      }
      status={
        <>
          <span>{labelFor(language)}</span>
          <span aria-hidden="true">/</span>
          <span>{lineCount(content)} lines</span>
          <span aria-hidden="true">/</span>
          <span>{dirty ? 'unsaved changes' : 'no changes'}</span>
          {message ? (
            <>
              <span aria-hidden="true">/</span>
              <span className={styles.saved}>{message}</span>
            </>
          ) : null}
        </>
      }
    >
      <div className={styles.split}>
        <section className={styles.write}>
          {error ? (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className={styles.dismiss}>
                Dismiss
              </button>
            </div>
          ) : null}
          <Editor
            value={content}
            onChange={(value) => {
              setContent(value)
              setMessage(null)
            }}
            language={language}
            onLanguage={setLanguage}
            onSubmit={save}
            submitting={saving}
          />
        </section>

        <aside className={styles.rail} aria-label="Entry settings">
          <div className={styles.group}>
            <label className={styles.groupLabel} htmlFor="edit-title">
              Title
            </label>
            <input
              id="edit-title"
              className={atoms.input}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              autoComplete="off"
            />
          </div>

          <div className={styles.group}>
            <label className={styles.groupLabel} htmlFor="edit-password">
              Password
              <span className={atoms.fieldNote}>required</span>
            </label>
            <input
              id="edit-password"
              type="password"
              className={atoms.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Entry password"
              autoComplete="current-password"
            />
          </div>

          <dl className={styles.facts}>
            <div>
              <dt>Slug</dt>
              <dd>{slug}</dd>
            </div>
            <div>
              <dt>Chars</dt>
              <dd>{content.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Shortcut</dt>
              <dd>
                {modKey()} S
              </dd>
            </div>
          </dl>

          <p className={styles.note}>
            Saving replaces the stored text. The link stays the same, and any
            password for reading stays in force.
          </p>
        </aside>
      </div>
    </Shell>
  )
}
