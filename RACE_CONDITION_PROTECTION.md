# 🔒 Защита от Race Conditions - Optimistic Locking с ETag

## Проблема

При одновременном редактировании промптов несколькими пользователями возникала **race condition**, приводящая к потере данных:

```
Время | Пользователь A           | Пользователь B           | Результат
T0    | Читает промпты v1        |                          |
T1    |                          | Читает промпты v1        |
T2    | Изменяет food → v1-A     |                          |
T3    | Сохраняет всё            |                          | food=v1-A
T4    |                          | Изменяет nonfood → v1-B  |
T5    |                          | Сохраняет всё (food=v1!) | food=v1 (ПОТЕРЯ!)
```

**Результат:** Изменения пользователя A полностью потеряны.

---

## Решение: Optimistic Locking с ETag

Используем стандартный HTTP подход (RFC 7232) для обнаружения конфликтов.

### Как это работает

1. **При чтении промптов** сервер вычисляет хеш (ETag) от содержимого
2. **Клиент сохраняет** этот ETag
3. **При сохранении** клиент отправляет ETag обратно
4. **Сервер проверяет**: если ETag изменился → возвращает 409 Conflict
5. **Клиент показывает** конфликт и предлагает перезагрузить данные

### Преимущества

✅ Стандартный REST API подход (RFC 7232)
✅ Не требует базы данных
✅ Простая реализация
✅ Не блокирует редактирование
✅ Пользователь видит конфликт и может решить сам

### Недостатки

⚠️ Пользователь должен вручную разрешать конфликты
⚠️ Нет автоматического merge

---

## Реализация

### Backend (server.js + services/prompts.js)

#### 1. Добавлены функции для работы с ETag

**services/prompts.js:**

```javascript
import crypto from 'crypto';

// Вычисление MD5 хеша от промптов
export function getPromptsETag() {
  const content = JSON.stringify(BRIEF_PROMPTS);
  return crypto.createHash('md5').update(content).digest('hex');
}

// Получение метаданных с ETag
export function getPromptsMetadata() {
  return {
    prompts: BRIEF_PROMPTS,
    etag: getPromptsETag(),
    lastModified: new Date().toISOString()
  };
}
```

#### 2. Обновлен GET /api/prompts

**server.js:**

```javascript
// GET /api/prompts - возвращает промпты с ETag
if (req.method === 'GET' && req.url === '/api/prompts') {
  const metadata = getPromptsMetadata();

  // Отправляем ETag в заголовке (стандарт HTTP)
  res.setHeader('ETag', metadata.etag);

  // И в теле ответа (для удобства)
  sendJSON(res, 200, {
    prompts: metadata.prompts,
    etag: metadata.etag,
    lastModified: metadata.lastModified
  });
}
```

#### 3. Обновлен POST /api/prompts

**server.js:**

```javascript
// POST /api/prompts - проверяет ETag перед сохранением
if (req.method === 'POST' && req.url === '/api/prompts') {
  const { prompts, etag: clientETag } = await parseBody(req);

  // 🔒 Проверка ETag
  const currentETag = getPromptsETag();

  if (clientETag && clientETag !== currentETag) {
    // Конфликт! Возвращаем 409
    return sendJSON(res, 409, {
      error: 'Конфликт: Промпты были изменены другим пользователем',
      message: 'Пожалуйста, обновите страницу и повторите редактирование',
      currentETag: getPromptsMetadata().etag,
      currentPrompts: BRIEF_PROMPTS,
      lastModified: new Date().toISOString()
    });
  }

  // Сохранение...
  savePrompts(prompts);
  reloadPrompts();

  // Возвращаем новый ETag
  const newMetadata = getPromptsMetadata();
  sendJSON(res, 200, {
    success: true,
    message: 'Промпты успешно обновлены',
    etag: newMetadata.etag,
    lastModified: newMetadata.lastModified
  });
}
```

---

### Frontend (components/Settings.tsx)

#### 1. Добавлено состояние для ETag

```typescript
// State для ETag и конфликтов
const [etag, setEtag] = useState<string | null>(null);
const [conflictData, setConflictData] = useState<{
  serverPrompts: Prompts;
  serverETag: string;
  lastModified: string;
} | null>(null);
```

#### 2. Сохранение ETag при загрузке

```typescript
const loadPrompts = async () => {
  const response = await fetch('/api/prompts', {
    method: 'GET',
    headers: { 'X-API-Key': apiSecret }
  });

  const data = await response.json();

  // 🔒 Сохраняем ETag
  setPrompts(data.prompts);
  setEtag(data.etag);
};
```

#### 3. Отправка ETag при сохранении

```typescript
const handleSave = async () => {
  const response = await fetch('/api/prompts', {
    method: 'POST',
    headers: {
      'X-API-Key': apiSecret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompts,
      etag  // 🔒 Отправляем ETag
    })
  });

  const data = await response.json();

  // 🔒 Обработка конфликта (409)
  if (response.status === 409) {
    setConflictData({
      serverPrompts: data.currentPrompts,
      serverETag: data.currentETag,
      lastModified: data.lastModified
    });
    setError(data.message);
    return;
  }

  // Успешно - обновляем ETag
  setEtag(data.etag);
};
```

#### 4. UI модального окна конфликта

```typescript
{conflictData && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md shadow-2xl">
      <h3>Конфликт изменений</h3>
      <p>
        Промпты были изменены другим пользователем во время вашего редактирования.
        Ваши изменения не сохранены.
      </p>
      <button onClick={handleConflictReload}>
        Обновить и начать заново
      </button>
    </div>
  </div>
)}
```

---

## Тестирование

### Автоматический тест

```bash
# Запустить тест ETag функций
node test-etag.js
```

**Результаты:**

```
=== Тест функций ETag ===

1. Проверка getPromptsETag():
   ETag: 4765b8614fce1f619f7b47ed8c60aebc
   Длина: 32
   Формат MD5: ✅ OK

2. Проверка getPromptsMetadata():
   ETag: 4765b8614fce1f619f7b47ed8c60aebc
   Промпты: [ 'food', 'nonfood', 'inter', 'ge' ]
   Все ключи присутствуют: ✅ OK

3. Проверка стабильности ETag:
   Совпадают: ✅ OK

=== Тест завершен ===
```

### Ручное тестирование конфликта

**Сценарий:**

1. Открыть настройки в **двух браузерах** (или вкладках)
2. **Браузер A**: изменить food промпт
3. **Браузер B**: изменить nonfood промпт
4. **Браузер A**: нажать "Сохранить" → ✅ успех
5. **Браузер B**: нажать "Сохранить" → ⚠️ должен показать конфликт

**Ожидаемое поведение:**

- Браузер B видит модальное окно "Конфликт изменений"
- Изменения браузера A сохранены
- Пользователь B может обновить страницу и начать заново

### Проверка через curl

```bash
# 1. Получить ETag
curl -i https://your-app.railway.app/api/prompts \
  -H "X-API-Key: <ключ>"

# Ответ:
# HTTP/1.1 200 OK
# ETag: "abc123..."
# {"prompts": {...}, "etag": "abc123..."}

# 2. Сохранить с правильным ETag - успех
curl -X POST https://your-app.railway.app/api/prompts \
  -H "X-API-Key: <ключ>" \
  -H "Content-Type: application/json" \
  -d '{"prompts": {...}, "etag": "abc123..."}'

# 3. Сохранить с неправильным ETag - конфликт
curl -X POST https://your-app.railway.app/api/prompts \
  -H "X-API-Key: <ключ>" \
  -H "Content-Type: application/json" \
  -d '{"prompts": {...}, "etag": "wrong-etag"}'

# Ответ:
# HTTP/1.1 409 Conflict
# {"error": "Конфликт: Промпты были изменены..."}
```

---

## Файлы изменены

### Backend (2 файла):

1. **services/prompts.js** (~20 строк кода)
   - Добавлен импорт `crypto`
   - Добавлена функция `getPromptsETag()`
   - Добавлена функция `getPromptsMetadata()`

2. **server.js** (~50 строк изменений)
   - Обновлен импорт из `services/prompts.js`
   - Обновлен `GET /api/prompts` - возвращает ETag
   - Обновлен `POST /api/prompts` - проверяет ETag и возвращает 409

### Frontend (1 файл):

3. **components/Settings.tsx** (~100 строк кода)
   - Добавлен state для `etag` и `conflictData`
   - Обновлена функция `loadPrompts()` - сохраняет ETag
   - Обновлена функция `handleSave()` - отправляет ETag и обрабатывает 409
   - Добавлена функция `handleConflictReload()`
   - Добавлено UI модального окна конфликта

**Итого:** ~170 строк нового кода

---

## Что дает эта реализация

✅ **Защита от потери данных** при одновременном редактировании
✅ **Прозрачная работа** - пользователь видит когда возник конфликт
✅ **Простое решение** без БД и сложной логики
✅ **Стандартный REST API** подход (ETag / If-Match / 409 Conflict)

---

## Ограничения

⚠️ **Railway ephemeral filesystem:**
- Изменения сохраняются между запросами (в рамках одной сессии)
- ETag защита работает корректно
- При redeploy файл `prompts-data.json` сбрасывается к дефолту

**Решение:** Если это проблема, нужно переходить на БД (PostgreSQL/MongoDB) или Railway Volume

---

## Дальнейшие улучшения (опционально)

Если в будущем потребуется:

1. **Автоматический merge** - если пользователи редактируют разные промпты
2. **История изменений** - версионирование промптов
3. **Постоянное хранилище** - база данных или Railway Volume
4. **Уведомления** - реал-тайм уведомления о конфликтах через WebSocket

---

## Дата реализации

**05.02.2026** - Реализована защита от race conditions с использованием Optimistic Locking (ETag)
