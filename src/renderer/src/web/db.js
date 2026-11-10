// IndexedDB — telefon/brauzerdagi mahalliy ombor (kompyuter ilovasidagi SQLite o'rnida).
const DB_NAME = 'pdd-web-v1'
const STORES = {
  kv: 'key',
  sections: 'id',
  lessons: 'id',
  questions: 'id',
  variants: 'id',
  attempts: 'id',
  errors: 'qid',
}

let dbPromise = null
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath, autoIncrement: name === 'attempts' })
          }
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function run(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode)
        let result
        try {
          result = fn(tx.objectStore(store))
        } catch (error) {
          reject(error)
          return
        }
        tx.oncomplete = () => resolve(result?.result ?? undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
  )
}

export const getAll = (store) =>
  run(store, 'readonly', (s) => s.getAll())

export const put = (store, value) => run(store, 'readwrite', (s) => s.put(value))

export const add = (store, value) => run(store, 'readwrite', (s) => s.add(value))

export const remove = (store, key) => run(store, 'readwrite', (s) => s.delete(key))

export const clear = (store) => run(store, 'readwrite', (s) => s.clear())

export function putMany(store, values) {
  if (!values.length) return Promise.resolve()
  return run(store, 'readwrite', (s) => {
    for (const value of values) s.put(value)
  })
}

export function removeMany(store, keys) {
  if (!keys.length) return Promise.resolve()
  return run(store, 'readwrite', (s) => {
    for (const key of keys) s.delete(key)
  })
}
