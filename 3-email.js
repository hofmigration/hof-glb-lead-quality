// 3-email.js — the report, embedded in the email body. Months run left to right, and
// every rate shows its change on the month before it.
const { SETTINGS } = require("./config");
const { delta, pct } = require("./2-analyse");

const C = { navy: "#16205e", royal: "#1f2f8f", ink: "#1f2937", body: "#3f4a5a", soft: "#868e9b", line: "#e6e9f1",
  panel: "#f7f9fc", bad: "#b42318", badbg: "#fdecea", warn: "#9a5b0c", warnbg: "#fff5e8", good: "#1e7a4d", goodbg: "#e9f6ee" };
const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n) => Number(n || 0).toLocaleString("en-US");

// a rate going up is bad news for every rate in this report
function arrow(d) {
  if (d == null || d === 0) return d === 0 ? `<div style="font:400 10.5px/1.2 ${F};color:${C.soft}">no change</div>` : "";
  const up = d > 0;
  return `<div style="font:600 10.5px/1.2 ${F};color:${up ? C.bad : C.good}">${up ? "▲" : "▼"} ${Math.abs(d)} pts</div>`;
}
function countChange(d) {
  if (d == null) return "";
  return `<div style="font:400 10.5px/1.2 ${F};color:${C.soft}">${d > 0 ? "+" : ""}${d}%</div>`;
}

const TH = `padding:8px 9px;font:700 10.5px/1.3 ${F};letter-spacing:.04em;text-transform:uppercase;color:${C.navy};background:${C.panel};border-bottom:1px solid ${C.line}`;
const TD = `padding:8px 9px;border-top:1px solid ${C.line};font:400 12.5px/1.4 ${F};color:${C.ink};vertical-align:top`;
const heading = (t, sub) => `<div style="font:700 15px/1.3 ${F};color:${C.navy};margin:26px 0 ${sub ? 3 : 10}px">${esc(t)}</div>${sub ? `<div style="font:400 12px/1.5 ${F};color:${C.soft};margin:0 0 10px">${sub}</div>` : ""}`;

function grid(segs, rows) {
  const head = `<tr><td style="${TH}"></td>${segs.map((s) => `<td align="right" style="${TH}">${esc(s.label)}</td>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr><td style="${TD};color:${C.body}">${r.label}</td>${r.cells.map((c) => `<td align="right" style="${TD}">${c}</td>`).join("")}</tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-collapse:collapse">${head}${body}</table>`;
}
const cell = (n, p) => `<span style="font-weight:700">${num(n)}</span>${p != null ? ` <span style="color:${C.soft}">(${p}%)</span>` : ""}`;

function buildEmail(r) {
  const segs = r.segments, S = segs.map((s) => s.stats);
  const last = S[S.length - 1], prev = S.length > 1 ? S[S.length - 2] : null;
  const lastSeg = segs[segs.length - 1];

  // the headline: the latest month, against the one before
  const vs = prev ? ` against ${esc(segs[segs.length - 2].label)}` : "";
  const dOnl = prev ? delta(last.onlPct, prev.onlPct, true) : null;
  const dInel = prev ? delta(last.inelPct, prev.inelPct, true) : null;
  const move = (d) => d == null ? "" : d === 0 ? " (no change)" : ` (${d > 0 ? "up" : "down"} ${Math.abs(d)} pts${vs})`;
  const topReason = Object.entries(last.reasons).sort((a, b) => b[1] - a[1])[0];

  const tile = (v, l, fg, bg) => `<td width="25%" align="center" style="background:${bg};border-radius:6px;padding:13px 6px"><div style="font:700 22px/1 ${F};color:${fg}">${esc(v)}</div><div style="font:600 9.5px/1.3 ${F};letter-spacing:.06em;text-transform:uppercase;color:${fg};margin-top:6px">${esc(l)}</div></td>`;

  // ---- month by month ----
  const prevOf = (i) => (i > 0 ? S[i - 1] : null);
  const rateRow = (label, nKey, pKey) => ({ label, cells: S.map((s, i) => cell(s[nKey], s[pKey]) + arrow(prevOf(i) ? delta(s[pKey], prevOf(i)[pKey], true) : null)) });
  const monthRows = [
    { label: "<b>GLB leads</b>", cells: S.map((s, i) => `<span style="font-weight:700">${num(s.leads)}</span>` + (segs.every((x) => x.full) ? countChange(prevOf(i) ? delta(s.leads, prevOf(i).leads, false) : null) : "")) },
    { label: "Leads per day", cells: segs.map((s) => `${Math.round((s.stats.leads / s.days) * 10) / 10}`) },
    rateRow("Occupation Not Listed <span style=\"color:" + C.soft + "\">(lead stage)</span>", "onl", "onlPct"),
    rateRow("Ineligible <span style=\"color:" + C.soft + "\">(lead stage)</span>", "inel", "inelPct"),
    rateRow("Occupation, every way it's recorded", "occupationAll", "occupationAllPct"),
    { label: "No lead stage yet", cells: S.map((s) => cell(s.noStage, pct(s.noStage, s.leads))) },
  ];

  // ---- reasons ----
  const reasonNames = [...new Set(S.flatMap((s) => Object.keys(s.reasons)))]
    .sort((a, b) => S.reduce((t, s) => t + (s.reasons[b] || 0), 0) - S.reduce((t, s) => t + (s.reasons[a] || 0), 0));
  const reasonRows = [
    ...reasonNames.map((name) => ({ label: esc(name), cells: S.map((s) => (s.reasons[name] ? cell(s.reasons[name], pct(s.reasons[name], s.inel)) : `<span style="color:${C.soft}">—</span>`)) })),
    { label: `<b style="color:${C.bad}">No reason recorded</b>`, cells: S.map((s, i) => `<span style="color:${s.noReason ? C.bad : C.ink};font-weight:700">${num(s.noReason)}</span> <span style="color:${C.soft}">(${s.noReasonPct}%)</span>` + arrow(prevOf(i) ? delta(s.noReasonPct, prevOf(i).noReasonPct, true) : null)) },
  ];
  const catNames = ["Education Gap", "Age Bracket", "Occupation Not Listed", "Other", "Not set"]
    .filter((c) => S.some((s) => s.categories[c]))
    .concat([...new Set(S.flatMap((s) => Object.keys(s.categories)))].filter((c) => !["Education Gap", "Age Bracket", "Occupation Not Listed", "Other", "Not set"].includes(c)));
  const catRows = catNames.map((c) => ({ label: esc(c), cells: S.map((s) => (s.categories[c] ? cell(s.categories[c], pct(s.categories[c], s.inel)) : `<span style="color:${C.soft}">—</span>`)) }));

  // ---- every stage ----
  const stageNames = [...new Set(S.flatMap((s) => Object.keys(s.stages)))]
    .sort((a, b) => S.reduce((t, s) => t + (s.stages[b] || 0), 0) - S.reduce((t, s) => t + (s.stages[a] || 0), 0));
  const stageRows = stageNames.map((st) => ({ label: esc(st), cells: S.map((s) => (s.stages[st] ? cell(s.stages[st], pct(s.stages[st], s.leads)) : `<span style="color:${C.soft}">—</span>`)) }));

  // ---- campaigns ----
  const camp = r.campaigns.slice(0, SETTINGS.TOP_CAMPAIGNS).map((c) => {
    const flag = c.leads >= 20 && c.unqualifiedPct >= r.overall.unqualifiedPct + 10;
    return `<tr>
      <td style="${TD}">${esc(c.campaign)}${flag ? `<div style="font:600 10.5px/1.3 ${F};color:${C.bad};margin-top:2px">well above the average share of unsuitable leads</div>` : ""}</td>
      <td align="right" style="${TD};font-weight:700">${num(c.leads)}</td>
      <td align="right" style="${TD}">${c.onlPct}%</td>
      <td align="right" style="${TD}">${c.inelPct}%</td>
      <td align="right" style="${TD};font-weight:700;color:${flag ? C.bad : C.ink}">${c.unqualifiedPct}%</td></tr>`;
  }).join("");

  // ---- consultants ----
  const cons = r.consultants.slice(0, SETTINGS.TOP_CONSULTANTS).map((o) => `<tr>
    <td style="${TD}">${esc(o.owner)}</td><td align="right" style="${TD}">${num(o.inel)}</td>
    <td align="right" style="${TD};font-weight:700;color:${C.bad}">${num(o.noReason)}</td><td align="right" style="${TD}">${o.pct}%</td></tr>`).join("");

  const partial = segs.some((s) => !s.full);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef1f6;padding:26px 10px"><tr><td align="center">
<table role="presentation" width="700" cellpadding="0" cellspacing="0" border="0" style="width:700px;max-width:700px;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="background-color:${C.navy};background-image:linear-gradient(120deg,${C.navy},${C.royal});padding:22px 26px">
  <div style="font:700 20px/1.3 ${F};color:#fff">GLB lead quality — ${esc(segs.length > 1 ? `${segs[0].label} to ${lastSeg.label}` : lastSeg.label)}</div>
  <div style="font:400 12.5px/1.5 ${F};color:#aab0d4;margin-top:5px">${num(r.overall.leads)} leads from GLB campaigns · ${segs.length} ${segs.length > 1 ? "periods compared" : "period"}</div>
</td></tr>
<tr><td style="padding:22px 26px">

  <table role="presentation" width="100%" style="margin:0 0 16px"><tr><td style="background:${C.panel};border-left:4px solid ${C.royal};padding:13px 16px;font:400 14px/1.65 ${F};color:${C.ink}">
    In <b>${esc(lastSeg.label)}</b>, ${num(last.leads)} GLB leads came in. <b>${last.onlPct}%</b> were Occupation Not Listed${move(dOnl)}, and <b>${last.inelPct}%</b> were Ineligible${move(dInel)}.
    ${topReason ? `The most common reason for ineligibility was <b>${esc(topReason[0])}</b>.` : ""}
    ${last.noReason ? `<span style="color:${C.bad}"><b>${last.noReasonPct}%</b> of ineligible leads have no reason recorded.</span>` : ""}
  </td></tr></table>

  <table role="presentation" width="100%" cellspacing="8" style="margin:0 -8px"><tr>
    ${tile(num(last.leads), "GLB leads", C.navy, C.panel)}
    ${tile(last.onlPct + "%", "occupation not listed", C.warn, C.warnbg)}
    ${tile(last.inelPct + "%", "ineligible", C.bad, C.badbg)}
    ${tile(last.noReasonPct + "%", "ineligible, no reason", last.noReason ? C.bad : C.good, last.noReason ? C.badbg : C.goodbg)}
  </tr></table>

  ${heading("Month by month", `Percentages are of that period's GLB leads. Arrows show the change on the period before; for every rate here, up is worse.${partial ? " Part-months are labelled with their dates — compare their percentages and leads per day, not their totals." : ""}`)}
  ${grid(segs, monthRows)}

  ${heading("Why leads were ineligible", `From <i>Reason For Lead Stage</i>, as a share of ineligible leads. One lead can carry several reasons, so these can add up to more than 100%.`)}
  ${grid(segs, reasonRows)}

  ${catRows.length ? heading("The broad category", `From <i>Hof Ineligible Reason</i>. "Other" usually means the detailed reason above is the one to read.`) + grid(segs, catRows) : ""}

  ${heading("Every lead stage", "Where all the GLB leads in each period ended up.")}
  ${grid(segs, stageRows)}

  ${camp ? heading("Campaigns", `Across the whole period, by number of leads. <i>Unsuitable</i> is Occupation Not Listed plus Ineligible — ${r.overall.unqualifiedPct}% on average.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-collapse:collapse">
      <tr><td style="${TH}">Campaign</td><td align="right" style="${TH}">Leads</td><td align="right" style="${TH}">Occ. not listed</td><td align="right" style="${TH}">Ineligible</td><td align="right" style="${TH}">Unsuitable</td></tr>${camp}</table>` : ""}

  ${r.untitled ? `<table role="presentation" width="100%" style="margin:22px 0 0"><tr><td style="background:${C.warnbg};border-left:4px solid ${C.warn};padding:12px 15px;font:400 13px/1.6 ${F};color:${C.warn}">
    <b>${num(r.untitled)} of these leads came through an unnamed lead ad form</b> ("Generated untitled…"). They're counted here because their campaign is GLB, but anything that reports by form name will miss them. Worth asking marketing to rename that form.
  </td></tr></table>` : ""}

  ${cons ? heading("Ineligible with no reason, by consultant", "Across the whole period. These are the leads where nobody can tell later why they were turned away.") +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-collapse:collapse">
      <tr><td style="${TH}">Consultant</td><td align="right" style="${TH}">Ineligible</td><td align="right" style="${TH}">No reason</td><td align="right" style="${TH}">Share</td></tr>${cons}</table>` : ""}

  <div style="font:400 11.5px/1.7 ${F};color:${C.soft};margin-top:22px;padding-top:14px;border-top:1px solid ${C.line}">
    <b style="color:${C.body}">How this was counted.</b> A GLB lead is a contact whose ad campaign (Original Traffic Source Drill-Down 2) or lead ad form (First Conversion) contains "glb", counted in the month it was created, midnight to midnight Pakistan time. Both are checked because some GLB campaigns run on an unnamed form.
    "Occupation, every way it's recorded" adds the Occupation Not Listed stage to ineligible leads whose reason is Occupation Not Listed or Occupation Not In Demand, counting each lead once.
    Every lead is in the attached CSV with a link to its HubSpot record.
  </div>
</td></tr>
<tr><td style="background:${C.panel};border-top:1px solid ${C.line};padding:15px 26px;font:400 11.5px/1.6 ${F};color:${C.soft}"><strong style="color:${C.body}">Ali Raza</strong> · Compliance · HOF Migration<br>Read-only. Nothing in HubSpot was changed.</td></tr>
</table></td></tr></table>`;
}

function buildCsv(rows) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Period", "Created (PKT)", "Name", "Campaign", "Lead ad form", "Lead stage", "Reason for lead stage", "Hof ineligible reason", "Owner", "HubSpot"];
  return "\uFEFF" + [head.map(q).join(",")].concat(rows.map((r) => [r.period, r.createdText, r.name, r.campaignRaw, r.form, r.stageLabel, r.reasons.join("; "), r.category, r.owner, r.link].map(q).join(","))).join("\r\n");
}

async function sendEmail(subject, html, csvName, csv) {
  if (!process.env.RESEND_KEY) { console.log("No RESEND_KEY — not emailed."); return false; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: SETTINGS.FROM_EMAIL, to: [SETTINGS.REPORT_TO], subject, html,
      attachments: [{ filename: csvName, content: Buffer.from(csv, "utf8").toString("base64") }] }),
  });
  if (!res.ok) {
    console.log(`Email failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    if (res.status === 403) console.log("  The built-in sender only reaches the address the Resend account was registered with.");
    return false;
  }
  return true;
}

module.exports = { buildEmail, buildCsv, sendEmail };
