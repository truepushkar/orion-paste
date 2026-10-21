import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './Unlock.module.css'
import atoms from '../styles/atoms.module.css'
import { Shell, Wordmark } from '../components/Shell'
import { Icon } from '../components/Icon'
import { absoluteTime } from '../lib/format'

/**
 * The only screen in the app that interrupts. It interrupts on purpose: the
 * body behind it is not fetched until the password is right, so there is
 * nothing to show and nothing to hide.
 */
export function UnlockPanel({
  slug,
  title,
  createdAt,
  onUnlock,
  unlocking,
}: {
  slug: string
  title: string
  createdAt: string | null
  onUnlock: (password: string) => Promise<string | null>
  unlocking: boolean
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reveal, setReveal] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password || unlocking) return
    setError(null)
    const failure = await onUnlock(password)
    if (failure) {
      setError(failure)
      setPassword('')
      input.current?.focus()
    }
  }

  return (
    <Shell
      band={
        <>
          <h1 className={styles.title}>{title || 'Protected entry'}</h1>
          <span className={`${atoms.chip} ${atoms.chipSignal}`}>
            <Icon.Lock size={11} />
            protected
          </span>
        </>
      }
    >
      <div className={styles.wrap}>
        <form className={styles.panel} onSubmit={submit}>
          <div className={styles.heading}>
            <Wordmark />
            <div>
              <h2 className={styles.headline}>Enter its password</h2>
            </div>
          </div>

          <p className={styles.note}>
            The author set a password, so the contents are not sent to this browser
            until it is entered. Nothing is guessable from the link alone.
          </p>

          <div className={styles.controls}>
            <div className={styles.inputRow}>
              <input
                ref={input}
                type={reveal ? 'text' : 'password'}
                className={`${atoms.input} ${styles.input}`}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError(null)
                }}
                placeholder="Password"
                aria-label="Password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'unlock-error' : undefined}
                autoComplete="current-password"
                disabled={unlocking}
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setReveal((value) => !value)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                aria-pressed={reveal}
              >
                {reveal ? <Icon.EyeOff /> : <Icon.Eye />}
              </button>
            </div>

            <button
              type="submit"
              className={`${atoms.button} ${atoms.buttonPrimary} ${styles.submit}`}
              disabled={!password || unlocking}
            >
              {unlocking ? (
                <>
                  <Icon.Spinner />
                  Opening
                </>
              ) : (
                <>
                  <Icon.Unlock />
                  Open entry
                </>
              )}
            </button>
          </div>

          {error ? (
            <p id="unlock-error" className={styles.error} role="alert">
              <Icon.Alert size={13} />
              {error}
            </p>
          ) : null}

          <div className={styles.meta}>
            <span className={styles.slug}>{slug}</span>
            {createdAt ? <span className={styles.dot} aria-hidden="true" /> : null}
            {createdAt ? <span>{absoluteTime(createdAt)}</span> : null}
          </div>

          <Link to="/" className={styles.escape}>
            Write a new entry instead
          </Link>
        </form>
      </div>
    </Shell>
  )
}
