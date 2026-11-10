/* Service worker: ilova qobig'ini keshlaydi, rasmlar esa ko'rsatilganda ilova ichida keshlanadi. */
const VERSION = '__BUILD_VERSION__'
const SHELL_CACHE = `pdd-shell-${VERSION}`
const SHELL_FILES = __SHELL_FILES__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('pdd-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return // Supabase API va boshqalar: tarmoqqa

  // Sahifa navigatsiyasi: tarmoq birinchi, oflaynda keshdagi index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    )
    return
  }

  // Statik fayllar: kesh birinchi
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
