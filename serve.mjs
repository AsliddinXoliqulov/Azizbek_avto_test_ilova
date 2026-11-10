// dist/ ni mahalliy tekshirish uchun oddiy server: http://localhost:4173
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
const port = Number(process.env.PORT) || 4173
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
}
http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.join(dist, urlPath === '/' ? 'index.html' : urlPath)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file.endsWith('sw.js') || file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`http://localhost:${port}`))
