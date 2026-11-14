// Qurilmani faollashtirish (kompyuter ilovasidagi activation.js ning brauzer varianti).
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { supabase } from './supabase'
import { metaGet, metaSet } from './engine'

// Kompyuter ilovasida 1 soat (sinov qiymati). Telefonda internetsiz ishlash uchun 7 kun.
// Kod muddati (activation_expires_at) bundan qat'i nazar har doim tekshiriladi.
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

const MESSAGES = {
  INVALID_CODE: "Kod noto'g'ri. Qaytadan tekshirib kiriting.",
  EXPIRED: 'Kodning foydalanish muddati tugagan. Admindan yangi kod so‘rang.',
  ALREADY_USED: 'Kod boshqa qurilmada faollashtirilmadi. Internetga ulanib, qayta urinib ko‘ring.',
  REVOKED: 'Bu kod bekor qilingan. Admin kodni qayta faollashtirgan bo‘lsa, qayta urining.',
  TOO_MANY_ATTEMPTS: "Juda ko'p noto'g'ri urinish. 10 daqiqadan so'ng qayta urinib ko'ring.",
  INVALID_DEVICE: 'Qurilma aniqlanmadi. Sahifani qayta yuklang.',
  DEVICE_FINGERPRINT: 'Qurilma identifikatorini aniqlab bo‘lmadi. Sahifani qayta yuklang.',
  NETWORK: 'Internetga ulanib bo‘lmadi. Internetni tekshirib qayta urining.',
}

let deviceIdPromise

export function deviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const agent = await FingerprintJS.load()
        const { visitorId } = await agent.get()
        if (!visitorId) throw new Error('FingerprintJS identifikator qaytarmadi.')
        const id = `fp-${visitorId}`
        try {
          localStorage.setItem('pdd_device_id', id)
        } catch {
          // IndexedDB metama'lumoti doimiy saqlash uchun zaxira vazifasini bajaradi.
        }
        if (metaGet('device_id') !== id) await metaSet('device_id', id)
        return id
      } catch {
        deviceIdPromise = undefined
        throw new Error('DEVICE_FINGERPRINT')
      }
    })()
  }
  return deviceIdPromise
}

const numberMeta = (key) => {
  const value = Number(metaGet(key))
  return Number.isFinite(value) && value > 0 ? value : null
}

function hasCurrentOfflineLease(now = Date.now()) {
  const checkedAt = numberMeta('last_online_check_at')
  if (!checkedAt) return false
  const expiresAt = numberMeta('activation_expires_at')
  if (expiresAt && now >= expiresAt) return false
  const lastSeen = numberMeta('last_seen_wallclock_at')
  if (lastSeen && now < lastSeen) return false // soat orqaga surilgan
  metaSet('last_seen_wallclock_at', Math.max(now, lastSeen || 0))
  return now - checkedAt < OFFLINE_GRACE_MS
}

export function status() {
  const locallyActivated =
    metaGet('activated') === '1' && metaGet('activation_platform') === 'website'
  if (metaGet('activated') === '1' && !locallyActivated) metaSet('activated', '0')
  const leaseValid = locallyActivated && hasCurrentOfflineLease()
  if (locallyActivated && !leaseValid) metaSet('activated', '0')
  return {
    activated: leaseValid,
    leaseExpired: locallyActivated && !leaseValid,
    reactivationPending:
      metaGet('activation_recheck_required') === '1' ||
      (metaGet('activation_platform') === 'website' &&
        metaGet('activated') !== '1' &&
        Boolean(metaGet('activated_at'))),
    lastOnlineCheckAt: numberMeta('last_online_check_at'),
    deviceId: metaGet('device_id'),
  }
}

export async function requireReactivation() {
  await metaSet('activated', '0')
  await metaSet('activation_recheck_required', '1')
  return status()
}

export async function logout() {
  await metaSet('activated', '0')
  await metaSet('activation_recheck_required', '0')
  await metaSet('activation_code', '')
  await metaSet('activated_at', '')
  return status()
}

export async function getSavedActivationCode() {
  const code = metaGet('activation_code')
  if (!code) return { code: '', error: null }

  try {
    const { data, error } = await supabase.rpc('activate_web_device', {
      p_code: code,
      p_device_id: await deviceId(),
    })
    if (error) {
      console.error('[activation] Saqlangan kod tekshirilmadi:', error)
      if (error.code === '42501' && error.message?.includes('Code is already bound to another device')) {
        await metaSet('activation_code', '')
        return { code: '', error: MESSAGES.ALREADY_USED }
      }
      return { code: '', error: MESSAGES.NETWORK }
    }
    if (data?.ok === true) return { code, error: null }

    if (['EXPIRED', 'INVALID_CODE', 'ALREADY_USED'].includes(data?.error)) {
      await metaSet('activation_code', '')
    }
    return { code: '', error: MESSAGES[data?.error] || null }
  } catch (error) {
    console.error('[activation] Saqlangan kod tekshirilmadi:', error)
    return {
      code: '',
      error: error?.message === 'DEVICE_FINGERPRINT' ? MESSAGES.DEVICE_FINGERPRINT : MESSAGES.NETWORK,
    }
  }
}

export async function activate(code) {
  try {
    const { data, error } = await supabase.rpc('activate_web_device', { p_code: code, p_device_id: await deviceId() })
    if (error) {
      if (error.code === '42501' && error.message?.includes('Code is already bound to another device')) {
        return { ok: false, error: 'ALREADY_USED', message: MESSAGES.ALREADY_USED }
      }
      return { ok: false, error: 'NETWORK', message: MESSAGES.NETWORK }
    }
    if (!data?.ok) return { ok: false, error: data?.error, message: MESSAGES[data?.error] || 'Noma’lum xatolik.' }
    const now = Date.now()
    await metaSet('activated', '0')
    await metaSet('activation_platform', 'website')
    await metaSet('activated', '1')
    await metaSet('activated_at', data.activated_at || new Date().toISOString())
    await metaSet('activation_expires_at', data.expires_at ? new Date(data.expires_at).getTime() : '')
    await metaSet('last_online_check_at', now)
    await metaSet('last_seen_wallclock_at', now)
    await metaSet('activation_recheck_required', '0')
    await metaSet('activation_code', code)
    return { ok: true, ...status() }
  } catch (error) {
    console.error('[activation] Kodni faollashtirishda xatolik:', error)
    const fingerprintError = error?.message === 'DEVICE_FINGERPRINT'
    return {
      ok: false,
      error: fingerprintError ? 'DEVICE_FINGERPRINT' : 'NETWORK',
      message: fingerprintError ? MESSAGES.DEVICE_FINGERPRINT : MESSAGES.NETWORK,
    }
  }
}

export async function retryDeviceActivation(enteredCode = '') {
  try {
    const { data, error } = await supabase.rpc('check_web_device_activation', {
      p_device_id: await deviceId(),
    })
    if (error) {
      console.error('[activation] Qurilma aktivatsiyasi tekshirilmadi:', error)
      return { ok: false, message: MESSAGES.NETWORK }
    }
    if (data?.active !== true) {
      const savedCode = enteredCode.trim() || metaGet('activation_code')
      if (savedCode) return activate(savedCode)
      return {
        ok: false,
        error: 'NO_SAVED_CODE',
      }
    }

    const now = Date.now()
    await metaSet('activated', '0')
    await metaSet('activation_platform', 'website')
    await metaSet('activated', '1')
    await metaSet('last_online_check_at', now)
    await metaSet('last_seen_wallclock_at', now)
    await metaSet(
      'activation_expires_at',
      data.expires_at ? new Date(data.expires_at).getTime() : ''
    )
    await metaSet('activation_recheck_required', '0')
    return { ok: true, ...status() }
  } catch (error) {
    console.error('[activation] Qurilma aktivatsiyasini qayta tiklashda xatolik:', error)
    return {
      ok: false,
      message: error?.message === 'DEVICE_FINGERPRINT' ? MESSAGES.DEVICE_FINGERPRINT : MESSAGES.NETWORK,
    }
  }
}

export async function revalidate() {
  try {
    const { data, error } = await supabase.rpc('check_web_device_activation', { p_device_id: await deviceId() })
    if (error) return status()
    if (data?.active !== true) {
      await metaSet('activated', '0')
      return status()
    }
    const now = Date.now()
    await metaSet('activated', '0')
    await metaSet('activation_platform', 'website')
    await metaSet('activated', '1')
    await metaSet('last_online_check_at', now)
    await metaSet('last_seen_wallclock_at', now)
    await metaSet('activation_expires_at', data.expires_at ? new Date(data.expires_at).getTime() : '')
    await metaSet('activation_recheck_required', '0')
    return status()
  } catch {
    return status() // tarmoq yo'q: oflayn ijara muddati ichida ishlashda davom etadi
  }
}
