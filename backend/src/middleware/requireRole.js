module.exports = function requireRole(...allowedRoles) {
  const allowed = allowedRoles.flat().filter(Boolean);
  return function (req, res, next) {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: 'Unauthorized' });
    if (allowed.length > 0 && !allowed.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
};
