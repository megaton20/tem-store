const DEPARTMENTS = require('../../utils/departmentDocs');

function listDocs(req, res) {
  // Only the super_admin oversees every department, so only they get the
  // full directory. Everyone else's role guide IS their own - no browsing
  // what other departments do.
  if (req.currentUser.role !== 'super_admin') {
    return res.redirect(`/admin/docs/${req.currentUser.role}`);
  }
  res.render('admin/docs/index', {
    title: 'Role Guides — Admin',
    layout: 'admin/layout',
    departments: DEPARTMENTS,
    ownRole: req.currentUser.role,
  });
}

function showDoc(req, res) {
  const dept = DEPARTMENTS[req.params.role];
  if (!dept) return res.status(404).render('404', { layout: false });

  // Same restriction on direct URL access - a non-admin can only ever
  // land on their own department's guide, never someone else's.
  if (req.currentUser.role !== 'super_admin' && req.params.role !== req.currentUser.role) {
    return res.redirect(`/admin/docs/${req.currentUser.role}`);
  }

  res.render('admin/docs/show', {
    title: `${dept.label} — Role Guide`,
    layout: 'admin/layout',
    dept,
    role: req.params.role,
    ownRole: req.currentUser.role,
  });
}

module.exports = { listDocs, showDoc };
