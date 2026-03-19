const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../lib/prisma');
const { getCurrentUser } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya türü'));
    }
  },
});

const inferType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'photo';
  if (mimetype === 'application/pdf') return 'report';
  if (mimetype.startsWith('video/')) return 'photo';
  return 'report';
};

// List documents for a patient
router.get('/', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const { patientId } = req.params;
    const docs = await prisma.document.findMany({
      where: { patientId, organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: 'Belgeler yüklenemedi' });
  }
});

// Upload a document for a patient
router.post('/', getCurrentUser, upload.single('file'), async (req, res) => {
  try {
    const user = req.user;
    const { patientId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Dosya bulunamadı' });

    const title = req.body.title || file.originalname;
    const type = req.body.type || inferType(file.mimetype);

    const doc = await prisma.document.create({
      data: {
        organizationId: user.organizationId,
        patientId,
        type,
        title,
        storageKey: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: user.id,
      },
    });

    res.json({ document: doc });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Yükleme başarısız' });
  }
});

// Delete a document
router.delete('/:docId', getCurrentUser, async (req, res) => {
  try {
    const user = req.user;
    const doc = await prisma.document.findFirst({
      where: { id: req.params.docId, organizationId: user.organizationId },
    });
    if (!doc) return res.status(404).json({ error: 'Belge bulunamadı' });

    const filePath = path.join(UPLOADS_DIR, doc.storageKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ message: 'Belge silindi' });
  } catch (err) {
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

module.exports = router;
