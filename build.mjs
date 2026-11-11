// Ilovani dist/ papkasiga yig'adi (esbuild). Ishlatish: npm run build
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')

function readEnv() {
  const env = { ...process.env }
  const file = path.join(root, '.env')
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

const env = readEnv()
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('XATO: .env faylida VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY kerak (.env.example ga qarang).')
  process.exit(1)
}
if (/service_role|sb_secret_/i.test(env.VITE_SUPABASE_ANON_KEY)) {
  console.error('XATO: brauzer ilovasiga service_role/secret kalit qo‘yib bo‘lmaydi.')
  process.exit(1)
}

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })

const result = await build({
  entryPoints: [path.join(root, 'src/renderer/src/main.jsx')],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'esm',
  target: ['es2020', 'chrome90', 'safari15'],
  jsx: 'automatic',
  outdir: dist,
  entryNames: 'app-[hash]',
  assetNames: 'media/[name]-[hash]',
  loader: { '.png': 'file', '.jpg': 'file', '.jpeg': 'file', '.svg': 'file', '.webp': 'file', '.woff': 'file', '.woff2': 'file' },
  define: {
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    'process.env.NODE_ENV': '"production"',
  },
  metafile: true,
  logLevel: 'info',
})

// public/ → dist/
const publicDir = path.join(root, 'public')
for (const name of fs.readdirSync(publicDir)) {
  if (name !== 'sw.js') fs.copyFileSync(path.join(publicDir, name), path.join(dist, name))
}

const outputs = Object.keys(result.metafile.outputs).map((p) => path.relative(dist, path.resolve(root, p)).replaceAll('\\', '/'))
const js = outputs.find((f) => f.endsWith('.js'))
const css = outputs.find((f) => f.endsWith('.css'))

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const deploymentHost =
  env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || ''
const deploymentUrl = deploymentHost
  ? `https://${deploymentHost.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
  : ''
html = html
  .replaceAll('__SITE_URL__', deploymentUrl || './')
  .replaceAll(
    '__SHARE_PREVIEW_URL__',
    deploymentUrl ? `${deploymentUrl}/share-preview.png` : './share-preview.png'
  )
html = html.replace(/<script type="module" src="[^"]+"><\/script>/, `<script type="module" src="./${js}"></script>`)
if (css) html = html.replace('</head>', `    <link rel="stylesheet" href="./${css}" />\n  </head>`)
fs.writeFileSync(path.join(dist, 'index.html'), html)

// Service worker: yig'ma fayllar ro'yxati va versiya
const shell = ['./', './index.html', './manifest.webmanifest', './favicon.png', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './share-preview.png', ...outputs.map((f) => './' + f)]
const version = crypto.createHash('sha1').update(shell.join('|') + fs.readFileSync(path.join(dist, js))).digest('hex').slice(0, 10)
const sw = fs
  .readFileSync(path.join(publicDir, 'sw.js'), 'utf8')
  .replace('__BUILD_VERSION__', version)
  .replace('__SHELL_FILES__', JSON.stringify([...new Set(shell)]))
fs.writeFileSync(path.join(dist, 'sw.js'), sw)

const size = outputs.reduce((sum, f) => sum + fs.statSync(path.join(dist, f)).size, 0)
console.log(`\nTayyor: dist/ (${(size / 1024 / 1024).toFixed(1)} MB), versiya ${version}`)
