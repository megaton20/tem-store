const { RiderApplication, User, Branch } = require('../../models');
const settingsService = require('../../services/settingsService');

async function listApplications(req, res) {
  const [applications, branches, isOpen] = await Promise.all([
    RiderApplication.findAll({ include: [{ model: User, as: 'applicant' }], order: [['createdAt', 'DESC']] }),
    Branch.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
    settingsService.isOpen('rider_applications_open'),
  ]);
  res.render('admin/rider-applications/index', {
    title: 'Rider Applications — Admin', layout: 'admin/layout', applications, branches, isOpen,
  });
}

// The applicant already has an account (applications are login-required) -
// approving just promotes it to the rider role and assigns a branch. No
// new login/temporary password to generate or hand off.
async function approveApplication(req, res) {
  const application = await RiderApplication.findByPk(req.params.id);
  if (!application) return res.status(404).render('404', { layout: false });

  const user = await User.findByPk(application.userId);
  if (user) {
    user.role = 'rider';
    user.branchId = req.body.branchId || null;
    user.isActiveStaff = true;
    await user.save();
  }

  application.status = 'approved';
  application.reviewedByUserId = req.currentUser.id;
  await application.save();

  res.redirect('/admin/rider-applications');
}

async function rejectApplication(req, res) {
  const application = await RiderApplication.findByPk(req.params.id);
  if (application) {
    application.status = 'rejected';
    application.reviewedByUserId = req.currentUser.id;
    await application.save();
  }
  res.redirect('/admin/rider-applications');
}

async function toggleOpen(req, res) {
  const isOpen = await settingsService.isOpen('rider_applications_open');
  await settingsService.setOpen('rider_applications_open', !isOpen);
  res.redirect('/admin/rider-applications');
}

module.exports = { listApplications, approveApplication, rejectApplication, toggleOpen };
