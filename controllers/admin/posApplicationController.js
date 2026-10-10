const { PosApplication, User, Branch } = require('../../models');
const settingsService = require('../../services/settingsService');

async function listApplications(req, res) {
  const [applications, branches, isOpen] = await Promise.all([
    PosApplication.findAll({ include: [{ model: User, as: 'applicant' }, { model: Branch, as: 'preferredBranch' }], order: [['createdAt', 'DESC']] }),
    Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    settingsService.isOpen('pos_applications_open'),
  ]);
  res.render('admin/pos-applications/index', {
    title: 'POS Applications — Admin', layout: 'admin/layout', applications, branches, isOpen,
  });
}

async function approveApplication(req, res) {
  const application = await PosApplication.findByPk(req.params.id);
  if (!application) return res.status(404).render('404', { layout: false });

  const user = await User.findByPk(application.userId);
  if (user) {
    user.role = 'sales_pos';
    user.branchId = req.body.branchId || application.preferredBranchId || null;
    user.isActiveStaff = true;
    await user.save();
  }

  application.status = 'approved';
  application.reviewedByUserId = req.currentUser.id;
  await application.save();

  res.redirect('/admin/pos-applications');
}

async function rejectApplication(req, res) {
  const application = await PosApplication.findByPk(req.params.id);
  if (application) {
    application.status = 'rejected';
    application.reviewedByUserId = req.currentUser.id;
    await application.save();
  }
  res.redirect('/admin/pos-applications');
}

async function toggleOpen(req, res) {
  const isOpen = await settingsService.isOpen('pos_applications_open');
  await settingsService.setOpen('pos_applications_open', !isOpen);
  res.redirect('/admin/pos-applications');
}

module.exports = { listApplications, approveApplication, rejectApplication, toggleOpen };
