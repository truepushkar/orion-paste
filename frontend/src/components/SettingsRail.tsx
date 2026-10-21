import { useId } from 'react'
import styles from './SettingsRail.module.css'
import atoms from '../styles/atoms.module.css'
import { Icon } from './Icon'
import { LANGUAGES, labelFor } from '../lib/language'

export interface EntrySettings {
  title: string
  language: string
  expireDays: number
  password: string
  protectRead: boolean
}

const EXPIRY = [
  { days: 0, label: '\u221e', title: 'Never expires' },
  { days: 1, label: '1d', title: 'Expires after one day' },
  { days: 7, label: '7d', title: 'Expires after seven days' },
  { days: 30, label: '30d', title: 'Expires after thirty days' },
  { days: 90, label: '90d', title: 'Expires after ninety days' },
]

export function SettingsRail({
  settings,
  onChange,
  disabled,
  submitting,
  onSubmit,
}: {
  settings: EntrySettings
  onChange: (next: Partial<EntrySettings>) => void
  disabled: boolean
  submitting: boolean
  onSubmit: () => void
}) {
  const titleId = useId()
  const passwordId = useId()
  const languageId = useId()
  const readId = useId()

  const hasPassword = settings.password.length > 0

  return (
    <aside className={styles.rail} aria-label="Entry settings">
      <div className={styles.group}>
        <label className={styles.groupLabel} htmlFor={titleId}>
          Title
          <span className={atoms.fieldNote}>optional</span>
        </label>
        <input
          id={titleId}
          className={atoms.input}
          value={settings.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Watch-change procedure"
          maxLength={160}
          autoComplete="off"
          disabled={disabled || submitting}
        />
      </div>

      <div className={styles.group}>
        <label className={styles.groupLabel} htmlFor={languageId}>
          Language
        </label>
        <select
          id={languageId}
          className={`${atoms.input} ${styles.select}`}
          value={settings.language}
          onChange={(event) => onChange({ language: event.target.value })}
          disabled={disabled || submitting}
        >
          {LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {labelFor(language)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>
          Retention
          <span className={atoms.fieldNote}>
            {settings.expireDays === 0 ? 'kept until deleted' : `${settings.expireDays} days`}
          </span>
        </span>
        <div className={atoms.segment} role="group" aria-label="Retention period">
          {EXPIRY.map((option) => (
            <button
              key={option.days}
              type="button"
              title={option.title}
              aria-pressed={settings.expireDays === option.days}
              data-on={settings.expireDays === option.days}
              className={atoms.segmentOption}
              onClick={() => onChange({ expireDays: option.days })}
              disabled={disabled || submitting}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.groupLabel} htmlFor={passwordId}>
          Password
          <span className={atoms.fieldNote}>optional</span>
        </label>
        <div className={styles.passwordRow}>
          <Icon.Key />
          <input
            id={passwordId}
            type="password"
            className={`${atoms.input} ${styles.passwordInput}`}
            value={settings.password}
            onChange={(event) => onChange({ password: event.target.value })}
            placeholder="not set"
            autoComplete="new-password"
            disabled={disabled || submitting}
          />
        </div>

        <button
          type="button"
          id={readId}
          className={styles.switchRow}
          data-on={settings.protectRead && hasPassword}
          onClick={() => onChange({ protectRead: !settings.protectRead })}
          disabled={!hasPassword || disabled || submitting}
          aria-pressed={settings.protectRead && hasPassword}
        >
          <span
            className={atoms.switch}
            data-on={settings.protectRead && hasPassword}
            aria-hidden="true"
          />
          <span className={styles.switchCopy}>
            <span className={styles.switchTitle}>Require it to read</span>
            <span className={styles.switchNote}>
              {hasPassword
                ? settings.protectRead
                  ? 'The link alone will not open it.'
                  : 'Anyone with the link can read it.'
                : 'Set a password first.'}
            </span>
          </span>
        </button>
      </div>

      <div className={styles.action}>
        <button
          type="button"
          className={`${atoms.button} ${atoms.buttonPrimary} ${styles.submit}`}
          onClick={onSubmit}
          disabled={disabled || submitting}
        >
          {submitting ? (
            <>
              <Icon.Spinner />
              Stowing
            </>
          ) : (
            <>
              <Icon.Stow />
              Stow entry
            </>
          )}
        </button>
        <p className={styles.actionNote}>
          {hasPassword && settings.protectRead
            ? 'A password is required to read and to edit this entry.'
            : hasPassword
              ? 'Anyone with the link can read. The password is required to edit.'
              : 'Anyone with the link can read this entry.'}
        </p>
      </div>
    </aside>
  )
}
