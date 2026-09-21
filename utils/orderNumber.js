// Human-friendly, sortable order numbers, e.g. TEM-20260814-4F82
function generateOrderNumber() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `TEM-${y}${m}${d}-${rand}`;
}

module.exports = { generateOrderNumber };
