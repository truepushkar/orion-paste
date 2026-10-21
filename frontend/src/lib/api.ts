// Typed access to the Stow API. Every network call in the app goes through
// here so error shape and base URL live in exactly one place.

export interface PasteSummary {
  slug: string
  title: string
  language: string
  createdAt: string | null
  expiresAt: string | null
  protected: boolean
  editable?: boolean
  rawUrl?: string
  token?: string
}

export interface Paste extends PasteSummary {
  content: string
  updatedAt: string | null
  lines: number
  chars: number
}

export interface CreateResponse extends PasteSummary {
  url: string
  rawUrl: string
  token?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('Stow could not reach the server. Check the connection.', 0)
  }

  const raw = await response.text()
  let body: unknown = null
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const message =
      (body as { error?: string } | null)?.error ??
      `Request failed with status ${response.status}.`
    throw new ApiError(message, response.status)
  }

  return body as T
}

export interface CreateInput {
  content: string
  title: string
  language: string
  expireDays: number
  password: string
  protectRead: boolean
}

export function createPaste(input: CreateInput) {
  return request<CreateResponse>('/api/pastes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function readPaste(slug: string, token?: string) {
  const query = token ? `?token=${encodeURIComponent(token)}` : ''
  return request<Paste | PasteSummary>(`/api/pastes/${encodeURIComponent(slug)}${query}`)
}

export function unlockPaste(slug: string, password: string) {
  return request<Paste>(`/api/pastes/${encodeURIComponent(slug)}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function editPaste(
  slug: string,
  input: { content: string; title: string; language: string; password: string },
) {
  return request<Paste>(`/api/pastes/${encodeURIComponent(slug)}/edit`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function hasContent(paste: Paste | PasteSummary): paste is Paste {
  return typeof (paste as Paste).content === 'string'
}
