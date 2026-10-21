import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Toaster.module.css'

export type ToastTone = 'done' | 'failed' | 'note'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

interface ToastApi {
  announce: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <Toaster>')
  return api
}

/** One toast at a time: a paste tool has one thing to say at a time. */
export function Toaster({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | null>(null)
  const seq = useRef(0)

  const announce = useCallback((message: string, tone: ToastTone = 'done') => {
    if (timer.current) window.clearTimeout(timer.current)
    seq.current += 1
    setToast({ id: seq.current, message, tone })
    timer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const api = useMemo(() => ({ announce }), [announce])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport} role="status" aria-live="polite">
        {toast ? (
          <div key={toast.id} className={styles.toast} data-tone={toast.tone}>
            <span className={styles.mark} aria-hidden="true" />
            <span className={styles.message}>{toast.message}</span>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}
