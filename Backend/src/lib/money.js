/**
 * Money helpers. See the header of lib/pricing.js for which fields are stored
 * in pence and which (shipping configuration only) are stored in pounds.
 */

/** Pounds (as typed by a vendor, e.g. 2.49) -> integer pence (249). */
const poundsToPence = (pounds) => {
  const n = Number(pounds || 0);
  if (!Number.isFinite(n)) return 0;
  // Math.round removes binary float noise: 2.49 * 100 === 249.00000000000003
  return Math.round(n * 100);
};

const isPence = (value) => Number.isInteger(value);

module.exports = { poundsToPence, isPence };
