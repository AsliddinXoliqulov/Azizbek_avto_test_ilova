// Kompyuter ilovasidagi localdb.js mantiqining brauzerdagi (IndexedDB + xotira) ko'chirmasi.
// Natijalar shakli window.api bilan bir xil, shuning uchun interfeys o'zgarishsiz ishlaydi.
import * as idb from './db'
import { publicImageUrl } from './supabase'

const CUSTOM_SECONDS_PER_QUESTION = 75
const LANGUAGES = new Set(['uz-Latn', 'uz-Cyrl', 'ru'])
const DEFAULT_SETTINGS = {
  seconds_per_question: CUSTOM_SECONDS_PER_QUESTION,
  exam_question_count: 20,
  exam_seconds: 1500,
  no_question_image_url: '',
}

export const state = {
  ready: false,
  kv: {},
  sections: new Map(),
  lessons: new Map(),
  questions: new Map(),
  variants: new Map(),
  attempts: new Map(),
  errors: new Map(),
  savedQuestions: new Map(),
}

let cache = { usable: null, positions: null, categories: null }
const resetCache = () => {
  cache = { usable: null, positions: null, categories: null }
}
export const invalidate = resetCache

// Kompyuter ilovasi ham tugatilgan imtihonlarni har ishga tushganda tozalaydi ("bu sessiyada" tarixi).
// Telefonda ham shunday ishlashi uchun false. Tarix doimiy saqlansin desangiz — true qiling.
export const KEEP_EXAM_HISTORY = false

const nowIso = () => new Date().toISOString()

export async function init() {
  if (state.ready) return
  const [kv, sections, lessons, questions, variants, attempts, errors, savedQuestions] = await Promise.all(
    ['kv', 'sections', 'lessons', 'questions', 'variants', 'attempts', 'errors', 'saved'].map(idb.getAll)
  )
  state.kv = Object.fromEntries(kv.map((row) => [row.key, row.value]))
  state.sections = new Map(sections.map((row) => [row.id, row]))
  state.lessons = new Map(lessons.map((row) => [row.id, row]))
  state.questions = new Map(questions.map((row) => [row.id, row]))
  state.variants = new Map(variants.map((row) => [row.id, row]))
  state.attempts = new Map(attempts.map((row) => [row.id, row]))
  state.errors = new Map(errors.map((row) => [row.qid, row]))
  state.savedQuestions = new Map(savedQuestions.map((row) => [row.id, row]))
  if (!KEEP_EXAM_HISTORY) {
    const finished = [...state.attempts.values()].filter((a) => a.finished_at).map((a) => a.id)
    finished.forEach((id) => state.attempts.delete(id))
    await idb.removeMany('attempts', finished)
  }
  state.ready = true
  resetCache()
}

export const metaGet = (key) => (key in state.kv ? state.kv[key] : null)
export function metaSet(key, value) {
  state.kv[key] = value
  return idb.put('kv', { key, value })
}

// ---------- yordamchilar ----------
export function localize(values, language) {
  if (!values || typeof values !== 'object') return ''
  return values[language] ?? values['uz-Latn'] ?? values.ru ?? Object.values(values)[0] ?? ''
}

const isNewQuestion = (q) => Boolean(q.is_new || (!q.explicit && q.question_type === 'admin_new'))
const negFlag = (id) => (id < 0 ? 1 : 0)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function isUsable(q) {
  const answers = q.answers || []
  return answers.length >= 2 && answers.filter((a) => a.is_correct).length === 1
}

function usableList() {
  if (!cache.usable) {
    cache.usable = [...state.questions.values()].filter(isUsable)
  }
  return cache.usable
}

function shuffle(list) {
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function regularSorted() {
  return usableList()
    .filter((q) => !isNewQuestion(q))
    .sort((a, b) => negFlag(a.id) - negFlag(b.id) || Math.abs(a.id) - Math.abs(b.id))
}

function newSorted() {
  return usableList()
    .filter(isNewQuestion)
    .sort(
      (a, b) =>
        cmp(a.created_at || '', b.created_at || '') ||
        negFlag(a.id) - negFlag(b.id) ||
        Math.abs(a.id) - Math.abs(b.id)
    )
}

function positions() {
  if (!cache.positions) {
    const map = new Map()
    const regular = regularSorted()
    regular.forEach((q, i) => map.set(q.id, { isAdminNew: 0, position: i + 1 }))
    newSorted().forEach((q, i) => map.set(q.id, { isAdminNew: 1, position: i + 1 }))
    cache.positions = { map, regularCount: regular.length }
  }
  return cache.positions
}

// ---------- sozlamalar ----------
export function getSettings() {
  const raw = metaGet('settings_json')
  let stored = {}
  if (raw) {
    try {
      stored = JSON.parse(raw)
    } catch {
      stored = {}
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored, seconds_per_question: CUSTOM_SECONDS_PER_QUESTION }
}
export const saveSettings = (settings) => metaSet('settings_json', JSON.stringify(settings ?? {}))

export function getLanguage() {
  const value = metaGet('language')
  return LANGUAGES.has(value) ? value : 'uz-Latn'
}
export async function setLanguage(language) {
  if (!LANGUAGES.has(language)) throw new Error('Noma’lum til: ' + language)
  await metaSet('language', language)
  return language
}
export const getTheme = () => (metaGet('theme') === 'light' ? 'light' : 'dark')
export async function setTheme(theme) {
  if (!['light', 'dark'].includes(theme)) throw new Error('Noma’lum rang mavzusi: ' + theme)
  await metaSet('theme', theme)
  return theme
}

// ---------- katalog ----------
export const totalQuestions = () => usableList().length
export const newQuestionCount = () => usableList().filter(isNewQuestion).length

function variantsFrom(count, offset, kind) {
  const variants = []
  for (let n = 1; n <= Math.ceil(count / 20); n++) {
    const number = offset + n
    variants.push({
      id: kind === 'admin-new' ? `admin-new-variant-${number}` : `question-variant-${number}`,
      title: `Variant ${number}`,
      variantNumber: number,
      variantIndex: n,
      questionCount: Math.min(20, count - (n - 1) * 20),
      kind,
    })
  }
  return variants
}

export function examVariants() {
  const language = getLanguage()
  const regularCount = regularSorted().length
  const regularVariantCount = Math.ceil(regularCount / 20)
  const manual = [...state.variants.values()]
    .filter((v) => !v.is_deleted)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id)
    .map((variant) => ({
      id: `manual-variant-${variant.id}`,
      variantId: variant.id,
      title: localize(variant.title, language),
      questionCount: manualMemberIds(variant.id).filter((id) => {
        const q = state.questions.get(id)
        return q && isUsable(q)
      }).length,
      kind: 'manual',
    }))
  return [
    ...variantsFrom(regularCount, 0, 'question-bank'),
    ...variantsFrom(newQuestionCount(), regularVariantCount, 'admin-new'),
    ...manual,
  ]
}

function manualMemberIds(variantId) {
  const members = []
  for (const q of state.questions.values()) {
    for (const m of q.memberships || []) {
      if (m.variant_id === variantId) members.push({ id: q.id, sort: m.sort_order })
    }
  }
  return members.sort((a, b) => a.sort - b.sort).map((m) => m.id)
}

function activeSections() {
  return [...state.sections.values()].filter((s) => s.id !== -1 && !s.is_deleted)
}

export function sectionCatalog() {
  const language = getLanguage()
  const rows = activeSections()
    .map((s) => ({ ...s, sort_order: Number(s.sort_order) || 0 }))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  return rows.map((section, index) => {
    const lessonIds = new Set(
      [...state.lessons.values()]
        .filter((l) => l.section_id === section.id && !l.is_deleted)
        .map((l) => l.id)
    )
    return {
      id: section.id,
      order: index + 1,
      name: localize(section.name, language),
      lessonCount: lessonIds.size,
      questionCount: usableList().filter((q) => lessonIds.has(q.lesson_id)).length,
    }
  })
}

export function lessonCatalog(sectionId) {
  const language = getLanguage()
  const sectionOk = (l) => {
    const s = state.sections.get(l.section_id)
    return s && !s.is_deleted
  }
  return [...state.lessons.values()]
    .filter(
      (l) =>
        l.id !== -1 &&
        !l.is_deleted &&
        sectionOk(l) &&
        (sectionId == null || l.section_id === Number(sectionId))
    )
    .map((l) => ({ ...l, sort_order: Number(l.sort_order) || 0 }))
    .sort((a, b) => a.section_id - b.section_id || a.sort_order - b.sort_order || a.id - b.id)
    .map((lesson, index) => ({
      id: lesson.id,
      sectionId: lesson.section_id,
      order: index + 1,
      title: localize(lesson.title, language),
      questionCount: usableList().filter((q) => q.lesson_id === lesson.id).length,
    }))
}

// ---------- savollarni chiqarish ----------
function imageUrlOf(image) {
  if (!image) return null
  return image.storage_url || (image.storage_path ? publicImageUrl(image.storage_path) : null)
}

export function formatQuestions(list, includeAnswerKey = false) {
  const language = getLanguage()
  const { map, regularCount } = positions()
  return list.map((q) => {
    const location = map.get(q.id)
    const lesson = state.lessons.get(q.lesson_id)
    const section = lesson ? state.sections.get(lesson.section_id) : null
    const options = (q.answers || []).map((a) => localize(a.text, language))
    const correctIndex = includeAnswerKey ? q.answers.findIndex((a) => a.is_correct) : -1
    const images = q.images || []
    const questionImage = images.find((i) => i.role === 'question' && i.status !== 'missing')
    const descriptionImage = images.find((i) => i.role === 'description' && i.status !== 'missing')
    return {
      id: q.id,
      lessonId: q.lesson_id,
      questionType: q.question_type,
      lessonTitle: lesson ? localize(lesson.title, language) : null,
      sectionTitle: section ? localize(section.name, language) : null,
      bankVariantNumber: location
        ? location.isAdminNew
          ? Math.ceil(regularCount / 20) + Math.ceil(location.position / 20)
          : Math.ceil(location.position / 20)
        : null,
      bankVariantPosition: location ? ((location.position - 1) % 20) + 1 : null,
      bankVariantKind: location?.isAdminNew ? 'admin-new' : 'question-bank',
      text: localize(q.text, language),
      options,
      ...(correctIndex >= 0 ? { correctIndex } : {}),
      imageUrl: imageUrlOf(questionImage),
      imageStorageUrl: imageUrlOf(questionImage),
      explanation: q.explanation ? localize(q.explanation, language) : null,
      explanationImageUrl: imageUrlOf(descriptionImage),
      explanationStorageUrl: imageUrlOf(descriptionImage),
      isNew: isNewQuestion(q),
      isNumeric: Boolean(q.is_numeric),
      isSimilar: Boolean(q.is_similar),
      isRoadSign: false,
    }
  })
}

export function listSavedQuestions() {
  const saved = [...state.savedQuestions.values()]
    .sort((a, b) => cmp(b.added_at || '', a.added_at || ''))
    .map((row) => state.questions.get(Number(row.id)))
    .filter((question) => question && isUsable(question))
  return formatQuestions(saved)
}

export function isQuestionSaved(questionId) {
  return state.savedQuestions.has(Number(questionId))
}

export async function toggleSavedQuestion(questionId) {
  const id = Number(questionId)
  if (!Number.isSafeInteger(id) || !state.questions.has(id)) {
    throw new Error('SAVOL_TOPILMADI')
  }
  if (state.savedQuestions.has(id)) {
    await idb.remove('saved', id)
    state.savedQuestions.delete(id)
    return false
  }
  const row = { id, added_at: nowIso() }
  await idb.put('saved', row)
  state.savedQuestions.set(id, row)
  return true
}

const NUMERIC_RE =
  /\p{N}|°|%|(?:\b(?:mm|cm|km|kg|mg|mph|km\/h|m\/s)\b|мм|см|дм|км|кг|мг|метр\w*|километр\w*|сантиметр\w*|миллиметр\w*|тонн\w*|грамм\w*|литр\w*|градус\w*|секунд\w*|минут\w*|час\w*|соат\w*|дақиқ\w*|фоиз\w*)/iu

function categorizedQuestionIds() {
  if (cache.categories) return cache.categories
  const groups = new Map()
  const numericIds = new Set()
  const explicitSimilar = new Set()
  const explicitNumeric = new Set()
  const rows = usableList()
    .filter((q) => !(!q.explicit && q.question_type === 'admin_new'))
    .sort((a, b) => a.id - b.id)
  for (const q of rows) {
    if (q.explicit) {
      if (q.is_similar) explicitSimilar.add(q.id)
      if (q.is_numeric) explicitNumeric.add(q.id)
    }
    const text = q.text || {}
    const canonical = text['uz-Latn'] ?? text.ru ?? Object.values(text)[0] ?? ''
    const answerTexts = []
    let numericAnswerCount = 0
    for (const answer of q.answers) {
      const values = Object.values(answer.text || {})
      answerTexts.push(...values)
      if (values.some((value) => /\p{N}/u.test(value))) numericAnswerCount++
    }
    const similarKey = canonical
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{N}]+(?:[.,][\p{N}]+)?/gu, '#')
      .replace(/[^\p{L}#]+/gu, ' ')
      .trim()
    if (similarKey) {
      if (!groups.has(similarKey)) groups.set(similarKey, [])
      groups.get(similarKey).push(q.id)
    }
    if (NUMERIC_RE.test([...Object.values(text), ...answerTexts].join(' ')) && numericAnswerCount >= 2) {
      numericIds.add(q.id)
    }
  }
  const similarIds = new Set([...[...groups.values()].filter((ids) => ids.length > 1).flat(), ...explicitSimilar])
  for (const id of explicitNumeric) numericIds.add(id)
  for (const q of state.questions.values()) {
    if (q.explicit && !q.is_numeric) numericIds.delete(q.id)
    if (q.explicit && !q.is_similar) similarIds.delete(q.id)
  }
  cache.categories = { similarIds, numericIds }
  return cache.categories
}

export function questionCounts() {
  const { similarIds, numericIds } = categorizedQuestionIds()
  return { similar: similarIds.size, numeric: numericIds.size }
}

export function pickQuestions({ mode, lessonId, sectionId, count, variantNumber, variantKind, variantId }) {
  const settings = getSettings()
  const language = getLanguage()
  const usable = usableList()

  switch (mode) {
    case 'lesson':
    case 'teacher-lesson': {
      const lesson = state.lessons.get(Number(lessonId))
      const section = lesson ? state.sections.get(lesson.section_id) : null
      const valid = lesson && !lesson.is_deleted && section && !section.is_deleted
      const list = valid
        ? usable
            .filter((q) => q.lesson_id === lesson.id)
            .sort((a, b) => (a.sort_order ?? -Infinity) - (b.sort_order ?? -Infinity) || a.id - b.id)
        : []
      return {
        title: lesson ? localize(lesson.title, language) : 'Dars',
        questions: formatQuestions(list, true),
        seconds: null,
        lessonId,
      }
    }
    case 'exam': {
      const total = usable.length
      const questionCount = Math.min(Number(count) || settings.exam_question_count || 20, total)
      return {
        title: `Haqiqiy imtihon — ${questionCount}`,
        questions: formatQuestions(shuffle(usable).slice(0, questionCount)),
        seconds: questionCount * Math.ceil((settings.exam_seconds || 1500) / (settings.exam_question_count || 20)),
      }
    }
    case 'section-exam': {
      const section = state.sections.get(Number(sectionId))
      const questionCount = Math.max(1, Math.min(Number(count) || 20, 50))
      let questions = []
      if (section && !section.is_deleted) {
        const lessonIds = new Set(
          [...state.lessons.values()].filter((l) => l.section_id === section.id && !l.is_deleted).map((l) => l.id)
        )
        questions = formatQuestions(shuffle(usable.filter((q) => lessonIds.has(q.lesson_id))).slice(0, questionCount))
      }
      return {
        title: section && !section.is_deleted ? localize(section.name, language) : 'Oraliq imtihon',
        questions,
        seconds: questionCount * 75,
      }
    }
    case 'custom': {
      const questionCount = Math.max(1, Math.min(Number(count) || 1, usable.length))
      return {
        title: `${questionCount} ta savol`,
        questions: formatQuestions(shuffle(usable).slice(0, questionCount)),
        seconds: questionCount * CUSTOM_SECONDS_PER_QUESTION,
      }
    }
    case 'variant': {
      const variantIndex = Math.max(1, Number(count) || 1)
      const offset = (variantIndex - 1) * 20
      if (variantKind === 'manual') {
        const variant = state.variants.get(Number(variantId))
        if (!variant || variant.is_deleted) throw new Error('Tanlangan variant topilmadi yoki o‘chirilgan.')
        const questions = manualMemberIds(variant.id)
          .map((id) => state.questions.get(id))
          .filter((q) => q && isUsable(q))
        return {
          title: localize(variant.title, language),
          questions: formatQuestions(questions),
          seconds: questions.length * CUSTOM_SECONDS_PER_QUESTION,
        }
      }
      const source = variantKind === 'admin-new' ? newSorted() : regularSorted()
      const questions = source.slice(offset, offset + 20)
      return {
        title: `Variant ${Number(variantNumber) || variantIndex}`,
        questions: formatQuestions(questions),
        seconds: questions.length * CUSTOM_SECONDS_PER_QUESTION,
      }
    }
    case 'new-questions': {
      const all = newSorted()
      const selected = Number(variantNumber)
      const offset = selected ? (selected - 1) * 20 : 0
      const questionCount = selected
        ? Math.max(0, Math.min(20, all.length - offset))
        : Math.max(0, Math.min(Number(count) || all.length, all.length))
      return {
        title: selected ? `Yangi savollar — ${selected}-variant` : `Yangi savollar — ${questionCount}`,
        questions: formatQuestions(all.slice(offset, offset + questionCount)),
        seconds: questionCount * CUSTOM_SECONDS_PER_QUESTION,
      }
    }
    case 'similar':
    case 'numeric': {
      const { similarIds, numericIds } = categorizedQuestionIds()
      const ids = new Set(mode === 'similar' ? similarIds : numericIds)
      const pool = usable.filter((q) => ids.has(q.id))
      const questionCount =
        count == null ? pool.length : Math.min(Math.max(0, Number(count) || 0), pool.length)
      return {
        title: `${mode} — ${questionCount}`,
        questions: formatQuestions(shuffle(pool).slice(0, count == null ? pool.length : questionCount)),
        seconds: count == null ? null : questionCount * CUSTOM_SECONDS_PER_QUESTION,
      }
    }
    case 'errors': {
      const list = [...state.errors.values()]
        .sort((a, b) => cmp(b.added_at || '', a.added_at || ''))
        .map((e) => state.questions.get(Number(e.qid)))
        .filter((q) => q && isUsable(q))
      return { title: 'Xatolar', questions: formatQuestions(list), seconds: null }
    }
    default:
      throw new Error('Noma’lum test rejimi: ' + mode)
  }
}

// ---------- urinishlar ----------
const TIMED_MODES = ['exam', 'section-exam', 'similar', 'numeric', 'new-questions']

export async function startAttempt({ mode, lessonId, sectionId, total, title, seconds, questionIds = [] }) {
  const expiresAt =
    TIMED_MODES.includes(mode) && seconds != null && Number.isFinite(Number(seconds))
      ? new Date(Date.now() + Math.max(0, Number(seconds)) * 1000).toISOString()
      : null
  const attempt = {
    mode,
    lesson_id: lessonId ?? null,
    section_id: sectionId ?? null,
    title: title ?? null,
    started_at: nowIso(),
    expires_at: expiresAt,
    finished_at: null,
    total,
    correct: 0,
    wrong: 0,
    skipped: 0,
    current_index: 0,
    qids: questionIds.map(Number),
    answers: {},
  }
  const id = await idb.add('attempts', attempt)
  attempt.id = id
  state.attempts.set(id, attempt)
  return id
}

const saveAttempt = (attempt) => idb.put('attempts', attempt)

function attemptDeadline(attempt) {
  if (attempt.expires_at) return Date.parse(attempt.expires_at)
  if (!['exam', 'section-exam'].includes(attempt.mode)) return null
  const settings = getSettings()
  const duration =
    attempt.mode === 'section-exam'
      ? attempt.total * 75
      : attempt.total * Math.ceil((settings.exam_seconds || 1500) / (settings.exam_question_count || 20))
  const startedAt = Date.parse(attempt.started_at)
  return Number.isFinite(startedAt) ? startedAt + duration * 1000 : null
}

export async function findActiveAttempt({ mode, count, sectionId }) {
  if (!['exam', 'section-exam', 'custom', 'similar', 'numeric', 'new-questions'].includes(mode)) return null
  let list = [...state.attempts.values()].filter((a) => a.mode === mode && !a.finished_at)
  if (['exam', 'custom', 'similar', 'numeric', 'new-questions'].includes(mode) && count != null) {
    list = list.filter((a) => a.total === Number(count))
  }
  if (mode === 'section-exam') {
    list = list.filter((a) => a.section_id === Number(sectionId))
    if (count != null) list = list.filter((a) => a.total === Number(count))
  }
  const attempt = list.sort((a, b) => b.id - a.id)[0]
  if (!attempt) return null
  const deadline = attemptDeadline(attempt)
  const base = {
    id: attempt.id,
    mode: attempt.mode,
    total: attempt.total,
    title: attempt.title,
    sectionId: attempt.section_id,
    currentIndex: attempt.current_index || 0,
  }
  if (deadline != null && Date.now() >= deadline) {
    const result = await finishAttempt(attempt.id)
    return { status: 'expired', ...base, result }
  }
  return {
    status: 'active',
    ...base,
    secondsRemaining: deadline != null ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null,
  }
}

function correctIndexOf(questionId) {
  const q = state.questions.get(Number(questionId))
  return q ? q.answers.findIndex((a) => a.is_correct) : -1
}

function attemptSnapshot(attempt) {
  const deadline = attemptDeadline(attempt)
  const byId = new Map(
    formatQuestions(attempt.qids.map((id) => state.questions.get(id)).filter((q) => q && isUsable(q))).map((q) => [q.id, q])
  )
  const ordered = attempt.qids.map((id) => byId.get(id)).filter(Boolean)
  const answers = Object.fromEntries(
    Object.entries(attempt.answers).map(([qid, a]) => [
      qid,
      { chosenIndex: a.chosen, isCorrect: Boolean(a.ok), correctIndex: correctIndexOf(qid) },
    ])
  )
  return {
    status: attempt.finished_at ? 'expired' : 'active',
    id: attempt.id,
    mode: attempt.mode,
    total: attempt.total,
    title: attempt.title,
    sectionId: attempt.section_id,
    currentIndex: Math.min(Math.max(0, attempt.current_index || 0), Math.max(0, ordered.length - 1)),
    secondsRemaining: deadline != null ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null,
    questions: ordered,
    answers,
    result: attempt.finished_at ? attemptResult(attempt.id) : null,
  }
}

export async function resumeAttempt({ attemptId, mode, count, sectionId }) {
  let attempt = null
  if (attemptId != null) attempt = state.attempts.get(Number(attemptId))
  else {
    const active = await findActiveAttempt({ mode, count, sectionId })
    if (active) attempt = state.attempts.get(active.id)
  }
  if (!attempt) return null
  const deadline = attemptDeadline(attempt)
  if (!attempt.finished_at && deadline != null && Date.now() >= deadline) await finishAttempt(attempt.id)
  return attemptSnapshot(state.attempts.get(attempt.id))
}

export async function setAttemptProgress({ attemptId, currentIndex }) {
  const index = Number(currentIndex)
  if (!Number.isInteger(index) || index < 0) throw new Error('SAVOL_TARTIBI_NOTO‘G‘RI')
  const attempt = state.attempts.get(Number(attemptId))
  if (!attempt || attempt.finished_at || !(index < attempt.total)) throw new Error('FAOL_URINISH_TOPILMADI')
  attempt.current_index = index
  await saveAttempt(attempt)
}

export function checkAnswer({ questionId, chosenIndex }) {
  const q = state.questions.get(Number(questionId))
  const answers = q?.answers || []
  if (!answers.length || !answers.some((a) => a.is_correct)) throw new Error('SAVOL_JAVOBLARI_TOPILMADI')
  const index = Number(chosenIndex)
  if (!Number.isInteger(index) || index < 0 || index >= answers.length) throw new Error('JAVOB_VARIANTI_NOTO‘G‘RI')
  return { isCorrect: Boolean(answers[index].is_correct), correctIndex: answers.findIndex((a) => a.is_correct) }
}

export async function answerQuestion({ attemptId, questionId, chosenIndex, mode }) {
  const feedback = checkAnswer({ questionId, chosenIndex })
  const attempt = state.attempts.get(Number(attemptId))
  if (attempt) {
    attempt.answers[String(questionId)] = { chosen: Number(chosenIndex), ok: feedback.isCorrect ? 1 : 0 }
    await saveAttempt(attempt)
  }
  const key = String(questionId)
  if (mode === 'errors' && feedback.isCorrect) {
    state.errors.delete(key)
    await idb.remove('errors', key)
  } else if (!feedback.isCorrect) {
    if (!state.errors.has(key)) {
      const row = { qid: key, added_at: nowIso() }
      state.errors.set(key, row)
      await idb.put('errors', row)
    }
  }
  return feedback
}

export async function finishAttempt(attemptId) {
  const attempt = state.attempts.get(Number(attemptId))
  if (!attempt) throw new Error('URINISH_TOPILMADI')
  if (attempt.finished_at) return attemptResult(attempt.id)
  const answered = Object.values(attempt.answers)
  const correct = answered.reduce((sum, a) => sum + (a.ok ? 1 : 0), 0)
  attempt.correct = correct
  attempt.wrong = answered.length - correct
  attempt.skipped = Math.max(0, attempt.total - answered.length)
  attempt.finished_at = nowIso()
  await saveAttempt(attempt)
  return attemptResult(attempt.id)
}

function attemptResult(attemptId) {
  const attempt = state.attempts.get(Number(attemptId))
  if (!attempt) throw new Error('URINISH_TOPILMADI')
  const percent = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0
  const resultNumber =
    attempt.mode === 'exam'
      ? [...state.attempts.values()].filter((a) => a.mode === 'exam' && a.finished_at && a.id <= attempt.id).length
      : null
  return {
    id: attempt.id,
    title: attempt.title,
    mode: attempt.mode,
    startedAt: attempt.started_at,
    finishedAt: attempt.finished_at,
    resultNumber,
    total: attempt.total,
    correct: attempt.correct,
    wrong: attempt.wrong,
    skipped: attempt.skipped,
    percent,
  }
}

export function examHistory() {
  const finishedExams = [...state.attempts.values()].filter((a) => a.mode === 'exam' && a.finished_at).sort((a, b) => a.id - b.id)
  const numbers = new Map(finishedExams.map((a, i) => [a.id, i + 1]))
  return [...state.attempts.values()]
    .filter((a) => ['exam', 'section-exam'].includes(a.mode) && a.finished_at)
    .sort((a, b) => cmp(b.finished_at, a.finished_at) || b.id - a.id)
    .map((a) => ({
      id: a.id,
      mode: a.mode,
      title: a.title,
      resultNumber: numbers.get(a.id) || null,
      startedAt: a.started_at,
      finishedAt: a.finished_at,
      total: a.total,
      correct: a.correct,
      wrong: a.wrong,
      skipped: a.skipped,
      percent: a.total > 0 ? Math.round((a.correct * 100) / a.total) : 0,
    }))
}

export function reviewAttempt(attemptId) {
  const attempt = state.attempts.get(Number(attemptId))
  if (!attempt || !attempt.finished_at) throw new Error('YAKUNLANGAN_IMTIHON_TOPILMADI')
  const header = {
    id: attempt.id,
    title: attempt.title,
    mode: attempt.mode,
    started_at: attempt.started_at,
    finished_at: attempt.finished_at,
    total: attempt.total,
    correct: attempt.correct,
    wrong: attempt.wrong,
    skipped: attempt.skipped,
  }
  const usable = attempt.qids.map((id) => state.questions.get(id)).filter((q) => q && isUsable(q))
  const byId = new Map(formatQuestions(usable).map((q) => [q.id, q]))
  return {
    ...header,
    questions: attempt.qids
      .map((id) => {
        const question = byId.get(id)
        if (!question) return null
        const answer = attempt.answers[String(id)]
        return {
          ...question,
          chosenIndex: answer?.chosen ?? null,
          isCorrect: answer ? Boolean(answer.ok) : false,
          correctIndex: correctIndexOf(id),
        }
      })
      .filter(Boolean),
  }
}
