const express = require('express');
const mongoose = require('mongoose');

const User = require('../models/userModel');
const Note = require('../models/noteModel');
const AuditLog = require('../models/auditLogModel');
const auth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

router.use(auth);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// -------------------- USERS (ADMIN ONLY) --------------------
router.get('/users', requireRole('admin'), async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search && String(search).trim()) {
      const keyword = String(search).trim();
      query.$or = [
        { username: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    return res.json({ total: users.length, users });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Lite users list for staff filters (ADMIN + MODERATOR)
router.get('/users-lite', requireRole('admin', 'moderator'), async (req, res) => {
  try {
    const users = await User.find({})
      .select('_id username email role isBanned')
      .sort({ username: 1 });
    return res.json({ total: users.length, users });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (ADMIN ONLY)
router.patch('/users/:id/role', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const allowedRoles = User.USER_ROLES || ['user', 'moderator', 'admin'];
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ message: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
    }

    // Prevent locking yourself out of admin accidentally
    if (String(req.user.id) === String(id) && normalizedRole !== 'admin') {
      return res.status(400).json({ message: 'You cannot change your own role away from admin.' });
    }

    const before = await User.findById(id).select('_id role');
    if (!before) return res.status(404).json({ message: 'User not found' });

    const user = await User.findByIdAndUpdate(
      id,
      { role: normalizedRole },
      { new: true, runValidators: true }
    ).select('-password');

    await writeAudit(req, {
      action: 'USER_ROLE_UPDATE',
      targetType: 'User',
      targetId: id,
      metadata: { from: before.role, to: normalizedRole },
    });

    return res.json({ message: 'Role updated', user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Ban / Unban a user (ADMIN ONLY)
router.patch('/users/:id/ban', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { isBanned, reason } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // Prevent banning yourself
    if (String(req.user.id) === String(id)) {
      return res.status(400).json({ message: 'You cannot ban yourself.' });
    }

    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ban = Boolean(isBanned);
    if (ban) {
      user.isBanned = true;
      user.bannedAt = new Date();
      user.banReason = String(reason || '').trim();
      user.bannedBy = req.user.id;
      await user.save();

      await writeAudit(req, {
        action: 'USER_BAN',
        targetType: 'User',
        targetId: id,
        metadata: { reason: user.banReason || '' },
      });

      return res.json({ message: 'User banned', user });
    }

    user.isBanned = false;
    user.bannedAt = null;
    user.banReason = '';
    user.bannedBy = null;
    await user.save();

    await writeAudit(req, {
      action: 'USER_UNBAN',
      targetType: 'User',
      targetId: id,
      metadata: {},
    });

    return res.json({ message: 'User unbanned', user });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- NOTES (ADMIN + MODERATOR) --------------------
router.get('/notes', requireRole('admin', 'moderator'), async (req, res) => {
  const { userId, includeDeleted, search } = req.query;

  try {
    const query = {};

    if (userId) {
      if (!isValidObjectId(userId)) {
        return res.status(400).json({ message: 'Invalid userId' });
      }
      query.user = userId;
    }

    if (!String(includeDeleted || '').toLowerCase().includes('true')) {
      query.isDeleted = false;
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
      ];
    }

    const notes = await Note.find(query)
      .populate('user', 'username email role')
      .sort({ updatedAt: -1 });

    return res.json({ total: notes.length, notes });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Edit any note (ADMIN + MODERATOR)
router.patch('/notes/:id', requireRole('admin', 'moderator'), async (req, res) => {
  const { id } = req.params;
  const { title, content, status, priority } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const before = {
      title: note.title,
      content: note.content,
      status: note.status,
      priority: note.priority,
      isDeleted: note.isDeleted,
    };

    if (typeof title !== 'undefined') note.title = title;
    if (typeof content !== 'undefined') note.content = content;
    if (typeof status !== 'undefined') note.status = status;
    if (typeof priority !== 'undefined') note.priority = priority;

    await note.save();

    await writeAudit(req, {
      action: 'NOTE_EDIT',
      targetType: 'Note',
      targetId: id,
      metadata: {
        noteUser: String(note.user),
        before,
        after: {
          title: note.title,
          content: note.content,
          status: note.status,
          priority: note.priority,
          isDeleted: note.isDeleted,
        },
      },
    });

    const populated = await Note.findById(id).populate('user', 'username email role');
    return res.json({ message: 'Note updated', note: populated });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Soft-delete (trash) any note (ADMIN + MODERATOR)
router.patch('/notes/:id/trash', requireRole('admin', 'moderator'), async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.isDeleted = true;
    note.deletedAt = new Date();
    await note.save();

    await writeAudit(req, {
      action: 'NOTE_TRASH',
      targetType: 'Note',
      targetId: id,
      metadata: { noteUser: String(note.user) },
    });

    const populated = await Note.findById(id).populate('user', 'username email role');
    return res.json({ message: 'Note trashed', note: populated });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Restore any note (ADMIN + MODERATOR)
router.patch('/notes/:id/restore', requireRole('admin', 'moderator'), async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.isDeleted = false;
    note.deletedAt = null;
    await note.save();

    await writeAudit(req, {
      action: 'NOTE_RESTORE',
      targetType: 'Note',
      targetId: id,
      metadata: { noteUser: String(note.user) },
    });

    const populated = await Note.findById(id).populate('user', 'username email role');
    return res.json({ message: 'Note restored', note: populated });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Permanently delete any note (ADMIN ONLY)
router.delete('/notes/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findById(id).select('_id user title');
    if (!note) return res.status(404).json({ message: 'Note not found' });

    await Note.findByIdAndDelete(id);

    await writeAudit(req, {
      action: 'NOTE_DELETE_PERMANENT',
      targetType: 'Note',
      targetId: id,
      metadata: { noteUser: String(note.user), title: note.title || '' },
    });

    return res.json({ message: 'Note permanently deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// -------------------- AUDIT LOGS (ADMIN ONLY) --------------------
router.get('/audit-logs', requireRole('admin'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limitRaw = parseInt(req.query.limit || '100', 10);
    const limit = Math.min(Math.max(limitRaw, 1), 500);
    const skip = (page - 1) * limit;

    const { actorId, action, targetType, targetId, dateFrom, dateTo } = req.query;

    const query = {};
    if (actorId) {
      if (!isValidObjectId(actorId)) return res.status(400).json({ message: 'Invalid actorId' });
      query.actor = actorId;
    }
    if (action && String(action).trim()) query.action = String(action).trim();
    if (targetType && String(targetType).trim()) query.targetType = String(targetType).trim();
    if (typeof targetId !== 'undefined' && String(targetId).trim()) query.targetId = String(targetId).trim();

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .populate('actor', 'username email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({ total, page, limit, logs });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
