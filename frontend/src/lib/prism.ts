/**
 * Prism setup.
 *
 * Prism's core only writes `global.Prism` when a CommonJS `global` exists, so
 * in an ESM bundle its language components fail with "Prism is not defined".
 * This module publishes the core on `globalThis` and then loads the grammars,
 * which is the documented workaround and keeps every grammar import in one
 * place.
 */
import Prism from 'prismjs'

const scope = globalThis as unknown as { Prism?: typeof Prism }
scope.Prism = Prism

// Order matters: markup and clike are dependencies of the others.
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-lua'
import 'prismjs/components/prism-diff'
import 'prismjs/components/prism-graphql'

export { Prism }
