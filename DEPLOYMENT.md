# Инструкция по Деплою (Quick Start)

## 1️⃣ Ротация Yandex API Ключа (ОБЯЗАТЕЛЬНО)

1. Перейди в [Yandex Cloud Console → IAM](https://console.cloud.yandex.ru/iam)
2. Найди ключ `AQVNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
3. Удали его (кнопка "Удалить")
4. Создай новый ключ (кнопка "Создать ключ API")
5. **Скопируй новый ключ** - он понадобится в следующем шаге

## 2️⃣ Настройка Railway Variables

1. Открой [Railway Dashboard](https://railway.app/)
2. Перейди в свой проект → **Variables**
3. Добавь (или обнови) следующие переменные:

```bash
API_SECRET=349ee1731ace959c75691bbb4bcd023be21e288d234cbe0facf09e0b1b83c8ab
NODE_ENV=production
YANDEX_CLOUD_API_KEY=<НОВЫЙ_КЛЮЧ_ИЗ_ШАГА_1>
YANDEX_CLOUD_FOLDER=b1g7ahrmskmu33u3kvut
REPLICATE_API_KEY=<твой_replicate_ключ_если_есть>
```

4. Нажми "Save"

## 3️⃣ Деплой на Railway

```bash
cd /Users/daniil-belov/Desktop/CC/label_check

# Проверь изменения
git status

# Добавь все файлы
git add .

# Создай коммит
git commit -m "Security: Add authentication, rate limiting, server-side prompts"

# Задеплой
git push origin main
```

## 4️⃣ Проверка Деплоя

1. Открой Railway Dashboard → **Deployments**
2. Жди статус **"Success"** (~2-5 минут)
3. Открой **Logs** и найди строку: `Server running on port 3000`

## 5️⃣ Быстрая Проверка Безопасности

### Тест 1: API требует ключ

```bash
# Замени URL на свой Railway URL
curl https://your-app.up.railway.app/api/brief \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"text":"test", "briefType":"food"}'

# Должно вернуть: 401 Unauthorized
```

### Тест 2: С ключом работает

```bash
curl https://your-app.up.railway.app/api/brief \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 349ee1731ace959c75691bbb4bcd023be21e288d234cbe0facf09e0b1b83c8ab" \
  -d '{"text":"молоко", "briefType":"food"}'

# Должно вернуть: 200 OK с результатом
```

## 6️⃣ Локальная Разработка

Файл `.env.local` уже создан и содержит правильный `VITE_API_SECRET`.

Для запуска локально:

```bash
npm install
npm run dev
```

Открой http://localhost:5173

---

## 🆘 Если Что-то Пошло Не Так

### Ошибка: "401 Unauthorized" в production
- Проверь что `API_SECRET` добавлен в Railway Variables
- Проверь что значение совпадает с `.env.local`

### Ошибка: "401 Unauthorized" локально
- Проверь что файл `.env.local` существует
- Перезапусти dev server: `Ctrl+C` → `npm run dev`

### Railway деплой падает с ошибкой
- Открой Railway → Logs
- Найди красный текст (ошибку)
- Если ошибка связана с API ключами - проверь Variables

---

## 📋 Чеклист

- [ ] Yandex API ключ ротирован
- [ ] Railway Variables настроены
- [ ] Код задеплоен (git push)
- [ ] Деплой успешен (статус "Success")
- [ ] Тест 1 (без ключа) → 401 ✓
- [ ] Тест 2 (с ключом) → 200 ✓
- [ ] Приложение работает!

---

**Для подробной информации читай `SECURITY_IMPLEMENTATION_SUMMARY.md`**
