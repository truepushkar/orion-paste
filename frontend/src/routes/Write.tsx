import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Write.module.css'
import { Shell } from '../components/Shell'
import { Editor } from '../components/Editor'
import { SettingsRail } from '../components/SettingsRail'
import type { EntrySettings } from '../components/SettingsRail'
import { useToast } from '../components/Toaster'
import { createPaste } from '../lib/api'
import { detectLanguage } from '../lib/language'
import { lineCount } from '../lib/format'

const DRAFT_KEY = 'stow:draft'
const SETTINGS_KEY = 'stow:settings'

const DEFAULT_SETTINGS: EntrySettings = {
  title: '',
  // Markdown first: most pasted text is prose with a little structure in it,
  // and a heading that colours correctly is a better first impression than a
  // wall of undifferentiated bone text.
  language: 'markdown',
  expireDays: 7,
  password: '',
  protectRead: true,
}

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

function readSettings(): EntrySettings {
  try {
    const raw = sessionStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<EntrySettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // A password is never restored: it is a secret, and a restored field
      // would silently re-protect the next entry.
      password: '',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function Write() {
  const navigate = useNavigate()
  const { announce } = useToast()

  const [content, setContent] = useState(readDraft)
  const [settings, setSettings] = useState<EntrySettings>(readSettings)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drafts survive a reload but never leave the tab.
  useEffect(() => {
    try {
      if (content) sessionStorage.setItem(DRAFT_KEY, content)
      else sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // Private mode with storage disabled: the draft simply does not persist.
    }
  }, [content])

  useEffect(() => {
    try {
      sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, password: '' }))
    } catch {
      /* ignore */
    }
  }, [settings])

  const update = useCallback((next: Partial<EntrySettings>) => {
    setSettings((current) => ({ ...current, ...next }))
  }, [])

  const trimmed = content.trim()
  const lineTotal = useMemo(() => lineCount(content), [content])

  const submit = useCallback(async () => {
    if (submitting) return
    if (!trimmed) {
      setError('There is nothing to stow yet. Paste or type something first.')
      announce('Nothing to stow yet', 'failed')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const result = await createPaste({
        content,
        title: settings.title.trim(),
        language:
          settings.language === 'plain' ? detectLanguage(content) : settings.language,
        expireDays: settings.expireDays,
        password: settings.password,
        protectRead: settings.protectRead,
      })

      // The token lets this browser open its own protected entry, and edit it,
      // without asking for the password it just typed.
      if (result.token) {
        try {
          sessionStorage.setItem(`stow:token:${result.slug}`, result.token)
          sessionStorage.setItem(`stow:own:${result.slug}`, JSON.stringify({ password: settings.password }))
        } catch {
          /* ignore */
        }
      }

      sessionStorage.removeItem(DRAFT_KEY)
      setContent('')
      announce('Entry stowed. The link is ready.')
      navigate(`/p/${result.slug}?stowed=1`)
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : 'Stow could not save this entry.'
      setError(message)
      announce(message, 'failed')
    } finally {
      setSubmitting(false)
    }
  }, [announce, content, navigate, settings, submitting, trimmed])

  // Cmd/Ctrl+S also stows, because hands come from editors.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submit])

  return (
    <Shell
      status={
        <>
          <span>{lineTotal === 0 ? 'empty' : `${lineTotal} lines`}</span>
          <span aria-hidden="true">/</span>
          <span>{settings.expireDays === 0 ? 'kept' : `${settings.expireDays}d`}</span>
          <span aria-hidden="true">/</span>
          <span>{settings.password ? 'protected' : 'open link'}</span>
        </>
      }
    >
      <div className={styles.split}>
        <section className={styles.write} aria-label="New entry">
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
            onChange={setContent}
            language={settings.language}
            onLanguage={(language) => update({ language })}
            onSubmit={submit}
            submitting={submitting}
            autoFocus
          />
        </section>

        <SettingsRail
          settings={settings}
          onChange={update}
          disabled={!trimmed}
          submitting={submitting}
          onSubmit={submit}
        />
      </div>
    </Shell>
  )
}
