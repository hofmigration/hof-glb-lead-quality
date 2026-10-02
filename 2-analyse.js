// 2-analyse.js — the numbers, per month, from the leads themselves.
//
// Everything is counted from the actual records, not from HubSpot's own reports, so the
// totals always reconcile: every lead lands in exactly one stage, including "No lead
// stage yet", and every ineligible lead either has a reason or is counted as having none.
const { SETTINGS } = require("./config");

const clean = (s) => String(s == null ? "" : s).trim();
const splitMulti = (s) => clean(s).split(";").map((x) => x.trim()).filter(Boolean);

// "(glb) usa uae campaign -new" and "(glb) usa uae campaign - new" are the same campaign
function campaignKey(raw) {
  return clean(raw).toLowerCase()
    .replace(/\(\s*glb\s*\)\s*/, "(glb) ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ").trim();
}

// "Facebook Lead Ads: (glb) ksa usa campaign" -> "(glb) ksa usa campaign"
const formName = (raw) => clean(raw).replace(/^facebook lead ads:\s*/i, "");

// a lead is GLB if its campaign or its form says so
const isGlb = (l) => `${l.campaignRaw} ${l.form}`.toLowerCase().includes(SETTINGS.CAMPAIGN_TOKEN);

function normalise(contact, stageLabels = {}, ownerNames = {}) {
  const p = contact.properties || {};
  const stage = clean(p[SETTINGS.STAGE_PROPERTY]);
  return {
    id: String(contact.id),
    name: [clean(p.firstname), clean(p.lastname)].filter(Boolean).join(" ") || "(no name)",
    created: Date.parse(p.createdate) || 0,
    campaignRaw: clean(p[SETTINGS.CAMPAIGN_PROPERTY]),
    campaign: campaignKey(p[SETTINGS.CAMPAIGN_PROPERTY]) || formName(p[SETTINGS.FORM_PROPERTY]),
    form: formName(p[SETTINGS.FORM_PROPERTY]),
    untitledForm: /generated untitled/i.test(clean(p[SETTINGS.FORM_PROPERTY])),
    stage,                                           // the stored value
    stageLabel: stage ? (stageLabels[stage] || stage) : "No lead stage yet",
    reasons: splitMulti(p[SETTINGS.REASON_PROPERTY]),
    category: clean(p[SETTINGS.CATEGORY_PROPERTY]),
    owner: ownerNames[p.hubspot_owner_id] || (p.hubspot_owner_id ? `Owner ${p.hubspot_owner_id}` : "Unassigned"),
  };
}

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function analyseSegment(leads) {
  const n = leads.length;
  const stages = {};
  leads.forEach((l) => { stages[l.stageLabel] = (stages[l.stageLabel] || 0) + 1; });

  const onl = leads.filter((l) => l.stage === SETTINGS.ONL_STAGE);
  const inel = leads.filter((l) => l.stage === SETTINGS.INELIGIBLE_STAGE);

  // why they were ineligible: the detailed reasons (a lead can carry several)
  const reasons = {};
  inel.forEach((l) => l.reasons.forEach((r) => { reasons[r] = (reasons[r] || 0) + 1; }));
  const categories = {};
  inel.forEach((l) => { const c = l.category || "Not set"; categories[c] = (categories[c] || 0) + 1; });
  const noReason = inel.filter((l) => !l.reasons.length && !l.category);

  // occupation, every way it gets recorded: the stage itself, or ineligible for occupation
  const occupationAll = new Set([
    ...onl.map((l) => l.id),
    ...inel.filter((l) => l.category === "Occupation Not Listed" || l.reasons.includes("Occupation Not In Demand")).map((l) => l.id),
  ]);

  const untitled = leads.filter((l) => l.untitledForm).length;
  return {
    untitled,
    leads: n,
    onl: onl.length, onlPct: pct(onl.length, n),
    inel: inel.length, inelPct: pct(inel.length, n),
    noStage: stages["No lead stage yet"] || 0,
    stages, reasons, categories,
    noReason: noReason.length, noReasonPct: pct(noReason.length, inel.length),
    occupationAll: occupationAll.size, occupationAllPct: pct(occupationAll.size, n),
    noReasonLeads: noReason,
  };
}

// which campaigns bring the most leads, and how good those leads are
function campaigns(leads) {
  const by = new Map();
  for (const l of leads) {
    const k = l.campaign || "(unnamed)";
    const c = by.get(k) || { campaign: k, leads: 0, onl: 0, inel: 0 };
    c.leads++;
    if (l.stage === SETTINGS.ONL_STAGE) c.onl++;
    if (l.stage === SETTINGS.INELIGIBLE_STAGE) c.inel++;
    by.set(k, c);
  }
  return [...by.values()]
    .map((c) => ({ ...c, onlPct: pct(c.onl, c.leads), inelPct: pct(c.inel, c.leads), unqualifiedPct: pct(c.onl + c.inel, c.leads) }))
    .sort((a, b) => b.leads - a.leads);
}

// who marks leads ineligible without saying why
function noReasonByConsultant(leads) {
  const by = {};
  leads.filter((l) => l.stage === SETTINGS.INELIGIBLE_STAGE).forEach((l) => {
    const o = by[l.owner] || (by[l.owner] = { owner: l.owner, inel: 0, noReason: 0 });
    o.inel++;
    if (!l.reasons.length && !l.category) o.noReason++;
  });
  return Object.values(by).filter((o) => o.noReason).map((o) => ({ ...o, pct: pct(o.noReason, o.inel) }))
    .sort((a, b) => b.noReason - a.noReason);
}

// change against the column before: points for a rate, per cent for a count
function delta(cur, prev, isRate) {
  if (prev == null || cur == null) return null;
  if (isRate) return Math.round((cur - prev) * 10) / 10;
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

module.exports = { normalise, analyseSegment, campaigns, noReasonByConsultant, delta, campaignKey, formName, isGlb, pct };
