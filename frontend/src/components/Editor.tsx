import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Prism } from '../lib/prism'
import styles from './Editor.module.css'
import { detectLanguage, labelFor } from '../lib/language'
import { countWords, lineCount, modKey } from '../lib/format'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  language: string
  onLanguage: (language: string) => void
  onSubmit: () => void
  submitting: boolean
  autoFocus?: boolean
  placeholder?: string
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Highlight line by line so the gutter can be real rows. */
function highlightLines(code: string, language: string): string {
  const source = code.replace(/\t/g, '  ')
  const grammar = Prism.languages[language]
  return source
    .split('\n')
    .map((line) => {
      if (!line) return ''
      if (!grammar || language === 'plain') return escapeHtml(line)
      try {
        return Prism.highlight(line, grammar, language)
      } catch {
        return escapeHtml(line)
      }
    })
    .join('\n')
}

/**
 * The writing field.
 *
 * A transparent textarea sits exactly on top of a highlighted <pre>. Both use
 * the same font, size and line height, so the caret lands where the colour is.
 * The gutter is a separate column that scrolls with the text rather than
 * against it.
 */
export function Editor({
  value,
  onChange,
  language,
  onLanguage,
  onSubmit,
  submitting,
  autoFocus,
  placeholder = 'Paste or type here. Code, logs, config, a note to yourself.',
}: EditorProps) {
  const area = useRef<HTMLTextAreaElement>(null)
  const highlight = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [caret, setCaret] = useState({ line: 1, column: 1 })
  const [detected, setDetected] = useState<string | null>(null)

  const highlighted = useMemo(() => highlightLines(value, language), [value, language])
  const lines = useMemo(() => lineCount(value), [value])
  const words = useMemo(() => countWords(value), [value])

  const syncScroll = useCallback(() => {
    const node = area.current
    if (!node) return
    if (highlight.current) {
      highlight.current.scrollTop = node.scrollTop
      highlight.current.scrollLeft = node.scrollLeft
    }
    if (gutter.current) gutter.current.scrollTop = node.scrollTop
  }, [])

  const updateCaret = useCallback(() => {
    const node = area.current
    if (!node) return
    const upto = node.value.slice(0, node.selectionStart)
    const split = upto.split('\n')
    setCaret({ line: split.length, column: (split.at(-1)?.length ?? 0) + 1 })
  }, [])

  const detect = useCallback(() => {
    const node = area.current
    if (!node) return
    // Only offer a suggestion while the field is still on one of the two
    // "unspecified" values. Once the visitor has picked a language, that
    // choice is theirs and the editor stops second-guessing it.
    if (language !== 'plain' && language !== 'markdown') {
      setDetected(null)
      return
    }
    const guess = detectLanguage(node.value)
    // Never suggest what is already selected.
    setDetected(guess === 'plain' || guess === language ? null : guess)
  }, [language])

  // Keep the caret row in view while typing at the bottom of a long entry.
  useLayoutEffect(() => {
    syncScroll()
  }, [value, syncScroll])

  useEffect(() => {
    if (autoFocus) area.current?.focus()
  }, [autoFocus])

  const applyDetected = () => {
    if (!detected) return
    onLanguage(detected)
    setDetected(null)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      onSubmit()
      return
    }
    if (event.key === 'Tab') {
      // Indent rather than leave the field: this is a code surface.
      event.preventDefault()
      const node = event.currentTarget
      const start = node.selectionStart
      const end = node.selectionEnd
      const next = `${value.slice(0, start)}  ${value.slice(end)}`
      onChange(next)
      requestAnimationFrame(() => {
        node.selectionStart = start + 2
        node.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className={styles.editor} data-focused={focused ? 'true' : undefined}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.label}>Entry</span>
          {detected ? (
            <button type="button" className={styles.detected} onClick={applyDetected}>
              {labelFor(detected)} detected. Use it
            </button>
          ) : null}
        </div>
        <div className={styles.headRight}>
          <span className={styles.counts}>
            <span>{lines}</span> lines
            <span className={styles.dot} />
            <span>{words}</span> words
            <span className={styles.dot} />
            <span>{value.length.toLocaleString()}</span> chars
          </span>
        </div>
      </div>

      <div className={styles.surface}>
        <div ref={gutter} className={styles.gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => (
            <span key={index} data-current={caret.line === index + 1 ? 'true' : undefined}>
              {index + 1}
            </span>
          ))}
        </div>

        <div className={styles.field}>
          <pre ref={highlight} className={`${styles.highlight} code-text`} aria-hidden="true">
            <code
              className="code-text"
              // Generated from escaped text above; the entry is never inserted
              // as HTML anywhere in this app.
              dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }}
            />
          </pre>

          <textarea
            ref={area}
            className={styles.input}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCaret}
            onClick={updateCaret}
            onSelect={updateCaret}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              detect()
            }}
            onPaste={() => {
              // Let the paste land, then read the field.
              requestAnimationFrame(() => {
                updateCaret()
                detect()
              })
            }}
            onDrop={() => {
              requestAnimationFrame(() => {
                updateCaret()
                detect()
              })
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label="Entry content"
            placeholder={placeholder}
            disabled={submitting}
          />
        </div>
      </div>

      <div className={styles.foot}>
        <span className={styles.position}>
          Ln {caret.line}, Col {caret.column}
        </span>
        <span className={styles.hint}>
          <span className={styles.kbd}>{modKey()}</span>
          <span className={styles.kbd}>Enter</span>
          to stow
        </span>
      </div>
    </div>
  )
}
