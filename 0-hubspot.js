// 0-hubspot.js — reading HubSpot. Nothing is ever written.
const { SETTINGS } = require("./config");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

async function hs(method, path, body, attempt = 0) {
  const wait = last + 1000 / SETTINGS.HUBSPOT_RPS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  let res;
  try {
    res = await fetch(`https://api.hubapi.com${path}`, {
      method, headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (attempt < 4) { await sleep(2000 * (attempt + 1)); return hs(method, path, body, attempt + 1); }
    throw new Error(`Could not reach HubSpot: ${e.message}`);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 6) { await sleep(2500 * (attempt + 1)); return hs(method, path, body, attempt + 1); }
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}${res.status === 401 ? " — the token was rejected" : ""} ${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
}

const PROPS = ["firstname", "lastname", "createdate", "hubspot_owner_id",
  SETTINGS.CAMPAIGN_PROPERTY, SETTINGS.FORM_PROPERTY, SETTINGS.STAGE_PROPERTY, SETTINGS.REASON_PROPERTY, SETTINGS.CATEGORY_PROPERTY];

// Two filter groups are an OR in HubSpot: GLB by campaign, or GLB by form. A lead that
// matches both comes back once.
const filtersFor = (fromMs, toMs) => [SETTINGS.CAMPAIGN_PROPERTY, SETTINGS.FORM_PROPERTY].map((prop) => ({ filters: [
  { propertyName: prop, operator: "CONTAINS_TOKEN", value: SETTINGS.CAMPAIGN_TOKEN },
  { propertyName: "createdate", operator: "GTE", value: String(fromMs) },
  { propertyName: "createdate", operator: "LT", value: String(toMs) },
] }));

// Every GLB lead created in [fromMs, toMs). HubSpot will not page past 10,000 results
// in one search, so a window that is too big is split in half until each part fits —
// a busy month can never be silently cut short.
async function leadsBetween(fromMs, toMs, depth = 0) {
  const probe = await hs("POST", "/crm/v3/objects/contacts/search", { filterGroups: filtersFor(fromMs, toMs), properties: ["createdate"], limit: 1 });
  const total = probe.total || 0;
  if (total > 9800 && depth < 12 && toMs - fromMs > 3600e3) {
    const mid = Math.floor((fromMs + toMs) / 2);
    return [...(await leadsBetween(fromMs, mid, depth + 1)), ...(await leadsBetween(mid, toMs, depth + 1))];
  }
  const out = []; let after;
  for (let i = 0; i < 120; i++) {
    const r = await hs("POST", "/crm/v3/objects/contacts/search", {
      filterGroups: filtersFor(fromMs, toMs),
      sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
      properties: PROPS, limit: 100, after,
    });
    out.push(...(r.results || []));
    after = r.paging && r.paging.next && r.paging.next.after;
    if (!after) break;
  }
  // de-duplicate, in case a lead matching both ways is ever returned twice
  const seen = new Set();
  for (let i = out.length - 1; i >= 0; i--) { if (seen.has(out[i].id)) out.splice(i, 1); else seen.add(out[i].id); }
  if (out.length < total) console.log(`  !! expected ${total} leads in a window but read ${out.length}`);
  return out;
}

async function optionLabels(property) {
  try {
    const p = await hs("GET", `/crm/v3/properties/contacts/${property}`);
    return Object.fromEntries((p.options || []).map((o) => [o.value, o.label]));
  } catch { return {}; }
}

async function ownerNames() {
  const map = {}; let after;
  try {
    for (let i = 0; i < 20; i++) {
      const r = await hs("GET", `/crm/v3/owners?limit=500${after ? `&after=${after}` : ""}`);
      (r.results || []).forEach((o) => { map[o.id] = `${o.firstName || ""} ${o.lastName || ""}`.trim() || o.email || o.id; });
      after = r.paging && r.paging.next && r.paging.next.after;
      if (!after) break;
    }
  } catch { /* names are a nicety; ids still work */ }
  return map;
}

const contactLink = (id) => `https://app.hubspot.com/contacts/${SETTINGS.PORTAL_ID}/record/0-1/${id}`;

module.exports = { hs, leadsBetween, optionLabels, ownerNames, contactLink };
