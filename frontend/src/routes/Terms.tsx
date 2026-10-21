import { Link } from 'react-router-dom'
import { DocLayout, DocSection, Note, Code } from '../components/DocLayout'

const CONTENTS = [
  { id: 'what-this-is', heading: 'What this is' },
  { id: 'acceptable-use', heading: 'Acceptable use' },
  { id: 'your-content', heading: 'Your content' },
  { id: 'no-warranty', heading: 'Availability and no warranty' },
  { id: 'removal', heading: 'Removal' },
  { id: 'changes', heading: 'Changes to these terms' },
  { id: 'licence', heading: 'Licence and source' },
]

const UPDATED = '21 October 2026'

export function Terms() {
  return (
    <DocLayout
      title="Terms of use"
      lede={
        <>
          Short version: put your own text in, do not put anything harmful or
          unlawful in, and do not rely on Stow as the only copy of something
          that matters.
        </>
      }
      sections={CONTENTS}
      status={
        <>
          <span>applies to this instance</span>
          <span aria-hidden="true">/</span>
          <span>apache 2.0</span>
        </>
      }
      meta={<div>Updated {UPDATED}</div>}
    >
      <DocSection id="what-this-is" heading="What this is">
        <p>
          Stow is a free, self-hosted paste service. You send it text; it stores
          that text and gives back a link. Using it means accepting these terms.
          If you do not accept them, do not use it.
        </p>
        <p>
          Stow is software, published under the Apache License 2.0. Anyone can
          run an instance. The person or organisation who runs the instance you
          are using is the operator of that instance, and they are the party
          these terms address.
        </p>
      </DocSection>

      <DocSection id="acceptable-use" heading="Acceptable use">
        <p>Do not use Stow to store or distribute:</p>
        <ul>
          <li>Material that is unlawful where you or the operator are located.</li>
          <li>
            Malware, phishing pages, or content designed to deceive someone into
            running it.
          </li>
          <li>
            Another person's private information that you have no permission to
            publish, including credentials, tokens and personal records.
          </li>
          <li>
            Content that sexualises minors, incites violence, or targets someone
            with harassment.
          </li>
          <li>
            Bulk or automated traffic intended to exhaust storage or bandwidth,
            beyond the published rate limits.
          </li>
        </ul>
        <Note>
          Every link is public by default. If an entry needs to stay private,
          set a password and leave read protection on: that withholds the body
          from the server's response until the password is entered. Do not use
          Stow for secrets you could not tolerate becoming public, and never for
          passwords, private keys, or access tokens.
        </Note>
      </DocSection>

      <DocSection id="your-content" heading="Your content">
        <p>
          You keep whatever rights you have in the text you store. You grant the
          operator only the permission needed to run the service: to store the
          text, and to return it to anyone who presents the link or the password.
        </p>
        <p>
          Entries are addressed by a short, random slug. The slug is not a
          secret: treat it as public and treat the link as the access control
          unless a password is set.
        </p>
        <p>
          Deleting is not exposed as an API call, and there is no account to sign
          into. If you need an entry removed before it expires, use the contact
          route described under Removal.
        </p>
      </DocSection>

      <DocSection id="no-warranty" heading="Availability and no warranty">
        <p>
          Stow is provided <strong>as is</strong>, without warranty of any kind,
          express or implied, including fitness for a particular purpose. It may
          be unavailable, and entries may be lost.
        </p>
        <p>
          Expiry deletes an entry permanently the next time it is read. There is
          no trash, no restore, and no backup guarantee. <strong>Do not treat
          Stow as a backup.</strong> Keep your own copy of anything you need.
        </p>
        <p>
          To the fullest extent permitted by law, the operator is not liable for
          any loss arising from use of the service, including lost data, lost
          profits, or business interruption.
        </p>
      </DocSection>

      <DocSection id="removal" heading="Removal">
        <p>
          The operator may remove any entry, without notice, that appears to
          breach the Acceptable use section or the law. Automated abuse is
          blocked by the rate limits documented in the{' '}
          <Link to="/api">API reference</Link>.
        </p>
        <p>
          To report content or request removal, open an issue on the project's
          repository with the link in question.
        </p>
      </DocSection>

      <DocSection id="changes" heading="Changes to these terms">
        <p>
          These terms may change as the software changes. The date at the top of
          this page is the date of the last revision. Continuing to use the
          service after a change means accepting the revised terms.
        </p>
      </DocSection>

      <DocSection id="licence" heading="Licence and source">
        <p>
          The Stow software is licensed under the{' '}
          <a
            href="https://github.com/truepushkar/stow/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer noopener"
          >
            Apache License 2.0
          </a>
          . These terms cover the operation of an instance, not the software
          licence, and they never restrict rights the licence grants you.
        </p>
        <p>
          To read how data is actually handled, see the{' '}
          <Link to="/privacy">privacy notice</Link>. For the technical shape of
          the service, see the <Link to="/api">API reference</Link> or the{' '}
          <Code>/api/health</Code> endpoint.
        </p>
      </DocSection>
    </DocLayout>
  )
}
