const { TeamMember } = require('../../models');
const { uploadImageBuffer } = require('../../services/cloudinaryService');

async function listMembers(req, res) {
  const members = await TeamMember.findAll({ order: [['sortOrder', 'ASC']] });
  res.render('admin/team/index', { title: 'Team — Admin', layout: 'admin/layout', members, errors: [] });
}

async function createMember(req, res) {
  const { name, role, bio, sortOrder } = req.body;
  const errors = [];
  if (!name || !role) errors.push('Name and role are required.');

  if (errors.length) {
    const members = await TeamMember.findAll({ order: [['sortOrder', 'ASC']] });
    return res.render('admin/team/index', { title: 'Team — Admin', layout: 'admin/layout', members, errors });
  }

  let photoUrl = null;
  if (req.file) {
    try {
      photoUrl = await uploadImageBuffer(req.file.buffer, 'tem-store/team');
    } catch (err) {
      req.session.flashError = `Team member added, but the photo upload failed: ${err.message}`;
    }
  }

  await TeamMember.create({
    name: name.trim(),
    role: role.trim(),
    bio: bio || null,
    photoUrl,
    sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
  });

  res.redirect('/admin/team');
}

async function toggleActive(req, res) {
  const member = await TeamMember.findByPk(req.params.id);
  if (member) {
    member.isActive = !member.isActive;
    await member.save();
  }
  res.redirect('/admin/team');
}

module.exports = { listMembers, createMember, toggleActive };
