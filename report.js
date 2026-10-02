// report.js — the run. Read-only: nothing in HubSpot is changed.
const fs = require("fs");
const path = require("path");
const { SETTINGS } = require("./config");
const hub = require("./0-hubspot");
const { resolvePeriod } = require("./1-period");
const A = require("./2-analyse");
const { buildEmail, buildCsv, sendEmail } = require("./3-email");

const OFF = SETTINGS.TZ_OFFSET_HOURS * 3600e3;
const fmt = (t) => new Date(t + OFF).toISOString().slice(0, 16).replace("T", " ");

(async () => {
  if (!process.env.HUBSPOT_TOKEN) { console.log("!! No HUBSPOT_TOKEN secret."); process.exit(1); }
  try {
    const period = resolvePeriod();
    console.log(`=== GLB lead quality — ${period.name} ===`);
    console.log(`Comparing: ${period.segments.map((s) => s.label).join("  |  ")}\n`);

    const [stageLabels, owners] = await Promise.all([hub.optionLabels(SETTINGS.STAGE_PROPERTY), hub.ownerNames()]);

    const all = [];
    for (const seg of period.segments) {
      const raw = await hub.leadsBetween(seg.from, seg.to);
      // double-check each lead really is GLB, by campaign or form, rather than trusting the search alone
      const leads = raw.map((c) => A.normalise(c, stageLabels, owners)).filter(A.isGlb);
      seg.stats = A.analyseSegment(leads);
      leads.forEach((l) => all.push({ ...l, period: seg.label, createdText: fmt(l.created), link: hub.contactLink(l.id) }));
      const s = seg.stats;
      console.log(`${seg.label.padEnd(24)} ${String(s.leads).padStart(6)} leads   occupation not listed ${String(s.onlPct).padStart(5)}%   ineligible ${String(s.inelPct).padStart(5)}%   no reason ${s.noReasonPct}% of ineligible`);
    }

    const camps = A.campaigns(all);
    const unq = all.filter((l) => l.stage === SETTINGS.ONL_STAGE || l.stage === SETTINGS.INELIGIBLE_STAGE).length;
    const r = {
      segments: period.segments,
      overall: { leads: all.length, unqualifiedPct: A.pct(unq, all.length) },
      campaigns: camps,
      consultants: A.noReasonByConsultant(all),
    };

    if (!all.length) console.log(`\n!! No GLB leads were found in this period. Check the dates, and that campaign or form names still contain "glb".`);
    const untitled = all.filter((l) => l.untitledForm).length;
    if (untitled) console.log(`Note: ${untitled} GLB lead(s) came through an unnamed form ("Generated untitled…") — counted because their campaign is GLB.`);
    r.untitled = untitled;

    fs.mkdirSync(SETTINGS.OUT_DIR, { recursive: true });
    const html = buildEmail(r);
    const csv = buildCsv(all);
    const tag = period.segments.length > 1 ? `${period.segments[0].label} to ${period.segments[period.segments.length - 1].label}` : period.segments[0].label;
    const csvName = `GLB-leads-${tag.replace(/[^A-Za-z0-9]+/g, "-")}.csv`;
    fs.writeFileSync(path.join(SETTINGS.OUT_DIR, "report.html"), html);
    fs.writeFileSync(path.join(SETTINGS.OUT_DIR, csvName), csv);
    console.log(`\nWrote report.html and ${csvName} — both are in this run's Artifacts.`);

    if (!SETTINGS.SEND_EMAIL) { console.log("Not emailed (send_email is false)."); return; }
    const last = period.segments[period.segments.length - 1].stats;
    const ok = await sendEmail(`GLB lead quality — ${tag}: ${last.onlPct}% occupation not listed, ${last.inelPct}% ineligible`, html, csvName, csv);
    if (ok) console.log(`Emailed to ${SETTINGS.REPORT_TO}.`);
    else { console.log("!! Not emailed. The report is still in Artifacts."); process.exitCode = 1; }
  } catch (e) {
    console.error(`\nFAILED: ${e.message}`);
    process.exit(1);
  }
})();
