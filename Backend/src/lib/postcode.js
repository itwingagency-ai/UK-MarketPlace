/**
 * UK address lookup by postcode, behind one interface so the provider can be
 * swapped by configuration:
 *
 *   POSTCODE_PROVIDER=ideal_postcodes  POSTCODE_API_KEY=...   (addresses)
 *   (unset)                                                   lookup off
 *
 * With no provider the app simply shows the manual address form (plan §5:
 * ship disabled until a key is supplied). Results are normalised to our
 * address shape: { line1, line2, city, postalCode, country, lat, lng }.
 */
const https = require("https");

const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const normalisePostcode = (p) => {
  const raw = String(p || "").toUpperCase().replace(/\s+/g, "");
  return raw.length > 3 ? `${raw.slice(0, -3)} ${raw.slice(-3)}` : raw;
};

const getJson = (url) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (c) => { body += c; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body || "{}") });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Address lookup timed out")));
    req.on("error", reject);
  });

const providers = {
  ideal_postcodes: {
    lookup: async (postcode, key) => {
      const { status, json } = await getJson(
        `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(key)}`
      );
      if (status === 404) return [];
      if (status !== 200) throw new Error(`Address lookup failed (${status})`);
      return (json.result || []).map((a) => ({
        line1: [a.line_1].filter(Boolean).join(", "),
        line2: [a.line_2, a.line_3].filter(Boolean).join(", "),
        city: a.post_town || "",
        postalCode: a.postcode || postcode,
        country: "UK",
        lat: a.latitude ?? null,
        lng: a.longitude ?? null,
      }));
    },
  },
};

const config = () => {
  const name = (process.env.POSTCODE_PROVIDER || "").trim();
  const key = (process.env.POSTCODE_API_KEY || "").trim();
  return providers[name] && key ? { name, key, provider: providers[name] } : null;
};

const isLookupEnabled = () => Boolean(config());

/** @returns {Promise<{ enabled: boolean, addresses: Array }>} */
const lookupPostcode = async (postcode) => {
  const cfg = config();
  if (!cfg) return { enabled: false, addresses: [] };
  const normal = normalisePostcode(postcode);
  if (!POSTCODE_RE.test(normal)) return { enabled: true, addresses: [], invalid: true };
  return { enabled: true, addresses: await cfg.provider.lookup(normal, cfg.key) };
};

module.exports = { lookupPostcode, isLookupEnabled, normalisePostcode, POSTCODE_RE, providers };
