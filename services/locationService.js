const { OperatingLocation } = require('../models');

/**
 * The super-admin-controlled list of cities TEM Store operates in,
 * grouped as { state: [city, ...] } for cascading state -> city
 * dropdowns (registration, profile, staff applications). Every one of
 * those dropdowns also appends an "Other" option itself - this service
 * only returns what we actually cover.
 */
async function getOperatingLocationsGrouped() {
  const locations = await OperatingLocation.findAll({
    where: { isActive: true },
    order: [['state', 'ASC'], ['sortOrder', 'ASC'], ['city', 'ASC']],
  });

  const grouped = {};
  locations.forEach((loc) => {
    if (!grouped[loc.state]) grouped[loc.state] = [];
    grouped[loc.state].push(loc.city);
  });
  return grouped;
}

module.exports = { getOperatingLocationsGrouped };
