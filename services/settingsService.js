const { Setting } = require('../models');

// Settings default to TRUE (open) when never explicitly set - so a fresh
// install doesn't accidentally launch with application channels closed.
async function isOpen(key) {
  const row = await Setting.findByPk(key);
  if (!row) return true;
  return row.value !== 'false';
}

async function setOpen(key, open) {
  await Setting.upsert({ key, value: open ? 'true' : 'false' });
}

module.exports = { isOpen, setOpen };
