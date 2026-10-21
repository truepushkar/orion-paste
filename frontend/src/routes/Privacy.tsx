import { Link } from 'react-router-dom'
import { DocLayout, DocSection, Note, Code } from '../components/DocLayout'

const CONTENTS = [
  { id: 'summary', heading: 'In short' },
  { id: 'what-is-stored', heading: 'What is stored' },
  { id: 'what-is-not', heading: 'What is not collected' },
  { id: 'browser-storage', heading: 'Storage in your browser' },
  { id: 'logs', heading: 'Server logs' },
  { id: 'passwords', heading: 'Passwords' },
  { id: 'third-parties', heading: 'Third parties' },
  { id: 'your-choices', heading: 'Your choices' },
]

const UPDATED = '21 October 2026'

export function Privacy() {
  return (
    <DocLayout
      title="Privacy notice"
      lede={
        <>
          Stow has no accounts, no analytics, and no advertising. This page says
          exactly what the software stores, so you can decide what to put in it.
        </>
      }
      sections={CONTENTS}
      status={
        <>
          <span>no cookies</span>
          <span aria-hidden="true">/</span>
          <span>no analytics</span>
          <span aria-hidden="true">/</span>
          <span>no accounts</span>
        </>
      }
      meta={<div>Updated {UPDATED}</div>}
    >
      <DocSection id="summary" heading="In short">
        <ul>
          <li>No account, no email address, no name.</li>
          <li>No analytics, no tracking pixels, no advertising identifiers.</li>
          <li>No cookies are set by Stow.</li>
          <li>
            The text you paste is stored on the server until it expires or is
            removed, and is readable by anyone holding the link unless you set a
            password.
          </li>
        </ul>
      </DocSection>

      <DocSection id="what-is-stored" heading="What is stored">
        <p>For each entry, the server stores:</p>
        <ul>
          <li>The text you pasted.</li>
          <li>Its title, if you gave one.</li>
          <li>A language hint, used only for syntax highlighting.</li>
          <li>The time it was created, and the time it was last edited.</li>
          <li>Its expiry time, if you set one.</li>
          <li>
            A one-way hash of the password, if you set one. The password itself
            is never stored.
          </li>
          <li>
            Whether read protection is on. This is a flag, not a secret.
          </li>
        </ul>
        <p>
          That is the entire record. There is no user table, no session table,
          and nothing linking one entry to another or to a person.
        </p>
      </DocSection>

      <DocSection id="what-is-not" heading="What is not collected">
        <ul>
          <li>No IP address is written to storage. It is used in memory, for rate limiting, and then discarded.</li>
          <li>No user agent, referrer, or device fingerprint is stored.</li>
          <li>No location data.</li>
          <li>No email address, because none is ever asked for.</li>
          <li>No cookies, and no third-party scripts of any kind.</li>
        </ul>
      </DocSection>

      <DocSection id="browser-storage" heading="Storage in your browser">
        <p>
          Stow does not use cookies. It uses{' '}
          <Code>sessionStorage</Code>, which is scoped to one tab and cleared
          when that tab closes. Three things are kept there, and none of them
          are transmitted anywhere except to the server that issued them:
        </p>
        <ul>
          <li>
            <strong>Your unfinished draft.</strong> So a reload does not lose the
            text you were writing. Cleared when the entry is stowed.
          </li>
          <li>
            <strong>Read tokens.</strong> So a protected entry you unlocked does
            not ask for its password again on every page load within that tab.
          </li>
          <li>
            <strong>The password you just set</strong>, when you created an
            entry, so you can edit your own entry in the same tab without
            retyping it. This is the one item worth knowing about; it lives in
            that tab's memory and nowhere else, and it is discarded when the tab
            closes.
          </li>
        </ul>
        <p>
          Clearing site data for this origin removes all three immediately.
        </p>
      </DocSection>

      <DocSection id="logs" heading="Server logs">
        <p>
          A reverse proxy or hosting platform in front of Stow will typically
          record each request, including the client address and the path. That
          is outside the application's control and depends on how the instance is
          deployed.
        </p>
        <p>
          One consequence worth stating plainly: <strong>a paste link contains
          its slug</strong>, so a request log records which entries were read and
          when, if not by whom in any durable sense.
        </p>
      </DocSection>

      <DocSection id="passwords" heading="Passwords">
        <p>
          Passwords are hashed with a salted, deliberately slow function before
          storage. The plaintext is never written to disk or to a log.
        </p>
        <p>
          A password gates two separate things. <strong>Edit access</strong>{' '}
          always requires it. <strong>Read protection</strong> is a choice made
          when the entry is created: when it is on, the server withholds the body
          until the password is verified, so the link alone reveals nothing. When
          it is off, the entry is readable by anyone with the link and the
          password only protects editing.
        </p>
        <Note>
          There is no password recovery. There is no account behind an entry and
          no email address to send a reset to. If you forget the password, the
          entry cannot be edited, and if read protection is on it cannot be read.
        </Note>
      </DocSection>

      <DocSection id="third-parties" heading="Third parties">
        <p>
          No third-party analytics, fonts, CDNs, or scripts are loaded by the
          client. Fonts are self-hosted. Syntax highlighting runs locally in your
          browser.
        </p>
        <p>
          The only outbound link in the interface points at the project's source
          repository, and it is a link: nothing is requested until you click it.
        </p>
      </DocSection>

      <DocSection id="your-choices" heading="Your choices">
        <ul>
          <li>
            <strong>Set an expiry.</strong> From one day to ninety, or leave it
            open. Expired entries are deleted the next time they are read.
          </li>
          <li>
            <strong>Set a password</strong> and leave read protection on. Nothing
            is returned until it is verified.
          </li>
          <li>
            <strong>Do not paste secrets.</strong> The most reliable protection
            is not putting a credential into a paste box at all.
          </li>
          <li>
            <strong>Clear this site's data</strong> in your browser to remove the
            draft, tokens and remembered password held in that tab.
          </li>
        </ul>
        <p>
          For how the service may be used, see the <Link to="/terms">terms of
          use</Link>. For what the API returns and when, see the{' '}
          <Link to="/api">API reference</Link>.
        </p>
      </DocSection>
    </DocLayout>
  )
}
