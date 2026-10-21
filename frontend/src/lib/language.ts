// Language guessing. Runs on paste and on blur, never on every keystroke:
// this is a nicety, and a nicety must not cost a frame.

const SIGNATURES: Array<{ lang: string; test: RegExp; weight: number }> = [
  { lang: 'python', test: /^\s*(def |class |from \w+ import |import \w+\s*$)/m, weight: 3 },
  { lang: 'python', test: /^\s*(if __name__ == |elif |print\()/m, weight: 2 },
  { lang: 'typescript', test: /^\s*(interface |type \w+ =|enum |const \w+: )/m, weight: 3 },
  { lang: 'javascript', test: /^\s*(const |let |var |function |=> )/m, weight: 2 },
  { lang: 'javascript', test: /\bconsole\.(log|error|warn)\(/, weight: 2 },
  // Markdown earns its place through structure that no other language uses:
  // an ATX heading, a fenced block, a link, or a leading list with bold.
  { lang: 'markdown', test: /^#{1,6}\s+\S/m, weight: 3 },
  { lang: 'markdown', test: /^```\w*$/m, weight: 4 },
  { lang: 'markdown', test: /\[[^\]]+\]\([^)]+\)/, weight: 2 },
  { lang: 'markdown', test: /^\s*(?:[-*+]|\d+\.)\s+\S.*\*\*/m, weight: 2 },
  { lang: 'markdown', test: /^>\s+\S/m, weight: 1 },
  { lang: 'markup', test: /^\s*<!doctype html>|^\s*<html[\s>]/im, weight: 4 },
  { lang: 'css', test: /^\s*[.#@][\w-]+[^{]*\{[^}]*:[^}]*;/m, weight: 2 },
  { lang: 'json', test: /^\s*[{[]\s*\n?\s*"/m, weight: 2 },
  { lang: 'yaml', test: /^[\w-]+:\s*\S/m, weight: 1 },
  { lang: 'sql', test: /^\s*(SELECT|INSERT INTO|UPDATE|CREATE TABLE)\b/im, weight: 3 },
  { lang: 'bash', test: /^#!\/.*\b(bash|sh)\b|^\s*(sudo |apt-get |npm run |curl )/m, weight: 3 },
  { lang: 'go', test: /^\s*(package \w+|func \w+\()/m, weight: 4 },
  { lang: 'rust', test: /^\s*(fn \w+\(|use \w+::|impl )/m, weight: 4 },
  { lang: 'java', test: /^\s*(public class |private \w+ |import java\.)/m, weight: 3 },
  { lang: 'php', test: /^\s*<\?php/m, weight: 4 },
  { lang: 'ruby', test: /^\s*(def \w+\s*$|require ['"]|puts )/m, weight: 2 },
  { lang: 'c', test: /^\s*#include\s*<|^\s*int main\(/m, weight: 4 },
  { lang: 'cpp', test: /^\s*(#include\s*<iostream>|std::)/m, weight: 3 },
  { lang: 'diff', test: /^(diff --git|\+\+\+ |--- )/m, weight: 4 },
  { lang: 'toml', test: /^\s*\[[\w.]+\]\s*$/m, weight: 1 },
]

/** Guess the language of pasted text. Falls back to `plain`, never to
 *  `markdown`: a guess is a hint, and guessing markdown on plain prose would
 *  colour it as if it had syntax it does not have. */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 4000)
  if (!sample.trim()) return 'plain'

  const scores = new Map<string, number>()
  for (const { lang, test, weight } of SIGNATURES) {
    if (test.test(sample)) {
      scores.set(lang, (scores.get(lang) ?? 0) + weight)
    }
  }
  if (scores.size === 0) return 'plain'

  let best = 'plain'
  let bestScore = 0
  for (const [lang, score] of scores) {
    if (score > bestScore) {
      best = lang
      bestScore = score
    }
  }
  return best
}

/**
 * The dropdown order, which is also the order of precedence for a new entry:
 * Markdown first because most pasted text is prose with some structure in it,
 * then plain text, then the languages people reach for most often.
 *
 * `plain` is the stored value for "text": renaming it would invalidate every
 * entry already on disk, and the label is the only thing a visitor sees.
 */
export const LANGUAGES = [
  'markdown', 'plain', 'json', 'javascript', 'typescript', 'python', 'bash',
  'yaml', 'sql', 'markup', 'css', 'toml', 'ini', 'diff', 'go', 'rust', 'java',
  'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'lua', 'jsx', 'tsx',
  'graphql',
] as const

// Filename extension for the download action.
export const EXTENSIONS: Record<string, string> = {
  markdown: 'md', plain: 'txt', bash: 'sh', c: 'c', cpp: 'cpp', csharp: 'cs',
  css: 'css', diff: 'diff', go: 'go', graphql: 'graphql', ini: 'ini',
  java: 'java', javascript: 'js', json: 'json', jsx: 'jsx', kotlin: 'kt',
  lua: 'lua', markup: 'html', php: 'php', python: 'py', ruby: 'rb', rust: 'rs',
  sql: 'sql', swift: 'swift', toml: 'toml', tsx: 'tsx', typescript: 'ts',
  yaml: 'yaml',
}

export function labelFor(language: string): string {
  const special: Record<string, string> = {
    plain: 'text',
    markdown: 'markdown',
    markup: 'html',
    csharp: 'c#',
    cpp: 'c++',
    bash: 'shell',
  }
  return special[language] ?? language
}
