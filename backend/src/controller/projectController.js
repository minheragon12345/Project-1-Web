const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/projectModel');
const User = require('../models/userModel');
const auth = require('../middleware/authMiddleware');
const { writeAudit } = require('../utils/audit');

const router = express.Router();
const MEMBER_ROLES = Project.MEMBER_ROLES || ['owner', 'editor', 'viewer'];
const PROJECT_STATUSES = Project.PROJECT_STATUSES || ['active', 'archived'];
const BUDGET_TYPES = Project.BUDGET_TYPES || ['fixed', 'hourly'];

router.use(auth);

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function ownerIdOf(project) {
  return String(project?.owner?._id || project?.owner || '');
}

function getMemberRole(project, userId) {
  const uid = String(userId || '');
  if (!uid) return null;
  if (ownerIdOf(project) === uid) return 'owner';

  const hit = Array.isArray(project?.members)
    ? project.members.find((m) => String(m?.user?._id || m?.user) === uid)
    : null;

  return hit?.role || null;
}

function canRead(project, userId) {
  return !!getMemberRole(project, userId);
}

function canWrite(project, userId) {
  const role = getMemberRole(project, userId);
  return role === 'owner' || role === 'editor';
}

function canManageMembers(project, userId) {
  return getMemberRole(project, userId) === 'owner';
}

function parseDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: 'date must be valid' };
  return d;
}

function parseBudget(budget) {
  if (budget === undefined) return undefined;
  if (budget === null) return { amount: 0, currency: 'USD', type: 'hourly' };
  if (typeof budget !== 'object') return { error: 'budget must be an object' };

  const out = {};
  if (budget.amount !== undefined) {
    const n = Number(budget.amount);
    if (!Number.isFinite(n) || n < 0) return { error: 'budget.amount must be >= 0' };
    out.amount = n;
  }
  if (budget.currency !== undefined) {
    out.currency = String(budget.currency).trim().toUpperCase().slice(0, 8) || 'USD';
  }
  if (budget.type !== undefined) {
    const t = String(budget.type).trim().toLowerCase();
    if (!BUDGET_TYPES.includes(t)) return { error: `budget.type must be one of ${BUDGET_TYPES.join(', ')}` };
    out.type = t;
  }
  return out;
}

function toUserDto(u) {
  if (!u) return null;
  if (typeof u === 'string') return { id: u };
  return { id: String(u._id || ''), username: u.username, email: u.email };
}

function mapProjectForList(p, reqUserId) {
  const uid = String(reqUserId);
  const ownerId = String(p?.owner?._id || p?.owner || '');
  const role = ownerId === uid
    ? 'owner'
    : (p?.members || []).find((m) => String(m?.user?._id || m?.user) === uid)?.role || null;

  return {
    id: String(p._id),
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: p.startDate,
    endDate: p.endDate,
    budget: p.budget,
    isPersonal: p.isPersonal,
    owner: toUserDto(p.owner),
    memberCount: (p.members?.length || 0) + 1,
    role,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

router.post('/', async (req, res) => {
  const { name, description, startDate, endDate, budget } = req.body;

  try {
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const parsedStart = parseDate(startDate);
    if (parsedStart && parsedStart.error) {
      return res.status(400).json({ message: `startDate: ${parsedStart.error}` });
    }
    const parsedEnd = parseDate(endDate);
    if (parsedEnd && parsedEnd.error) {
      return res.status(400).json({ message: `endDate: ${parsedEnd.error}` });
    }

    const parsedBudget = parseBudget(budget);
    if (parsedBudget && parsedBudget.error) {
      return res.status(400).json({ message: parsedBudget.error });
    }

    const project = await Project.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      owner: req.userId,
      members: [],
      status: 'active',
      startDate: parsedStart === undefined ? null : parsedStart,
      endDate: parsedEnd === undefined ? null : parsedEnd,
      budget: parsedBudget || { amount: 0, currency: 'USD', type: 'hourly' },
      isPersonal: false,
      isDeleted: false,
    });

    await writeAudit(req, {
      action: 'PROJECT_CREATE',
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: { name: project.name },
    });

    return res.status(201).json({ message: 'Project created', project });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  const { status, search, scope } = req.query;

  try {
    const uid = String(req.userId);
    const membershipOr =
      scope === 'mine'
        ? [{ owner: uid }]
        : scope === 'shared'
          ? [{ 'members.user': uid }]
          : [{ owner: uid }, { 'members.user': uid }];

    const and = [{ isDeleted: false }, { $or: membershipOr }];

    if (status) {
      const s = String(status).trim().toLowerCase();
      if (!PROJECT_STATUSES.includes(s)) {
        return res.status(400).json({ message: `Invalid status. Allowed: ${PROJECT_STATUSES.join(', ')}` });
      }
      and.push({ status: s });
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();
      and.push({
        $or: [
          { name: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
        ],
      });
    }

    const projects = await Project.find({ $and: and })
      .populate('owner', 'username email')
      .sort({ updatedAt: -1 })
      .lean();

    const mapped = projects.map((p) => mapProjectForList(p, uid));

    return res.json({ total: mapped.length, projects: mapped });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });

    const project = await Project.findOne({ _id: id, isDeleted: false })
      .populate('owner', 'username email')
      .populate('members.user', 'username email')
      .lean();

    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!canRead(project, req.userId)) return res.status(403).json({ message: 'Forbidden' });

    const role = getMemberRole(project, req.userId);
    const members = (project.members || []).map((m) => ({
      user: toUserDto(m.user),
      role: m.role,
      addedAt: m.addedAt,
    }));

    return res.json({
      project: {
        id: String(project._id),
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        budget: project.budget,
        isPersonal: project.isPersonal,
        owner: toUserDto(project.owner),
        members,
        role,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, status, startDate, endDate, budget } = req.body;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!canWrite(project, req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa dự án này.' });
    }

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: 'name cannot be empty' });
      project.name = String(name).trim();
    }
    if (description !== undefined) {
      project.description = description ? String(description).trim() : '';
    }
    if (status !== undefined) {
      const s = String(status).trim().toLowerCase();
      if (!PROJECT_STATUSES.includes(s)) {
        return res.status(400).json({ message: `Invalid status. Allowed: ${PROJECT_STATUSES.join(', ')}` });
      }
      project.status = s;
    }
    if (startDate !== undefined) {
      const parsed = parseDate(startDate);
      if (parsed && parsed.error) return res.status(400).json({ message: `startDate: ${parsed.error}` });
      project.startDate = parsed;
    }
    if (endDate !== undefined) {
      const parsed = parseDate(endDate);
      if (parsed && parsed.error) return res.status(400).json({ message: `endDate: ${parsed.error}` });
      project.endDate = parsed;
    }
    if (budget !== undefined) {
      const parsed = parseBudget(budget);
      if (parsed && parsed.error) return res.status(400).json({ message: parsed.error });
      project.budget = { ...(project.budget?.toObject?.() || project.budget || {}), ...(parsed || {}) };
    }

    await project.save();

    await writeAudit(req, {
      action: 'PROJECT_EDIT',
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: { editorRole: getMemberRole(project, req.userId) },
    });

    return res.json({ message: 'Project updated', project });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/archive', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!canManageMembers(project, req.userId)) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có thể lưu trữ.' });
    }

    project.status = project.status === 'archived' ? 'active' : 'archived';
    await project.save();

    await writeAudit(req, {
      action: project.status === 'archived' ? 'PROJECT_ARCHIVE' : 'PROJECT_UNARCHIVE',
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: {},
    });

    return res.json({ message: 'Project status toggled', project });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (ownerIdOf(project) !== String(req.userId)) {
      return res.status(403).json({ message: 'Chỉ chủ dự án mới có thể xóa.' });
    }

    if (project.isPersonal) {
      return res.status(400).json({ message: 'Không thể xóa dự án cá nhân.' });
    }

    project.isDeleted = true;
    project.deletedAt = new Date();
    await project.save();

    await writeAudit(req, {
      action: 'PROJECT_DELETE',
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: {},
    });

    return res.json({ message: 'Project deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/members', async (req, res) => {
  const { id } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });

    const project = await Project.findOne({ _id: id, isDeleted: false })
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (!canRead(project, req.userId)) return res.status(403).json({ message: 'Forbidden' });

    const members = (project.members || []).map((m) => ({
      user: m.user ? { id: String(m.user._id), username: m.user.username, email: m.user.email } : { id: String(m.user) },
      role: m.role,
      addedAt: m.addedAt,
    }));

    return res.json({
      owner: toUserDto(project.owner),
      total: members.length,
      members,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/members', async (req, res) => {
  const { id } = req.params;
  const { email, role } = req.body;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });
    if (!email || !String(email).trim()) return res.status(400).json({ message: 'email is required' });

    const r = String(role || 'viewer').trim().toLowerCase();
    if (!MEMBER_ROLES.includes(r) || r === 'owner') {
      return res.status(400).json({ message: `Invalid role. Allowed: editor, viewer` });
    }

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!canManageMembers(project, req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền thêm thành viên.' });
    }

    const targetEmail = String(email).trim().toLowerCase();
    const target = await User.findOne({ email: targetEmail }).select('_id username email');
    if (!target) return res.status(404).json({ message: 'Không tìm thấy người dùng với email này.' });

    if (String(target._id) === ownerIdOf(project)) {
      return res.status(400).json({ message: 'Chủ dự án đã có toàn quyền.' });
    }

    project.members = Array.isArray(project.members) ? project.members : [];
    const existing = project.members.find((m) => String(m.user) === String(target._id));
    let action = 'PROJECT_MEMBER_ADD';

    if (existing) {
      existing.role = r;
      action = 'PROJECT_MEMBER_UPDATE';
    } else {
      project.members.push({
        user: target._id,
        role: r,
        addedAt: new Date(),
        addedBy: req.userId,
      });
    }

    await project.save();

    await writeAudit(req, {
      action,
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: { memberUserId: String(target._id), role: r, email: targetEmail },
    });

    return res.json({ message: 'Member updated' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/members/:memberUserId', async (req, res) => {
  const { id, memberUserId } = req.params;
  const { role } = req.body;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });
    if (!isValidObjectId(memberUserId)) return res.status(400).json({ message: 'Invalid user id' });

    const r = String(role || 'viewer').trim().toLowerCase();
    if (!MEMBER_ROLES.includes(r) || r === 'owner') {
      return res.status(400).json({ message: `Invalid role. Allowed: editor, viewer` });
    }

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!canManageMembers(project, req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền thay đổi vai trò.' });
    }

    const entry = (project.members || []).find((m) => String(m.user) === String(memberUserId));
    if (!entry) return res.status(404).json({ message: 'Member not found' });

    entry.role = r;
    await project.save();

    await writeAudit(req, {
      action: 'PROJECT_MEMBER_UPDATE',
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: { memberUserId: String(memberUserId), role: r },
    });

    return res.json({ message: 'Member role updated' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id/members/:memberUserId', async (req, res) => {
  const { id, memberUserId } = req.params;

  try {
    if (!isValidObjectId(id)) return res.status(400).json({ message: 'Invalid project id' });
    if (!isValidObjectId(memberUserId)) return res.status(400).json({ message: 'Invalid user id' });

    const project = await Project.findOne({ _id: id, isDeleted: false });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!canManageMembers(project, req.userId) && String(memberUserId) !== String(req.userId)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa thành viên.' });
    }

    const before = project.members?.length || 0;
    project.members = (project.members || []).filter((m) => String(m.user) !== String(memberUserId));
    if ((project.members?.length || 0) === before) {
      return res.status(404).json({ message: 'Member not found' });
    }

    await project.save();

    await writeAudit(req, {
      action: 'PROJECT_MEMBER_REMOVE',
      targetType: 'PROJECT',
      targetId: String(project._id),
      metadata: { memberUserId: String(memberUserId) },
    });

    return res.json({ message: 'Member removed' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
