import { Route, Routes } from 'react-router-dom'
import { Toaster } from './components/Toaster'
import { Write } from './routes/Write'
import { Read } from './routes/Read'
import { Edit } from './routes/Edit'
import { About } from './routes/About'
import { Api } from './routes/Api'
import { Terms } from './routes/Terms'
import { Privacy } from './routes/Privacy'
import { Missing } from './routes/Missing'

export function App() {
  return (
    <Toaster>
      <Routes>
        <Route path="/" element={<Write />} />
        <Route path="/p/:slug" element={<Read />} />
        <Route path="/edit/:slug" element={<Edit />} />
        <Route path="/about" element={<About />} />
        <Route path="/api" element={<Api />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Missing />} />
      </Routes>
    </Toaster>
  )
}
