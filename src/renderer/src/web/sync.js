// Supabase'dan savollar va katalogni fonda yangilash.
import { supabase, publicImageUrl } from './supabase'
import * as idb from './db'
import * as engine from './engine'
import { deviceId } from './activation'

const PAGE = 500
const OVERLAP_MS = 5 * 60 * 1000

const localQuestionId = (row) => (row.question_source === 'admin_new' ? -Math.abs(Number(row.id)) : Number(row.id))
const localAnswerId = (row, answer) => (row.question_source === 'admin_new' ? -Math.abs(Number(answer.id)) : Number(answer.id))
const isExplicitlyNew = (row) =>
  row.is_new === true || (typeof row.is_new !== 'boolean' && row.question_type === 'admin_new')

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = new Error('Sinxronizatsiya bekor qilindi')
    error.name = 'AbortError'
    throw error
  }
}

const epoch = () => new Date(0).toISOString()
const lastUpdated = () => engine.metaGet('base_last_updated_at')

function syncSince() {
  const last = lastUpdated()
  return last ? new Date(new Date(last).getTime() - OVERLAP_MS).toISOString() : epoch()
}

const supportsManualVariants = (catalog) => Array.isArray(catalog.manual_variants)

function sinceForCatalog(catalog, lastSynced) {
  const schemaRefresh = supportsManualVariants(catalog) && engine.metaGet('admin_sync_schema_v1') !== '1'
  return schemaRefresh || !lastSynced ? epoch() : new Date(new Date(lastSynced).getTime() - OVERLAP_MS).toISOString()
}

async function fetchCatalog(since, signal) {
  const pDeviceId = await deviceId()
  const { data, error } = await supabase
    .rpc('sync_base_catalog', { p_device_id: pDeviceId, p_since: since })
    .abortSignal(signal)
  if (error) throw error
  if (!data || !Array.isArray(data.sections) || !Array.isArray(data.lessons)) {
    throw new Error('Supabase katalog javobi noto‘g‘ri formatda.')
  }
  return data
}

async function fetchChangedQuestions(since, onProgress, signal) {
  const pDeviceId = await deviceId()
  let cursor = { since, afterId: 0 }
  const rows = []
  let fetched = 0
  let estimatedBytes = 0
  let newQuestions = 0
  for (;;) {
    throwIfAborted(signal)
    onProgress({ stage: 'questions', fetched, estimatedBytes })
    const { data, error } = await supabase
      .rpc('sync_base_questions', {
        p_device_id: pDeviceId,
        p_since: cursor.since,
        p_after_id: cursor.afterId,
        p_limit: PAGE,
      })
      .abortSignal(signal)
    if (error) throw error
    if (!Array.isArray(data)) throw new Error('Supabase sync javobi noto‘g‘ri formatda.')
    if (data.length === 0) break
    estimatedBytes += new Blob([JSON.stringify(data)]).size
    for (const row of data) {
      if (!row.is_deleted && !engine.state.questions.has(localQuestionId(row))) newQuestions++
    }
    rows.push(...data)
    const last = data[data.length - 1]
    cursor = { since: last.updated_at, afterId: last.id }
    fetched += data.length
    onProgress({ stage: 'questions', fetched, estimatedBytes })
    if (data.length < PAGE) break
  }
  return { rows, fetched, newQuestions, estimatedBytes }
}

async function fetchLessonQuestionOrder(signal) {
  const pDeviceId = await deviceId()
  const { data, error } = await supabase
    .rpc('sync_lesson_question_order', { p_device_id: pDeviceId })
    .abortSignal(signal)
  if (error) throw error
  if (!Array.isArray(data)) {
    throw new Error('Supabase savollar tartibi noto‘g‘ri formatda.')
  }
  return new Map(
    data.map((row) => [
      `${row.question_source}:${Math.abs(Number(row.question_id))}`,
      Number(row.sort_order),
    ])
  )
}

function countChanged(rows) {
  return rows.reduce((count, row) => {
    const local = engine.state.questions.get(localQuestionId(row))?.updated_at
    const changed = row.is_deleted ? Boolean(local) : !local || local !== row.updated_at
    return count + Number(changed)
  }, 0)
}

export async function refreshBase(onProgress = () => {}, signal) {
  throwIfAborted(signal)
  let maxSeen = lastUpdated()

  onProgress({ stage: 'catalog' })
  const catalog = await fetchCatalog(syncSince(), signal)
  const since = sinceForCatalog(catalog, lastUpdated())
  for (const row of [...catalog.sections, ...catalog.lessons, ...(catalog.manual_variants || [])]) {
    if (row.updated_at && (!maxSeen || row.updated_at > maxSeen)) maxSeen = row.updated_at
  }
  const changed = await fetchChangedQuestions(since, onProgress, signal)
  const lessonQuestionOrder = await fetchLessonQuestionOrder(signal)
  const orderedRows = changed.rows.map((row) => {
    if (row.lesson_id == null || row.lesson_id < 0) return row
    const source = row.question_source === 'admin_new' ? 'admin_new' : 'base'
    const order = lessonQuestionOrder.get(
      `${source}:${Math.abs(Number(row.id))}`
    )
    return order === undefined ? row : { ...row, sort_order: order }
  })
  const changedQuestions = countChanged(changed.rows)
  let newQuestions = 0
  for (const row of orderedRows) {
    if (!row.is_deleted && !engine.state.questions.has(localQuestionId(row))) newQuestions++
    if (!maxSeen || row.updated_at > maxSeen) maxSeen = row.updated_at
  }

  throwIfAborted(signal)
  const update = {
    catalog,
    rows: orderedRows,
    maxSeen,
    fetched: changed.fetched,
    newQuestions,
    changedQuestions,
    estimatedBytes: changed.estimatedBytes,
  }
  return installUpdate(update, onProgress)
}

function buildQuestion(row, previous) {
  const id = localQuestionId(row)
  const explicit = [row.is_new, row.is_numeric, row.is_similar].every((value) => typeof value === 'boolean')
  const answers = (row.answers || [])
    .map((answer, index) => ({
      id: localAnswerId(row, answer),
      sort_order: answer.sort_order ?? index,
      text: answer.text,
      is_correct: Boolean(answer.is_correct),
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  const images = (row.images || []).map((image) => ({
    id: image.id,
    role: image.role,
    path: image.path ?? null,
    status: image.status,
    storage_path: image.storage_path ?? null,
    storage_url: image.storage_url || (image.storage_path ? publicImageUrl(image.storage_path) : null),
  }))
  const memberships = Array.isArray(row.manual_variant_memberships)
    ? row.manual_variant_memberships.map((m) => ({ variant_id: m.variant_id, sort_order: m.sort_order }))
    : previous?.memberships || []
  return {
    id,
    question_type: row.question_type,
    lesson_id: row.lesson_id ?? -1,
    sort_order: row.sort_order ?? null,
    text: row.text,
    explanation: row.explanation == null ? null : row.explanation,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_new: isExplicitlyNew(row),
    is_numeric: row.is_numeric === true,
    is_similar: row.is_similar === true,
    explicit,
    answers,
    images,
    memberships,
  }
}

async function installUpdate(update, onProgress = () => {}) {
  onProgress({ stage: 'apply', fetched: update.fetched })
  const { state } = engine

  const sections = update.catalog.sections.map((s) => ({
    id: s.id,
    sort_order: s.sort_order,
    name: s.name,
    created_at: s.created_at,
    is_deleted: Boolean(s.is_deleted),
  }))
  const lessons = update.catalog.lessons.map((l) => ({
    id: l.id,
    section_id: l.section_id,
    sort_order: l.sort_order,
    title: l.title,
    created_at: l.created_at,
    is_deleted: Boolean(l.is_deleted),
  }))
  const variants = (update.catalog.manual_variants || []).map((v) => ({
    id: v.id,
    title: v.title,
    sort_order: v.sort_order ?? 0,
    is_deleted: Boolean(v.is_deleted),
    updated_at: v.updated_at ?? null,
  }))
  const incomingLessonIds = new Set(lessons.map((lesson) => lesson.id))
  const removedLessonIds = [...state.lessons.keys()].filter(
    (id) => id !== -1 && !incomingLessonIds.has(id)
  )
  sections.forEach((s) => state.sections.set(s.id, s))
  lessons.forEach((l) => state.lessons.set(l.id, l))
  variants.forEach((v) => state.variants.set(v.id, v))
  await idb.putMany('sections', sections)
  await idb.putMany('lessons', lessons)
  await idb.putMany('variants', variants)
  if (update.catalog.settings) await engine.saveSettings(update.catalog.settings)

  const toPut = []
  const toRemove = []
  const errorsToRemove = []
  const savedToRemove = []
  for (const row of update.rows) {
    const id = localQuestionId(row)
    if (row.is_deleted) {
      state.questions.delete(id)
      state.errors.delete(String(id))
      toRemove.push(id)
      errorsToRemove.push(String(id))
      if (state.savedQuestions.has(id)) {
        state.savedQuestions.delete(id)
        savedToRemove.push(id)
      }
      continue
    }
    const question = buildQuestion(row, state.questions.get(id))
    state.questions.set(id, question)
    toPut.push(question)
  }
  const removedLessonIdSet = new Set(removedLessonIds)
  for (const [id, question] of state.questions) {
    if (!removedLessonIdSet.has(question.lesson_id)) continue
    const detachedQuestion = { ...question, lesson_id: -1 }
    state.questions.set(id, detachedQuestion)
    toPut.push(detachedQuestion)
  }
  for (const id of removedLessonIds) state.lessons.delete(id)
  await idb.putMany('questions', toPut)
  await idb.removeMany('questions', toRemove)
  await idb.removeMany('errors', errorsToRemove)
  await idb.removeMany('saved', savedToRemove)
  await idb.removeMany('lessons', removedLessonIds)

  engine.invalidate()
  if (update.maxSeen) await engine.metaSet('base_last_updated_at', update.maxSeen)
  if (supportsManualVariants(update.catalog)) await engine.metaSet('admin_sync_schema_v1', '1')
  await engine.metaSet('last_synced_at', new Date().toISOString())
  return {
    fetched: update.fetched,
    newQuestions: update.newQuestions,
    changedQuestions: update.changedQuestions,
    estimatedBytes: update.estimatedBytes,
  }
}
