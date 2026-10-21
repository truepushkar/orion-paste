import { useEffect, useState } from 'react'
import { Snippet } from '../components/Snippet'
import { DocLayout, DocSection, Note, Code } from '../components/DocLayout'
import styles from './Api.module.css'

interface ApiMeta {
  baseUrl: string
  version: string
  maxContentChars: number
  limits: { create: number; read: number; unlock: number; window: number }
  slugLength: number
  languages: string[]
  defaultLanguage: string
  endpoints: Array<{ method: string; path: string }>
}

const CONTENTS = [
  { id: 'overview', heading: 'Overview' },
  { id: 'authentication', heading: 'Authentication' },
  { id: 'create', heading: 'Create an entry' },
  { id: 'read', heading: 'Read an entry' },
  { id: 'unlock', heading: 'Unlock a protected entry' },
  { id: 'edit', heading: 'Edit an entry' },
  { id: 'raw', heading: 'Raw text' },
  { id: 'errors', heading: 'Errors' },
  { id: 'rate-limits', heading: 'Rate limits' },
  { id: 'languages', heading: 'Language values' },
  { id: 'examples', heading: 'Full examples' },
]

export function Api() {
  const [meta, setMeta] = useState<ApiMeta | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/meta')
      .then((response) => (response.ok ? response.json() : null))
      .then((body: ApiMeta | null) => {
        if (!cancelled && body) setMeta(body)
      })
      .catch(() => {
        // The page reads fine without live limits: the prose names them from
        // the defaults, and the server remains the authority either way.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxChars = (meta?.maxContentChars ?? 500000).toLocaleString()
  const limits = meta?.limits ?? { create: 10, read: 120, unlock: 12, window: 60 }
  const slugLength = meta?.slugLength ?? 7
  const base = meta?.baseUrl ?? window.location.origin

  return (
    <DocLayout
      title="API reference"
      lede={
        <>
          Stow is a JSON API. The web client uses nothing you cannot use: every
          action on the site is one of the six calls below.
        </>
      }
      sections={CONTENTS}
      status={
        <>
          <span>v{meta?.version ?? '2.0'}</span>
          <span aria-hidden="true">/</span>
          <span>json</span>
          <span aria-hidden="true">/</span>
          <span>{meta?.endpoints.length ?? 7} endpoints</span>
        </>
      }
      meta={
        <>
          <div>Version {meta?.version ?? '2.0'}</div>
          <div>Base {base.replace(/^https?:\/\//, '')}</div>
        </>
      }
    >
      <DocSection id="overview" heading="Overview">
        <p>
          All endpoints return JSON except <Code>/raw/&#123;slug&#125;</Code>,
          which returns <Code>text/plain</Code>. Requests and responses use
          UTF-8. There is no SDK and no client library to keep current; the
          surface is six calls.
        </p>
        <p>
          There are no accounts, so there is no API key. A read token is issued
          per entry, by that entry, and only when a password is involved.
        </p>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Method</span>
            <span>Path</span>
            <span>Purpose</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.method} data-method="POST">POST</span>
            <code>/api/pastes</code>
            <span>Store a new entry</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.method} data-method="GET">GET</span>
            <code>/api/pastes/&#123;slug&#125;</code>
            <span>Read an entry</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.method} data-method="POST">POST</span>
            <code>/api/pastes/&#123;slug&#125;/unlock</code>
            <span>Exchange a password for a token</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.method} data-method="POST">POST</span>
            <code>/api/pastes/&#123;slug&#125;/edit</code>
            <span>Replace an entry's text</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.method} data-method="GET">GET</span>
            <code>/raw/&#123;slug&#125;</code>
            <span>Plain-text body</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.method} data-method="GET">GET</span>
            <code>/api/health</code>
            <span>Liveness and storage backend</span>
          </div>
        </div>
      </DocSection>

      <DocSection id="authentication" heading="Authentication">
        <p>
          There is nothing to authenticate with. Creating an entry is open, and
          reading one requires only its slug.
        </p>
        <p>
          When an entry has <Strong>read protection</Strong>, its body is
          withheld by the server until a password is exchanged for a token at
          the unlock endpoint. Pass that token as a query parameter:
          <Code>?token=&lt;token&gt;</Code>. The token also works on the raw
          endpoint.
        </p>
        <Note>
          Tokens are HMAC-signed against the entry's current password. If the
          password is ever replaced, every token issued before that point stops
          working. Tokens are not JWTs and carry no readable claims; treat them
          as opaque strings.
        </Note>
      </DocSection>

      <DocSection id="create" heading="Create an entry">
        <div className={styles.sig}>
          <span className={styles.method} data-method="POST">POST</span>
          <code>/api/pastes</code>
          <span className={styles.sigNote}>201 Created</span>
        </div>
        <p>Request body:</p>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Field</span>
            <span>Type</span>
            <span>Notes</span>
          </div>
          <div className={styles.tableRow}>
            <code>content</code>
            <span>string</span>
            <span>Required. Max {maxChars} characters.</span>
          </div>
          <div className={styles.tableRow}>
            <code>title</code>
            <span>string</span>
            <span>Optional. Truncated to 160 characters.</span>
          </div>
          <div className={styles.tableRow}>
            <code>language</code>
            <span>string</span>
            <span>Optional. Defaults to <Code>markdown</Code>. Any value in the language list; unknown values fall back to <Code>plain</Code>.</span>
          </div>
          <div className={styles.tableRow}>
            <code>expireDays</code>
            <span>integer</span>
            <span>Optional. 0 to 3650. 0 means no expiry.</span>
          </div>
          <div className={styles.tableRow}>
            <code>password</code>
            <span>string</span>
            <span>Optional. Enables editing, and read protection if requested.</span>
          </div>
          <div className={styles.tableRow}>
            <code>protectRead</code>
            <span>boolean</span>
            <span>Default <Code>true</Code>. Requires a password to have any effect.</span>
          </div>
        </div>

        <Snippet
          label="Request"
          language="bash"
          code={`curl -X POST ${base}/api/pastes \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "def relieve(outgoing, incoming):\\n    return 0\\n",
    "title": "Watch change",
    "language": "python",
    "expireDays": 7,
    "password": "harbor-lamp",
    "protectRead": true
  }'`}
        />
        <Snippet
          label="Response 201"
          language="json"
          code={`{
  "slug": "k7Rq2mB",
  "url": "${base}/p/k7Rq2mB",
  "rawUrl": "${base}/raw/k7Rq2mB",
  "title": "Watch change",
  "language": "python",
  "expiresAt": "2026-10-28T14:13:11.351670+00:00",
  "protected": true,
  "editable": true,
  "token": "9f2c…"
}`}
        />
        <Note>
          A token is returned on creation only when a password was set, so the
          creator can open their own protected entry without retyping it. The
          slug is {slugLength} characters drawn from an alphabet that omits
          characters which are misread aloud.
        </Note>
      </DocSection>

      <DocSection id="read" heading="Read an entry">
        <div className={styles.sig}>
          <span className={styles.method} data-method="GET">GET</span>
          <code>/api/pastes/&#123;slug&#125;</code>
          <span className={styles.sigNote}>200 OK</span>
        </div>
        <p>
          Returns the entry. If the entry is read-protected and no valid token
          is supplied, the response is <Strong>200 with metadata only</Strong>:
          the body is absent, not empty. Check the <Code>protected</Code> flag
          and the presence of a <Code>content</Code> key rather than testing for
          an empty string.
        </p>
        <Snippet
          label="Response 200, open entry"
          language="json"
          code={`{
  "slug": "k7Rq2mB",
  "title": "Watch change",
  "language": "python",
  "content": "def relieve(outgoing, incoming):\\n    return 0\\n",
  "createdAt": "2026-10-21T14:13:11.351670+00:00",
  "updatedAt": null,
  "expiresAt": "2026-10-28T14:13:11.351670+00:00",
  "protected": false,
  "editable": true,
  "lines": 2,
  "chars": 45,
  "rawUrl": "${base}/raw/k7Rq2mB"
}`}
        />
        <Snippet
          label="Response 200, protected and sealed"
          language="json"
          code={`{
  "slug": "k7Rq2mB",
  "protected": true,
  "title": "Watch change",
  "createdAt": "2026-10-21T14:13:11.351670+00:00",
  "expiresAt": "2026-10-28T14:13:11.351670+00:00"
}`}
        />
        <Note>
          An expired entry is deleted at the moment it is read, and the response
          is 404. There is no separate cleanup pass and no recovery.
        </Note>
      </DocSection>

      <DocSection id="unlock" heading="Unlock a protected entry">
        <div className={styles.sig}>
          <span className={styles.method} data-method="POST">POST</span>
          <code>/api/pastes/&#123;slug&#125;/unlock</code>
          <span className={styles.sigNote}>200 OK</span>
        </div>
        <Snippet
          label="Request"
          language="bash"
          code={`curl -X POST ${base}/api/pastes/k7Rq2mB/unlock \\
  -H "Content-Type: application/json" \\
  -d '{"password": "harbor-lamp"}'`}
        />
        <p>
          A correct password returns the full entry plus a <Code>token</Code>.
          Use it on later reads:
          <Code>/api/pastes/k7Rq2mB?token=…</Code>
        </p>
        <p>
          A wrong password returns <Code>401</Code> and no body text. Attempts
          are rate limited to {limits.unlock} per {limits.window} seconds per
          address, which makes guessing impractical for any reasonable password.
        </p>
      </DocSection>

      <DocSection id="edit" heading="Edit an entry">
        <div className={styles.sig}>
          <span className={styles.method} data-method="POST">POST</span>
          <code>/api/pastes/&#123;slug&#125;/edit</code>
          <span className={styles.sigNote}>200 OK</span>
        </div>
        <p>
          Replaces the stored text. Always requires the entry's password, even
          when the entry is not read-protected: reading and writing are separate
          permissions. Entries created without a password cannot be edited, and
          return <Code>403</Code>.
        </p>
        <Snippet
          label="Request"
          language="bash"
          code={`curl -X POST ${base}/api/pastes/k7Rq2mB/edit \\
  -H "Content-Type: application/json" \\
  -d '{
    "password": "harbor-lamp",
    "content": "# revised\\nimport os\\n",
    "title": "Watch change (revised)",
    "language": "python"
  }'`}
        />
        <Note>
          The slug does not change when an entry is edited, so existing links
          keep working. Deleting an entry is not exposed over the API.
        </Note>
      </DocSection>

      <DocSection id="raw" heading="Raw text">
        <div className={styles.sig}>
          <span className={styles.method} data-method="GET">GET</span>
          <code>/raw/&#123;slug&#125;</code>
          <span className={styles.sigNote}>200 OK</span>
        </div>
        <p>
          Returns the entry body as <Code>text/plain; charset=utf-8</Code>, with
          no wrapper and no trailing transformation. Suitable for{' '}
          <Code>curl</Code>, <Code>wget</Code>, and scripts that pipe it
          somewhere.
        </p>
        <p>
          For a read-protected entry this returns <Code>401</Code> unless a valid
          token is supplied, so the body is never exposed to an unauthenticated
          request even though the endpoint is plain text.
        </p>
        <Snippet
          label="Request"
          language="bash"
          code={`# Open entry
curl ${base}/raw/k7Rq2mB

# Protected entry
curl "${base}/raw/k7Rq2mB?token=9f2c…"`}
        />
      </DocSection>

      <DocSection id="errors" heading="Errors">
        <p>
          Errors are JSON with a single human-readable <Code>error</Code> field.
          The message is written to be shown to a person as-is, so clients can
          display it directly.
        </p>
        <Snippet
          label="Shape"
          language="json"
          code={`{
  "error": "That password does not open this entry."
}`}
        />
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Status</span>
            <span>Meaning</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>400</span>
            <span>Missing or empty content, or a malformed body.</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>401</span>
            <span>Wrong password, or a missing/invalid token on a protected entry.</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>403</span>
            <span>Editing an entry that was created without a password.</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>404</span>
            <span>No such entry, or it expired and was deleted.</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>413</span>
            <span>Content exceeds {maxChars} characters.</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>429</span>
            <span>Rate limit exceeded. See <Code>retryAfter</Code> and the <Code>Retry-After</Code> header.</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.status}>500</span>
            <span>Server error. Nothing was written.</span>
          </div>
        </div>
      </DocSection>

      <DocSection id="rate-limits" heading="Rate limits">
        <p>
          Limits apply per client address and per scope, over a rolling{' '}
          {limits.window}-second window. A burst of reads never consumes the
          quota for creating entries.
        </p>
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Scope</span>
            <span>Requests</span>
            <span>Window</span>
          </div>
          <div className={styles.tableRow}>
            <code>create</code>
            <span>{limits.create}</span>
            <span>{limits.window}s</span>
          </div>
          <div className={styles.tableRow}>
            <code>read</code>
            <span>{limits.read}</span>
            <span>{limits.window}s</span>
          </div>
          <div className={styles.tableRow}>
            <code>unlock</code>
            <span>{limits.unlock}</span>
            <span>{limits.window}s</span>
          </div>
        </div>
        <p>
          A refused request returns <Code>429</Code> with a{' '}
          <Code>Retry-After</Code> header and a <Code>retryAfter</Code> field in
          seconds. Wait that long before trying again.
        </p>
        <Note>
          Limits are enforced per process. A multi-worker deployment multiplies
          the effective quota, which is a deliberate trade for running without
          shared state. The numbers above are this deployment's live values,
          read from <Code>/api/meta</Code>.
        </Note>
      </DocSection>

      <DocSection id="languages" heading="Language values">
        <p>
          The <Code>language</Code> field is a hint for the highlighter. Stow
          stores any entry as text regardless of this value; an unrecognised one
          is normalised to <Code>plain</Code>.
        </p>
        <p className={styles.languageList}>
          {(meta?.languages ?? [
            'markdown', 'plain', 'bash', 'c', 'cpp', 'csharp', 'css', 'diff',
            'go', 'graphql', 'ini', 'java', 'javascript', 'json', 'jsx',
            'kotlin', 'lua', 'markup', 'php', 'python', 'ruby', 'rust', 'sql',
            'swift', 'toml', 'tsx', 'typescript', 'yaml',
          ]).join(' · ')}
        </p>
        <p>
          The default is <Code>{meta?.defaultLanguage ?? 'markdown'}</Code>,
          because most pasted text is prose with a little structure in it.
          Sending no <Code>language</Code> at all gives you the default; sending
          an unrecognised value gives you <Code>plain</Code>. Common aliases
          such as <Code>md</Code>, <Code>js</Code>, <Code>py</Code>,{' '}
          <Code>yml</Code>, <Code>sh</Code> and <Code>html</Code> are accepted
          and stored under their canonical name.
        </p>
      </DocSection>

      <DocSection id="examples" heading="Full examples">
        <p>A complete round trip in a shell, using no tooling beyond curl:</p>
        <Snippet
          label="Shell"
          language="bash"
          code={`# 1. Stow an entry and capture its slug
slug=$(curl -s -X POST ${base}/api/pastes \\
  -H "Content-Type: application/json" \\
  -d '{"content":"hello from a script\\n","language":"plain"}' \\
  | sed -n 's/.*"slug": *"\\([^"]*\\)".*/\\1/p')

echo "${base}/p/$slug"

# 2. Read it back
curl -s "${base}/api/pastes/$slug"

# 3. Pipe the raw text somewhere useful
curl -s "${base}/raw/$slug" > note.txt`}
        />
        <Snippet
          label="Python"
          language="python"
          code={`import json
import urllib.request

BASE = "${base}"

request = urllib.request.Request(
    f"{BASE}/api/pastes",
    data=json.dumps({
        "content": "hello from a script\\n",
        "language": "plain",
        "expireDays": 1,
    }).encode(),
    headers={"Content-Type": "application/json"},
)

with urllib.request.urlopen(request) as response:
    entry = json.load(response)

print(entry["url"])`}
        />
        <Snippet
          label="JavaScript"
          language="javascript"
          code={`const base = "${base}";

const response = await fetch(\`\${base}/api/pastes\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content: "hello from a script\\n",
    language: "plain",
    expireDays: 1,
  }),
});

const entry = await response.json();
console.log(entry.url);`}
        />
      </DocSection>
    </DocLayout>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong>{children}</strong>
}
