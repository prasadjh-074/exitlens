import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../demo-site/dist/', import.meta.url))
try {
  await readFile(path.join(root, 'index.html'))
} catch {
  throw Error('Build the demo with npm run build first.')
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://127.0.0.1').pathname,
    )
    if (pathname === '/signals/ad.gif') {
      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store',
      })
      res.end(Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64'))
      return
    }
    const file = path.resolve(root, '.' + pathname)
    if (!file.startsWith(root) && file !== path.resolve(root)) {
      res.writeHead(403).end()
      return
    }
    const name = path.extname(file) ? file : path.join(root, 'index.html')
    const body = await readFile(name)
    res
      .writeHead(200, {
        'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(body)
  } catch {
    if (!res.headersSent) res.writeHead(404)
    res.end()
  }
})
server.listen(4173, '127.0.0.1', () =>
  console.log('Stillframe demo at http://127.0.0.1:4173'),
)
