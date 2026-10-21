# UrFU Material Help MVP — backend

## Стек
- Node.js
- Express
- SQLite (`better-sqlite3`)
- Multer для загрузки PDF/JPG/PNG

## Запуск

```bash
npm install
npm start
```

После запуска открыть:

http://localhost:3000

База создаётся автоматически в `data/urfu.sqlite`, загруженные документы — в `data/uploads/`.

## API

### Создать заявление
`POST /api/applications`

`multipart/form-data`:
- `reason`
- `fullName`
- `group`
- `age`
- `phone`
- `income`
- `consent=true`
- `documents` — один или несколько файлов

### Получить список
`GET /api/applications`

### Получить заявление
`GET /api/applications/:id`

### Изменить статус
`PATCH /api/applications/:id/status`

JSON:
```json
{ "status": "Одобрено" }
```

Допустимые статусы:
- Черновик
- На рассмотрении
- Одобрено
- Отклонено
