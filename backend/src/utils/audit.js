const AuditLog = require('../models/auditLogModel');

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

async function writeAudit(req, { action, targetType, targetId, metadata }) {
  try {
    const actorId = req.user?.id;
    const actorRole = req.user?.role;
    if (!actorId || !actorRole) return;

    await AuditLog.create({
      actor: actorId,
      actorRole,
      action,
      targetType,
      targetId,
      metadata: metadata || {},
      ip: getClientIp(req),
      userAgent: String(req.headers['user-agent'] || ''),
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { writeAudit };
