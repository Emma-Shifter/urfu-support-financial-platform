const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'urfu.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_number TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    full_name TEXT NOT NULL,
    student_group TEXT NOT NULL,
    age INTEGER NOT NULL,
    phone TEXT NOT NULL,
    income REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'На рассмотрении',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
  );
`);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  }
});

const createApplication = db.prepare(`
  INSERT INTO applications
  (application_number, reason, full_name, student_group, age, phone, income, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 'На рассмотрении', ?)
`);

const addDocument = db.prepare(`
  INSERT INTO documents
  (application_id, original_name, stored_name, mime_type, size)
  VALUES (?, ?, ?, ?, ?)
`);

app.post('/api/applications', upload.array('documents', 10), (req, res) => {
  const {
    reason,
    fullName,
    group,
    age,
    phone,
    income,
    consent
  } = req.body;

  if (!reason || !fullName || !group || !age || !phone || income === undefined || consent !== 'true') {
    return res.status(400).json({ error: 'Не заполнены обязательные поля.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Необходимо прикрепить хотя бы один документ.' });
  }

  const now = new Date();
  const number = `МП-${now.getFullYear()}-${String(Date.now()).slice(-6)}`;

  const transaction = db.transaction(() => {
    const result = createApplication.run(
      number,
      reason,
      fullName.trim(),
      group.trim(),
      Number(age),
      phone.trim(),
      Number(income),
      now.toISOString()
    );

    for (const file of req.files) {
      addDocument.run(
        result.lastInsertRowid,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size
      );
    }

    return Number(result.lastInsertRowid);
  });

  try {
    const id = transaction();
    return res.status(201).json({
      id,
      applicationNumber: number,
      status: 'На рассмотрении',
      createdAt: now.toISOString()
    });
  } catch (error) {
    for (const file of req.files || []) {
      fs.rm(path.join(uploadsDir, file.filename), { force: true }, () => {});
    }
    return res.status(500).json({ error: 'Не удалось сохранить заявление.' });
  }
});

app.get('/api/applications', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, application_number AS applicationNumber,
           reason, full_name AS fullName, student_group AS studentGroup,
           age, phone, income, status, created_at AS createdAt
    FROM applications
    ORDER BY id DESC
  `).all();

  res.json(rows);
});

app.get('/api/applications/:id', (req, res) => {
  const application = db.prepare(`
    SELECT id, application_number AS applicationNumber,
           reason, full_name AS fullName, student_group AS studentGroup,
           age, phone, income, status, created_at AS createdAt
    FROM applications
    WHERE id = ?
  `).get(req.params.id);

  if (!application) {
    return res.status(404).json({ error: 'Заявление не найдено.' });
  }

  const documents = db.prepare(`
    SELECT id, original_name AS originalName, mime_type AS mimeType,
           size, stored_name AS storedName
    FROM documents
    WHERE application_id = ?
  `).all(req.params.id);

  res.json({ ...application, documents });
});

app.patch('/api/applications/:id/status', (req, res) => {
  const allowed = ['Черновик', 'На рассмотрении', 'Одобрено', 'Отклонено'];
  const { status } = req.body;

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Недопустимый статус.' });
  }

  const result = db.prepare(
    'UPDATE applications SET status = ? WHERE id = ?'
  ).run(status, req.params.id);

  if (!result.changes) {
    return res.status(404).json({ error: 'Заявление не найдено.' });
  }

  res.json({ id: Number(req.params.id), status });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Ошибка загрузки файла: ${err.message}` });
  }
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
});

app.listen(PORT, () => {
  console.log(`UrFU MVP backend: http://localhost:${PORT}`);
});
