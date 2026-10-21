/**
 * Markdown rendering.
 *
 * Two things matter here beyond correctness:
 *
 * 1. Safety. Pasted text is untrusted. `html: false` stops raw HTML in the
 *    source from reaching the DOM, and markdown-it escapes anything it does
 *    not recognise as Markdown. Links get `rel="nofollow ugc noopener"` and
 *    open in a new tab, so a paste cannot silently pass its search reputation
 *    on, and cannot reach back through `window.opener`.
 *
 * 2. Not breaking out. The renderer is only ever used on a paste body, never
 *    on our own copy, so there is no markup of ours for a visitor to interfere
 *    with.
 */
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
})

// External links open in a new tab and carry no SEO or opener privileges.
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index]
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'nofollow ugc noopener noreferrer')
  return defaultLinkOpen(tokens, index, options, env, self)
}

// A fenced block is rendered by Markdown-It's own rule; label an unlabelled
// fence so the CSS can give it the code treatment rather than prose treatment.
// Overriding the rule itself would replace its rendering, not annotate it.
md.core.ruler.push('label_empty_fence', (state) => {
  for (const token of state.tokens) {
    if (token.type === 'fence' && !token.info.trim()) token.info = 'text'
  }
  return true
})

export interface Rendered {
  html: string
  /** Headings, for the in-page contents list. */
  headings: Array<{ id: string; text: string; level: number }>
}

/** Render Markdown to HTML and collect its headings in one pass. */
export function renderMarkdown(source: string): Rendered {
  const tokens = md.parse(source, {})
  const headings: Rendered['headings'] = []
  const seen = new Map<string, number>()

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type !== 'heading_open') continue

    const level = Number(token.tag.slice(1))
    const inline = tokens[i + 1]
    const text = inline?.content ?? ''
    const base = slugify(text) || 'section'
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    const id = count === 1 ? base : `${base}-${count}`

    token.attrSet('id', id)
    headings.push({ id, text, level })
  }

  return { html: md.renderer.render(tokens, md.options, {}), headings }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64)
}

export { md }
