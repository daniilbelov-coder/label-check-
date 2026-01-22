# 🚂 Быстрое решение ошибки 401 на Railway

## Проблема
```
Replicate API Error: {"title":"Unauthenticated","detail":"You did not pass a valid authentication token","status":401}
```

## Решение (3 шага)

### Шаг 1: Получите токен Replicate
1. Откройте https://replicate.com/account/api-tokens
2. Войдите в аккаунт
3. Скопируйте токен (начинается с `r8_...`)

### Шаг 2: Добавьте токен в Railway
1. Откройте ваш проект на https://railway.app
2. Выберите ваш сервис
3. Перейдите во вкладку **Variables**
4. Нажмите **New Variable**
5. Добавьте:
   - **Name:** `REPLICATE_API_KEY`
   - **Value:** `r8_ваш_токен_здесь`
6. Нажмите **Add**

### Шаг 3: Подождите редеплоя
- Railway автоматически перезапустит приложение (~1-2 минуты)
- Или нажмите **Deploy** → **Redeploy** для ручного перезапуска

## Проверка
Откройте ваше приложение и попробуйте любую функцию. Ошибка 401 должна исчезнуть.

---

## Почему это произошло?

Ваше приложение использует Replicate API для запуска Google Gemini 2.5 Flash. 

В коде (`server.js:10`) приложение читает токен из переменной окружения:
```javascript
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
```

Если эта переменная не установлена на Railway, все запросы к API возвращают ошибку 401.

## Архитектура

```
React App (Frontend)
    ↓
Node.js Server (server.js)
    ↓
Replicate API (с токеном)
    ↓
Google Gemini 2.5 Flash
```

## Дополнительная информация

- **Токен безопасен:** Railway хранит переменные окружения в зашифрованном виде
- **Не коммитьте токен:** Файл `.env.local` в `.gitignore`
- **Стоимость:** Replicate API платный, проверьте лимиты на replicate.com

## Поддержка

Если проблема не решена:
1. Проверьте, что токен правильно скопирован (без пробелов)
2. Убедитесь, что токен активен на replicate.com
3. Проверьте логи Railway: **Deployments** → выберите деплой → **View Logs**
