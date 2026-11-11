import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const watchers = []
let buildProcess = null
let serverProcess = null
let debounceTimer = null
let buildQueued = false
let shuttingDown = false

function runBuild() {
  if (shuttingDown) return
  if (buildProcess) {
    buildQueued = true
    return
  }

  buildQueued = false
  console.log('\nO‘zgarishlar yig‘ilmoqda...')
  buildProcess = spawn(process.execPath, [path.join(root, 'build.mjs')], {
    cwd: root,
    stdio: 'inherit',
  })
  buildProcess.on('error', (error) => {
    console.error('Build jarayonini ishga tushirib bo‘lmadi:', error)
  })
  buildProcess.on('exit', (code) => {
    buildProcess = null
    if (code !== 0) console.error(`Build xato bilan tugadi (kod: ${code ?? 'noma’lum'}).`)
    if (buildQueued) runBuild()
    else if (!serverProcess && code === 0 && !shuttingDown) startServer()
  })
}

function startServer() {
  serverProcess = spawn(process.execPath, [path.join(root, 'serve.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  serverProcess.on('error', (error) => {
    console.error('Serverni ishga tushirib bo‘lmadi:', error)
    shutdown(1)
  })
  serverProcess.on('exit', (code) => {
    serverProcess = null
    if (!shuttingDown) shutdown(code ?? 1)
  })
}

function scheduleBuild() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(runBuild, 250)
}

for (const directory of ['src', 'public']) {
  watchers.push(
    fs.watch(path.join(root, directory), { recursive: true }, (_event, filename) => {
      if (filename) scheduleBuild()
    })
  )
}
for (const filename of ['build.mjs', 'index.html']) {
  watchers.push(
    fs.watch(path.join(root, filename), () => scheduleBuild())
  )
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  clearTimeout(debounceTimer)
  for (const watcher of watchers) watcher.close()
  buildProcess?.kill()
  serverProcess?.kill()
  process.exitCode = code
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())

runBuild()
