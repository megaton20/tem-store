const { Branch, DeliveryZone, CourierZone } = require('../models');

/**
 * Every city TEM Store actually has a presence or reach in - combined
 * from branches, delivery zones, and courier zones. Used to populate
 * city dropdowns (registration, profile, rider/POS applications) with
 * real, known cities instead of free text or a fabricated exhaustive
 * list of every city in Nigeria.
 */
async function getKnownCities() {
  const [branches, deliveryZones, courierZones] = await Promise.all([
    Branch.findAll({ attributes: ['city'] }),
    DeliveryZone.findAll({ attributes: ['city'] }),
    CourierZone.findAll({ attributes: ['city'] }),
  ]);

  const cities = new Set([
    ...branches.map((b) => b.city),
    ...deliveryZones.map((z) => z.city),
    ...courierZones.map((z) => z.city),
  ]);

  return Array.from(cities).filter(Boolean).sort();
}

module.exports = { getKnownCities };
