import { useMemo, useState } from 'react'
import { Prism } from '../lib/prism'
import { Icon } from './Icon'
import { copyText } from '../lib/format'
import styles from './Snippet.module.css'

interface SnippetProps {
  code: string
  language?: string
  /** Shown above the block, as a filename or a request line. */
  label?: string
  copyable?: boolean
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * A code sample in a document. Distinct from CodeView: no line numbers, no
 * wrap toggle, because a sample is read once rather than worked in.
 */
export function Snippet({
  code,
  language = 'bash',
  label,
  copyable = true,
}: SnippetProps) {
  const [copied, setCopied] = useState(false)

  const html = useMemo(() => {
    const grammar = Prism.languages[language]
    const source = code.replace(/\t/g, '  ')
    if (!grammar || language === 'plain') return escapeHtml(source)
    try {
      return Prism.highlight(source, grammar, language)
    } catch {
      return escapeHtml(source)
    }
  }, [code, language])

  const copy = async () => {
    const ok = await copyText(code)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <figure className={styles.snippet}>
      <div className={styles.head}>
        <span className={styles.label}>{label ?? language}</span>
        {copyable ? (
          <button
            type="button"
            className={styles.copy}
            onClick={() => void copy()}
            aria-label={copied ? 'Copied' : 'Copy this sample'}
          >
            {copied ? <Icon.Check size={12} /> : <Icon.Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
      </div>
      <pre className={styles.body}>
        <code
          className="code-text"
          // Prism output generated from text escaped above.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </figure>
  )
}
