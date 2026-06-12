// Dev-only helper: receives canvas dataURLs from the preview page and
// writes them to tasks/screenshots/. Used by /build browser QA; not shipped.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = 9911
const OUT = process.argv[2] || 'tasks/screenshots'

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') { res.end(); return }
  // Sanitize: file lands inside OUT no matter what the query says
  const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w-]/g, '_')
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    const m = body.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!m) { res.statusCode = 400; res.end('bad dataURL'); return }
    const file = path.join(OUT, `${name}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.from(m[2], 'base64'))
    res.end(file)
  })
}).listen(PORT, () => console.log(`qa-shot-server on :${PORT} -> ${OUT}`))
