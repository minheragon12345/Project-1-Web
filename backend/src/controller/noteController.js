const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/noteModel');
const auth = require('../middleware/authMiddleware');

const router = express.Router();
const ALLOWED_STATUSES = Note.NOTE_STATUSES || ['not_done', 'done', 'cancelled'];

router.use(auth);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeStatus(status) {
  if (!status) return null;
  const s = String(status).trim().toLowerCase();

  const aliases = {
    todo: 'not_done',
    pending: 'not_done',
    'not done': 'not_done',
    notdone: 'not_done',
    'chưa xong': 'not_done',
    'chua xong': 'not_done',
    chuaxong: 'not_done',

    'đã xong': 'done',
    'da xong': 'done',
    daxong: 'done',

    'đã hủy': 'cancelled',
    'da huy': 'cancelled',
    dahuy: 'cancelled',
  };

  return aliases[s] || s.replace(/\s+/g, '_');
}

function parsePriority(value) {
  if (value === undefined) return undefined;
  const n = Number(value);

  if (!Number.isInteger(n)) return { error: 'priority must be an integer' };
  if (n < 0 || n > 1024) return { error: 'priority must be between 0 and 1024' };

  return n;
}

router.post('/', async (req, res) => {
  const { title, content, status, priority } = req.body;

  try {
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content is required' });
    }

    const normalizedStatus = normalizeStatus(status) || 'not_done';
    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const parsedPriority = parsePriority(priority);
    if (parsedPriority && parsedPriority.error) {
      return res.status(400).json({ message: parsedPriority.error });
    }

    const newNote = await Note.create({
      user: req.userId,
      title: title || '',
      content,
      status: normalizedStatus,
      priority: parsedPriority === undefined ? 0 : parsedPriority,
      isDeleted: false,
      deletedAt: null,
    });

    return res.status(201).json({ message: 'Note created', note: newNote });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  const { status, search } = req.query;

  try {
    const query = { user: req.userId, isDeleted: false };

    if (status) {
      const normalizedStatus = normalizeStatus(status);
      if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      query.status = normalizedStatus;
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
      ];
    }

    const notes = await Note.find(query).sort({ priority: -1, updatedAt: -1 });
    return res.json({ total: notes.length, notes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/trash', async (req, res) => {
  try {
    const notes = await Note.find({ user: req.userId, isDeleted: true }).sort({
      deletedAt: -1,
      updatedAt: -1,
    });

    return res.json({ total: notes.length, notes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findOne({ _id: id, user: req.userId, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    return res.json({ note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, status, priority } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const update = {};
    if (title !== undefined) update.title = title;
    if (content !== undefined) update.content = content;

    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      update.status = normalizedStatus;
    }

    if (priority !== undefined) {
      const parsedPriority = parsePriority(priority);
      if (parsedPriority && parsedPriority.error) {
        return res.status(400).json({ message: parsedPriority.error });
      }
      update.priority = parsedPriority;
    }

    if (update.content !== undefined && !String(update.content).trim()) {
      return res.status(400).json({ message: 'content cannot be empty' });
    }

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId, isDeleted: false },
      update,
      { new: true, runValidators: true }
    );

    if (!note) return res.status(404).json({ message: 'Note not found' });

    return res.json({ message: 'Note updated', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus || !ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId, isDeleted: false },
      { status: normalizedStatus },
      { new: true, runValidators: true }
    );

    if (!note) return res.status(404).json({ message: 'Note not found' });

    return res.json({ message: 'Status updated', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );

    if (!note) return res.status(404).json({ message: 'Note not found' });

    return res.json({ message: 'Note moved to trash', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/restore', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId, isDeleted: true },
      { isDeleted: false, deletedAt: null },
      { new: true }
    );

    if (!note) return res.status(404).json({ message: 'Note not found in trash' });

    return res.json({ message: 'Note restored', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/hard', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const deleted = await Note.findOneAndDelete({ _id: id, user: req.userId, isDeleted: true });
    if (!deleted) return res.status(404).json({ message: 'Note not found in trash' });

    return res.json({ message: 'Note permanently deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;