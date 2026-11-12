# ilova_sayt — telefon va brauzer uchun sayt

Kompyuter ilovasi (`pdd-desktop-app`) bilan **bir xil interfeys**, lekin brauzerda ishlaydi.
Savollar Supabase'dan yuklanib qurilmada (IndexedDB) saqlanadi; xatolar va saqlangan
savollar esa aktivatsiya kodiga bog'lanib Supabase'da sinxronlanadi.

## Ishga tushirish

```bash
npm install
npm run build        # dist/ papkasini yig'adi (esbuild, .env dan Supabase manzili va kalitini oladi)
npm start            # http://localhost:4173 da tekshirish
npm run dev          # ishlab chiqish: fayllar o'zgarganda avtomatik qayta yig'adi
```

`npm run dev` ishlayotganda fayllarni saqlang; sayt avtomatik qayta yig'iladi. Brauzerda yangilangan holatini ko'rish uchun sahifani qayta yuklang.

`.env` (namuna: `.env.example`) faqat **publishable/anon** kalitni oladi. `service_role` kalitni bu yerga qo'ymang —
`build.mjs` bunday kalitni ko'rsa, yig'ishni to'xtatadi.

Sayt aktivatsiyasi uchun Supabase'da
[`Frontend/supabase_web_activation_migration.sql`](../Frontend/supabase_web_activation_migration.sql)
migratsiyasini bir marta ishga tushiring. Qayta ishlatiladigan kodlar uchun
[`Frontend/supabase_web_activation_reusable_codes_migration.sql`](../Frontend/supabase_web_activation_reusable_codes_migration.sql),
foydalanuvchi savollarini saqlash uchun
[`Frontend/supabase_web_activation_user_progress_migration.sql`](../Frontend/supabase_web_activation_user_progress_migration.sql)
migratsiyalarini, so‘ng bitta qurilma va fingerprint bog‘lanishi uchun
[`Frontend/supabase_single_device_auth_migration.sql`](../Frontend/supabase_single_device_auth_migration.sql)
migratsiyasini ishga tushiring.

## Internetga joylash

`dist/` — oddiy statik sayt. Vercel / Netlify / Cloudflare Pages / GitHub Pages — istalganiga bo'ladi.
Vercel: loyihani ulang, Environment Variables'ga `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY` ni kiriting
(`vercel.json` tayyor: build `npm run build`, chiqish `dist`).

## Qanday ishlaydi

1. **Faollashtirish.** Admin paneldagi **Sayt** bo'limidan 6 xonali raqamli kod olinadi
   (desktop kodlaridan alohida saqlanadi va faqat bitta qurilmaga bog'lanadi).
   Kod yaratilganidan 15 kun o'tgach muddati tugaydi; shu vaqtdan keyin saytga kirish ham bloklanadi.
   Qurilma identifikatori FingerprintJS brauzer fingerprinti asosida olinadi. Kodga bog‘langan qurilmani
   administrator paneldagi **Qurilmani tiklash** tugmasi orqali qayta o‘rnatishi mumkin.
2. **Avtomatik sinxronlash.** Faollashtirilgan ilova ochilganda katalog va savol matnlari fonda Supabase RPC
   (`sync_base_catalog`, `sync_base_questions`, `sync_lesson_question_order`) orqali tekshiriladi. Faqat yangi yoki
   o'zgargan ma'lumotlar olinib, IndexedDB'da saqlanadi; foydalanuvchiga alohida yangilash bo'limi ko'rsatilmaydi.
   Mavzu ichidagi savollar admin panelda o'zgartirilgan tartibda ko'rsatiladi.
3. **Rasmlar.** Savol yoki izoh rasmi kerak bo'lgandagina yuklanadi va Cache Storage'da saqlanadi. Savol rasmi
   bo'lmagan savollarda admin paneldagi umumiy rasm ishlatiladi; u belgilanmagan bo'lsa, `namuna.png` ko'rsatiladi.
   Keyingi safar rasm keshdan ochiladi, shu sababli qayta trafik sarflanmaydi.
4. **Internetsiz ishlash.** Ilova qobig'i service worker bilan, savollar IndexedDB bilan saqlanadi. Oflayn ijara muddati
   `src/renderer/src/web/activation.js` dagi `OFFLINE_GRACE_MS` (hozir 7 kun; kompyuter ilovasida sinov uchun 1 soat).
   Kod muddati (`activation_expires_at`) bundan qat'i nazar har doim tekshiriladi.
5. **Imtihon tarixi.** Kompyuter ilovasidagidek, tugagan imtihonlar har ishga tushganda tozalanadi («bu sessiyada»).
   Doimiy saqlash uchun `src/renderer/src/web/engine.js` da `KEEP_EXAM_HISTORY = true` qiling.
6. **Xatolar va saqlangan savollar.** Savollar ID raqami bo'yicha aktivatsiya kodiga bog'lanib,
   Supabase'da saqlanadi. Shu kod faqat bog‘langan fingerprintda ishlaydi;
   internet bo'lmaganda o'zgarishlar IndexedDB'da navbatga qo'yilib, ulanish tiklanganda yuboriladi.

## Tuzilma

- `src/renderer/src/` — kompyuter ilovasidan ko'chirilgan sahifalar va CSS (o'zgarmagan) + `styles/mobile.css` (telefon moslashuvi).
- `src/renderer/src/web/` — brauzer qatlami: `api.js` (`window.api`), `engine.js` (SQLite mantig'ining JS ko'chirmasi),
  `sync.js`, `images.js` (rasmlarni talab bo'yicha keshga olish), `activation.js`, `db.js` (IndexedDB), `supabase.js`.
- `public/` — `manifest.webmanifest`, `sw.js`, ikonkalar.

## Cheklovlar

- Sinovdan o'tgan: Chromium (telefon o'lchami), soxta Supabase javoblari bilan: faollashtirish, sinxronlash, dars/imtihon,
  tarix, internetsiz qayta ochish. Haqiqiy telefon va haqiqiy Supabase bilan sinab ko'rilmagan.
- iPhone'da Safari uzoq vaqt ochilmagan sayt ma'lumotlarini o'chirib yuborishi mumkin; shunda kod qayta kiritiladi.
- Kompyuter ilovasidagi mahalliy `images` papkasi o'rniga rasmlar kerak bo'lganda internetdan olinib, brauzer keshida saqlanadi.
