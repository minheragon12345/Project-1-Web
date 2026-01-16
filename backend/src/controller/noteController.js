const express = require('express');
const mongoose = require('mongoose');
const Note = require('../models/noteModel');
const User = require('../models/userModel');
const auth = require('../middleware/authMiddleware');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
const ALLOWED_STATUSES = Note.NOTE_STATUSES || ['not_done', 'done', 'cancelled'];
const ALLOWED_CATEGORIES = Note.NOTE_CATEGORIES || ['Study', 'Health', 'Finance', 'Work', 'Personal', 'Other'];
const SHARE_PERMISSIONS = Note.SHARE_PERMISSIONS || ['read', 'comment', 'write'];

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
  return 'not_done';
}

function ownerIdOf(note) {
  return String(note?.user?._id || note?.user || '');
}

function getAccess(note, userId) {
  const uid = String(userId || '');
  if (!uid) return null;
  if (ownerIdOf(note) === uid) return 'owner';

  const hit = Array.isArray(note?.sharedWith)
    ? note.sharedWith.find((s) => String(s?.user?._id || s?.user) === uid)
    : null;

  return hit?.permission || null;
}

function canRead(note, userId) {
  return !!getAccess(note, userId);
}

function canWrite(note, userId) {
  const access = getAccess(note, userId);
  return access === 'owner' || access === 'write';
}

function canComment(note, userId) {
  const access = getAccess(note, userId);
  return access === 'owner' || access === 'write' || access === 'comment';
}

function canManageShares(note, req) {
  const access = getAccess(note, req.userId);
  return access === 'owner';
}

function toOwnerDto(populatedUserOrId) {
  if (!populatedUserOrId) return null;
  if (typeof populatedUserOrId === 'string') return { id: populatedUserOrId };
  return {
    id: String(populatedUserOrId._id || ''),
    username: populatedUserOrId.username,
    email: populatedUserOrId.email,
  };
}

function mapNoteForList(noteLean, reqUserId) {
  const uid = String(reqUserId);
  const ownerId = String(noteLean?.user?._id || noteLean?.user || '');
  const isOwner = ownerId === uid;

  const access = isOwner
    ? 'owner'
    : (noteLean?.sharedWith || []).find((s) => String(s?.user?._id || s?.user) === uid)?.permission || null;

  return {
    ...noteLean,
    user: ownerId,
    owner: toOwnerDto(noteLean.user),
    access,
    sharedCount: isOwner ? (noteLean?.sharedWith?.length || 0) : undefined,
    sharedWith: undefined,
    comments: undefined,
  };
}

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
      sharedWith: [],
      comments: [],
      isDeleted: false,
      deletedAt: null,
    });

    return res.status(201).json({ message: 'Note created', note: newNote });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  const { status, search, category, scope } = req.query;

  try {
    const uid = String(req.userId);
    const ownershipOr =
      scope === 'mine'
        ? [{ user: uid }]
        : scope === 'shared'
          ? [{ 'sharedWith.user': uid }]
          : [{ user: uid }, { 'sharedWith.user': uid }];

    const and = [{ isDeleted: false }, { $or: ownershipOr }];

    if (status) {
      const normalizedStatus = normalizeStatus(status);
      if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }
      and.push({ status: normalizedStatus });
    }

    if (category) {
      const normalizedCategory = normalizeCategory(category);
      if (!normalizedCategory) {
        return res.status(400).json({ message: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` });
      }
      and.push({ category: normalizedCategory });
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();
      and.push({
        $or: [
          { title: { $regex: keyword, $options: 'i' } },
          { content: { $regex: keyword, $options: 'i' } },
          { category: { $regex: keyword, $options: 'i' } },
        ],
      });
    }

    const query = { $and: and };

    const notes = await Note.find(query)
      .select('-comments')
      .populate('user', 'username email')
      .sort({ priority: -1, updatedAt: -1 })
      .lean();

    const mapped = notes.map((n) => mapNoteForList(n, uid));

    return res.json({ total: mapped.length, notes: mapped });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/trash', async (req, res) => {
  try {
    const notes = await Note.find({ user: req.userId, isDeleted: true })
      .select('-comments')
      .sort({ deletedAt: -1, updatedAt: -1 });

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

    const note = await Note.findOne({
      _id: id,
      isDeleted: false,
      $or: [{ user: req.userId }, { 'sharedWith.user': req.userId }],
    })
      .select('-comments')
      .populate('user', 'username email')
      .lean();

    if (!note) return res.status(404).json({ message: 'Note not found' });

    const access = getAccess(note, req.userId);
    if (!access) return res.status(403).json({ message: 'Forbidden' });

    const payload = mapNoteForList(note, req.userId);
    return res.json({ note: payload });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content, status, priority, progress, category, deadline } = req.body;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid note id' });
    }

    const note = await Note.findOne({
      _id: id,
      isDeleted: false,
      $or: [{ user: req.userId }, { 'sharedWith.user': req.userId }],
    });

    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!canWrite(note, req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa task này.' });
    }

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

    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      if (!normalizedStatus || !ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`,
        });
      }

      note.status = normalizedStatus;
      if (normalizedStatus === 'done' && progress === undefined) note.progress = 100;
      if (normalizedStatus === 'not_done' && progress === undefined) note.progress = 0;
    }

    if (note.content !== undefined && !String(note.content).trim()) {
      return res.status(400).json({ message: 'content cannot be empty' });
    }

    note.status = derivedStatus(note.status, note.progress);
    await note.save();
    await writeAudit(req, {
      action: 'NOTE_EDIT',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: {
        editorAccess: getAccess(note, req.userId),
      },
    });

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

    const note = await Note.findOne({
      _id: id,
      isDeleted: false,
      $or: [{ user: req.userId }, { 'sharedWith.user': req.userId }],
    });

    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!canWrite(note, req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa task này.' });
    }

    note.status = normalizedStatus;
    if (normalizedStatus === 'done') note.progress = 100;
    if (normalizedStatus === 'not_done') note.progress = 0;

    note.status = derivedStatus(note.status, note.progress);
    await note.save();

    await writeAudit(req, {
      action: 'NOTE_EDIT',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: { editorAccess: getAccess(note, req.userId), status: note.status, progress: note.progress },
    });

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

    const note = await Note.findOne({ _id: id, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (ownerIdOf(note) !== String(req.userId)) {
      return res.status(403).json({ message: 'Chỉ chủ task mới có thể đưa vào thùng rác.' });
    }

    note.isDeleted = true;
    note.deletedAt = new Date();
    await note.save();

    await writeAudit(req, {
      action: 'NOTE_TRASH',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: { by: String(req.userId) },
    });

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

    const note = await Note.findOne({ _id: id, isDeleted: true });
    if (!note) return res.status(404).json({ message: 'Note not found in trash' });

    if (ownerIdOf(note) !== String(req.userId)) {
      return res.status(403).json({ message: 'Chỉ chủ task mới có thể khôi phục.' });
    }

    note.isDeleted = false;
    note.deletedAt = null;
    await note.save();

    await writeAudit(req, {
      action: 'NOTE_RESTORE',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: { by: String(req.userId) },
    });

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

    const note = await Note.findOne({ _id: id, isDeleted: true });
    if (!note) return res.status(404).json({ message: 'Note not found in trash' });

    if (ownerIdOf(note) !== String(req.userId)) {
      return res.status(403).json({ message: 'Chỉ chủ task mới có thể xóa vĩnh viễn.' });
    }

    await Note.deleteOne({ _id: id });

    await writeAudit(req, {
      action: 'NOTE_DELETE_PERMANENT',
      targetType: 'NOTE',
      targetId: String(id),
      metadata: { by: String(req.userId) },
    });

    return res.json({ message: 'Note permanently deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/shares', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid note id' });

    const note = await Note.findOne({ _id: id, isDeleted: false }).populate('sharedWith.user', 'username email');
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!canManageShares(note, req)) {
      return res.status(403).json({ message: 'Bạn không có quyền xem danh sách chia sẻ.' });
    }

    const shares = (note.sharedWith || []).map((s) => ({
      user: s.user ? { id: String(s.user._id), username: s.user.username, email: s.user.email } : { id: String(s.user) },
      permission: s.permission,
      sharedAt: s.sharedAt,
    }));

    return res.json({ total: shares.length, shares });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/share', async (req, res) => {
  const { id } = req.params;
  const { email, permission } = req.body;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid note id' });
    if (!email || !String(email).trim()) return res.status(400).json({ message: 'email is required' });

    const perm = String(permission || 'read').trim().toLowerCase();
    if (!SHARE_PERMISSIONS.includes(perm)) {
      return res.status(400).json({ message: `Invalid permission. Allowed: ${SHARE_PERMISSIONS.join(', ')}` });
    }

    const note = await Note.findOne({ _id: id, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!canManageShares(note, req)) {
      return res.status(403).json({ message: 'Bạn không có quyền chia sẻ task này.' });
    }

    const targetEmail = String(email).trim().toLowerCase();
    const target = await User.findOne({ email: targetEmail }).select('_id username email');
    if (!target) return res.status(404).json({ message: 'Không tìm thấy người dùng với email này.' });

    if (String(target._id) === ownerIdOf(note)) {
      return res.status(400).json({ message: 'Bạn không thể chia sẻ cho chính chủ task.' });
    }

    note.sharedWith = Array.isArray(note.sharedWith) ? note.sharedWith : [];

    const existing = note.sharedWith.find((s) => String(s.user) === String(target._id));
    let action = 'NOTE_SHARE_ADD';

    if (existing) {
      existing.permission = perm;
      action = 'NOTE_SHARE_UPDATE';
    } else {
      note.sharedWith.push({
        user: target._id,
        permission: perm,
        sharedAt: new Date(),
        sharedBy: req.userId,
      });
    }

    await note.save();

    await writeAudit(req, {
      action,
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: { sharedUserId: String(target._id), permission: perm, email: targetEmail },
    });

    return res.json({ message: 'Shared updated' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/share/:shareUserId', async (req, res) => {
  const { id, shareUserId } = req.params;
  const { permission } = req.body;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid note id' });
    if (!isValidObjectId(shareUserId)) return res.status(400).json({ message: 'Invalid user id' });

    const perm = String(permission || 'read').trim().toLowerCase();
    if (!SHARE_PERMISSIONS.includes(perm)) {
      return res.status(400).json({ message: `Invalid permission. Allowed: ${SHARE_PERMISSIONS.join(', ')}` });
    }

    const note = await Note.findOne({ _id: id, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!canManageShares(note, req)) {
      return res.status(403).json({ message: 'Bạn không có quyền thay đổi chia sẻ.' });
    }

    const entry = (note.sharedWith || []).find((s) => String(s.user) === String(shareUserId));
    if (!entry) return res.status(404).json({ message: 'Share entry not found' });

    entry.permission = perm;
    await note.save();

    await writeAudit(req, {
      action: 'NOTE_SHARE_UPDATE',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: { sharedUserId: String(shareUserId), permission: perm },
    });

    return res.json({ message: 'Permission updated' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/share/:shareUserId', async (req, res) => {
  const { id, shareUserId } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid note id' });
    if (!isValidObjectId(shareUserId)) return res.status(400).json({ message: 'Invalid user id' });

    const note = await Note.findOne({ _id: id, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!canManageShares(note, req)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa chia sẻ.' });
    }

    const before = note.sharedWith?.length || 0;
    note.sharedWith = (note.sharedWith || []).filter((s) => String(s.user) !== String(shareUserId));
    if ((note.sharedWith?.length || 0) === before) {
      return res.status(404).json({ message: 'Share entry not found' });
    }

    await note.save();

    await writeAudit(req, {
      action: 'NOTE_SHARE_REMOVE',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: { sharedUserId: String(shareUserId) },
    });

    return res.json({ message: 'Share removed' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/comments', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid note id' });

    const note = await Note.findOne({
      _id: id,
      isDeleted: false,
      $or: [{ user: req.userId }, { 'sharedWith.user': req.userId }],
    }).populate('comments.user', 'username email');

    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!canRead(note, req.userId)) return res.status(403).json({ message: 'Forbidden' });

    const comments = Array.isArray(note.comments) ? [...note.comments] : [];
    comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return res.json({ total: comments.length, comments });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid note id' });
    if (!text || !String(text).trim()) return res.status(400).json({ message: 'Comment text is required' });

    const note = await Note.findOne({
      _id: id,
      isDeleted: false,
      $or: [{ user: req.userId }, { 'sharedWith.user': req.userId }],
    });

    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (!canComment(note, req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền bình luận ở task này.' });
    }

    note.comments = Array.isArray(note.comments) ? note.comments : [];
    note.comments.push({ user: req.userId, text: String(text).trim(), createdAt: new Date(), updatedAt: new Date() });

    await note.save();

    await writeAudit(req, {
      action: 'NOTE_COMMENT_ADD',
      targetType: 'NOTE',
      targetId: String(note._id),
      metadata: {
        by: String(req.userId),
        textSnippet: String(text).trim().slice(0, 120),
      },
    });

    return res.status(201).json({ message: 'Comment added' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
