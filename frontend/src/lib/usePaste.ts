import { useCallback, useEffect, useState } from 'react'
import { readPaste, unlockPaste, hasContent } from '../lib/api'
import type { Paste } from '../lib/api'

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'locked'; title: string; createdAt: string | null }
  | { status: 'ready'; paste: Paste }
  | { status: 'failed'; message: string }

interface UsePaste {
  state: State
  unlock: (password: string) => Promise<string | null>
  unlocking: boolean
}

/** Reads a paste, and holds its unlocked token for this tab so a refresh of
 *  a protected entry does not ask for the password twice. */
export function usePaste(slug: string): UsePaste {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [unlocking, setUnlocking] = useState(false)

  const tokenKey = `stow:token:${slug}`

  const load = useCallback(async () => {
    try {
      const stored = sessionStorage.getItem(tokenKey) ?? undefined
      const result = await readPaste(slug, stored)
      if (hasContent(result)) {
        setState({ status: 'ready', paste: result })
        return
      }
      sessionStorage.removeItem(tokenKey)
      setState({
        status: 'locked',
        title: result.title,
        createdAt: result.createdAt,
      })
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 404) {
        setState({ status: 'missing' })
        return
      }
      setState({
        status: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'Stow could not load this entry.',
      })
    }
  }, [slug, tokenKey])

  useEffect(() => {
    void load()
  }, [load])

  const unlock = useCallback(
    async (password: string) => {
      setUnlocking(true)
      try {
        const paste = await unlockPaste(slug, password)
        if (paste.token) sessionStorage.setItem(tokenKey, paste.token)
        setState({ status: 'ready', paste })
        return null
      } catch (error) {
        return error instanceof Error
          ? error.message
          : 'That password does not open this entry.'
      } finally {
        setUnlocking(false)
      }
    },
    [slug, tokenKey],
  )

  return { state, unlock, unlocking }
}
