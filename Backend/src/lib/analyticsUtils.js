const ApiError = require("./ApiError");

const VALID_GRANULARITIES = ["day", "week", "month"];

const parseDate = (value, label) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${label} must be a valid ISO date`);
  }
  return d;
};

const resolveDateRange = (req, defaultDays = 30) => {
  const now = new Date();
  let endDate = parseDate(req.query.endDate, "endDate") || now;
  let startDate = parseDate(req.query.startDate, "startDate");

  if (!startDate) {
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - defaultDays);
  }

  if (startDate > endDate) {
    throw new ApiError(400, "startDate must be before endDate");
  }

  const maxRangeMs = 2 * 365 * 24 * 60 * 60 * 1000;
  if (endDate - startDate > maxRangeMs) {
    throw new ApiError(400, "Date range cannot exceed 2 years");
  }

  return { startDate, endDate };
};

const computePreviousPeriod = (startDate, endDate) => {
  const lengthMs = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - lengthMs),
    endDate: new Date(startDate.getTime()),
  };
};

const computeDelta = (current, previous) => {
  const change = Number(current) - Number(previous);
  let percentChange = null;
  if (previous === 0) {
    percentChange = current === 0 ? 0 : null;
  } else {
    percentChange = (change / Number(previous)) * 100;
  }
  return {
    change,
    percentChange:
      percentChange === null ? null : Number(percentChange.toFixed(2)),
  };
};

const validateGranularity = (value) => {
  const granularity = (value || "day").toLowerCase();
  if (!VALID_GRANULARITIES.includes(granularity)) {
    throw new ApiError(
      400,
      `granularity must be one of: ${VALID_GRANULARITIES.join(", ")}`
    );
  }
  return granularity;
};

const granularityToFormat = (granularity) => {
  switch (granularity) {
    case "month":
      return "%Y-%m";
    case "week":
      return "%G-W%V";
    case "day":
    default:
      return "%Y-%m-%d";
  }
};

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const buildCsv = (headers, rows) => {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) =>
    row.map(escapeCsvCell).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
};

module.exports = {
  parseDate,
  resolveDateRange,
  computePreviousPeriod,
  computeDelta,
  validateGranularity,
  granularityToFormat,
  buildCsv,
  escapeCsvCell,
};
