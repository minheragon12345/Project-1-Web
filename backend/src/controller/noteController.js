const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/noteModel');
const auth = require('../middleware/authMiddleware');

const router = express.Router();
const ALLOWED_STATUSES = Note.NOTE_STATUSES || ['not_done', 'done', 'cancelled'];
const ALLOWED_CATEGORIES = Note.NOTE_CATEGORIES || ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];

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

function normalizeCategory(category) {
  if (category === undefined || category === null) return null;
  const c = String(category).trim();
  if (!c) return null;

  const hit = ALLOWED_CATEGORIES.find((x) => x.toLowerCase() === c.toLowerCase());
  return hit || null;
}

function parsePriority(value) {
  if (value === undefined) return undefined;
  const n = Number(value);

  if (!Number.isInteger(n)) return { error: 'priority must be an integer' };
  if (n < 0 || n > 1024) return { error: 'priority must be between 0 and 1024' };

  return n;
}

function parseProgress(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return 0;

  const n = Number(value);
  if (!Number.isFinite(n)) return { error: 'progress must be a number (0..100)' };

  // Keep it an integer for consistent UI.
  const intN = Math.round(n);
  if (intN < 0 || intN > 100) return { error: 'progress must be between 0 and 100' };

  return intN;
}

function parseDeadline(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: 'deadline must be a valid date' };
  return d;
}

function derivedStatus(currentStatus, progress) {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (typeof progress === 'number' && progress >= 100) return 'done';
  if (typeof progress === 'number' && progress <= 0) return 'not_done';
  // in-progress is still treated as not_done for storage, but UI can show progress %
  return 'not_done';
}

// -------------------- CREATE --------------------
router.post('/', async (req, res) => {
  const { title, content, status, priority, progress, category, deadline } = req.body;

  try {
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: 'content is required' });
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus && !ALLOWED_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
      });
    }

    const parsedPriority = parsePriority(priority);
    if (parsedPriority && parsedPriority.error) {
      return res.status(400).json({ message: parsedPriority.error });
    }

    const parsedProgress = parseProgress(progress);
    if (parsedProgress && parsedProgress.error) {
      return res.status(400).json({ message: parsedProgress.error });
    }

    // Back-compat: if caller sends status=done/not_done without progress, derive progress.
    let progressValue = typeof parsedProgress === 'number' ? parsedProgress : undefined;
    if (progressValue === undefined) {
      if (normalizedStatus === 'done') progressValue = 100;
      else if (normalizedStatus === 'not_done') progressValue = 0;
      else progressValue = 0;
    }

    const normalizedCategory = normalizeCategory(category);
    if (category !== undefined && category !== null && String(category).trim() && !normalizedCategory) {
      return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` });
    }

    const parsedDeadline = parseDeadline(deadline);
    if (parsedDeadline && parsedDeadline.error) {
      return res.status(400).json({ message: parsedDeadline.error });
    }

    const statusValue = derivedStatus(normalizedStatus, progressValue);

    const newNote = await Note.create({
      user: req.userId,
      title: title || '',
      content,
      status: statusValue,
      progress: progressValue,
      category: normalizedCategory || 'Other',
      deadline: parsedDeadline === undefined ? null : parsedDeadline,
      priority: parsedPriority === undefined ? 0 : parsedPriority,
      isDeleted: false,
      deletedAt: null,
    });

    return res.status(201).json({ message: 'Note created', note: newNote });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- LIST ACTIVE --------------------
router.get('/', async (req, res) => {
  const { status, search, category } = req.query;

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

    if (category) {
      const normalizedCategory = normalizeCategory(category);
      if (!normalizedCategory) {
        return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` });
      }
      query.category = normalizedCategory;
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } },
      ];
    }

    const notes = await Note.find(query).sort({ priority: -1, updatedAt: -1 });
    return res.json({ total: notes.length, notes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- TRASH --------------------
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

// -------------------- GET ONE --------------------
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

// -------------------- UPDATE (PUT) --------------------
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, status, priority, progress, category, deadline } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findOne({ _id: id, user: req.userId, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;

    if (priority !== undefined) {
      const parsedPriority = parsePriority(priority);
      if (parsedPriority && parsedPriority.error) {
        return res.status(400).json({ message: parsedPriority.error });
      }
      note.priority = parsedPriority;
    }

    if (progress !== undefined) {
      const parsedProgress = parseProgress(progress);
      if (parsedProgress && parsedProgress.error) {
        return res.status(400).json({ message: parsedProgress.error });
      }
      note.progress = parsedProgress;
    }

    if (category !== undefined) {
      const normalizedCategory = normalizeCategory(category);
      if (category !== null && String(category).trim() && !normalizedCategory) {
        return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` });
      }
      note.category = normalizedCategory || 'Other';
    }

    if (deadline !== undefined) {
      const parsedDeadline = parseDeadline(deadline);
      if (parsedDeadline && parsedDeadline.error) {
        return res.status(400).json({ message: parsedDeadline.error });
      }
      note.deadline = parsedDeadline;
    }

    // Status is explicit only for cancellation.
    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      if (!normalizedStatus || !ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }

      note.status = normalizedStatus;

      // Back-compat: status=done/not_done sets progress unless caller already set progress above.
      if (normalizedStatus === 'done' && progress === undefined) note.progress = 100;
      if (normalizedStatus === 'not_done' && progress === undefined) note.progress = 0;
    }

    if (note.content !== undefined && !String(note.content).trim()) {
      return res.status(400).json({ message: 'content cannot be empty' });
    }

    // Derive status from progress unless cancelled.
    note.status = derivedStatus(note.status, note.progress);

    await note.save();
    return res.json({ message: 'Note updated', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- PATCH STATUS (back-compat) --------------------
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

    const note = await Note.findOne({ _id: id, user: req.userId, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.status = normalizedStatus;
    if (normalizedStatus === 'done') note.progress = 100;
    if (normalizedStatus === 'not_done') note.progress = 0;

    // cancelled keeps progress
    note.status = derivedStatus(note.status, note.progress);
    await note.save();

    return res.json({ message: 'Status updated', note });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- SOFT DELETE -> TRASH --------------------
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

// -------------------- RESTORE --------------------
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

// -------------------- HARD DELETE FROM TRASH --------------------
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
