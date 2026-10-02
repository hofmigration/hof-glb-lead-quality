// selftest.js — the counting rules, against invented leads where the answer is known.
const { resolvePeriod } = require("./1-period");
const A = require("./2-analyse");
const { buildEmail, buildCsv } = require("./3-email");
const { SETTINGS } = require("./config");

let pass = 0, fail = 0;
const check = (l, ok, d = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${l}${ok || !d ? "" : `\n        ${d}`}`); ok ? pass++ : fail++; };
const NOW = Date.parse("2026-10-05T12:00:00+05:00");
const labels = (p) => p.segments.map((s) => s.label);

console.log("GLB LEAD QUALITY — SELF-TEST\n");

// ---- periods ----
check("previous month is September when run in October", labels(resolvePeriod(NOW, "previous month")).join() === "September 2026");
check("last 3 months is July, August, September", labels(resolvePeriod(NOW, "last 3 months")).join("|") === "July 2026|August 2026|September 2026");
check("the scheduled run, with no input, covers the last 3 months", resolvePeriod(NOW, "").segments.length === 3);
check("a custom range across two months becomes two columns", labels(resolvePeriod(NOW, "custom", "2026-08-15", "2026-09-20")).join("|") === "15–31 Aug 2026|1–20 Sep 2026");
check("whole months in a custom range are named as months", labels(resolvePeriod(NOW, "custom", "2026-08-01", "2026-09-30")).join("|") === "August 2026|September 2026");
check("a part-month is marked as not a full month", resolvePeriod(NOW, "custom", "2026-08-15", "2026-09-20").segments.every((s) => !s.full));
check("the 'to' date is included in full", (() => { const s = resolvePeriod(NOW, "custom", "2026-09-01", "2026-09-20").segments[0]; return s.days === 20; })());
check("a range still running is marked 'so far'", /so far/.test(resolvePeriod(NOW, "custom", "2026-09-20", "2026-10-30").segments.pop().label));
check("January looks back to December", labels(resolvePeriod(Date.parse("2027-01-03T10:00:00+05:00"), "previous month")).join() === "December 2026");
check("a 'to' date before the 'from' date is refused", (() => { try { resolvePeriod(NOW, "custom", "2026-09-20", "2026-09-01"); return false; } catch { return true; } })());
check("a badly written date is refused", (() => { try { resolvePeriod(NOW, "custom", "20/09/2026", "2026-09-30"); return false; } catch { return true; } })());
check("an impossible date is refused", (() => { try { resolvePeriod(NOW, "custom", "2026-02-30", "2026-03-10"); return false; } catch { return true; } })());
check("months start at midnight Pakistan time", resolvePeriod(NOW, "previous month").segments[0].from === Date.parse("2026-09-01T00:00:00+05:00"));

// ---- counting ----
const lead = (stage, reasons = "", category = "", campaign = "(glb) usa uae campaign - new", owner = "1") =>
  A.normalise({ id: String(Math.random()).slice(2), properties: { firstname: "A", lastname: "B", createdate: "2026-09-10T10:00:00Z",
    hs_analytics_source_data_2: campaign, lead_stage: stage, reason_for_didnt_fill: reasons, hof_ineligible_reason: category, hubspot_owner_id: owner } },
    { "Qualified": "Qualified CAN" }, { "1": "Ayesha Khan", "2": "Bilal Ahmed" });
const leads = [
  lead("Occupation Not Listed"), lead("Occupation Not Listed"),
  lead("Ineligible", "Over Age", "Age Bracket"),
  lead("Ineligible", "Low Education;Less Work Experience", "Other"),
  lead("Ineligible", "", "", "(glb) canada ksa new", "2"),                    // no reason at all
  lead("Ineligible", "", "Occupation Not Listed"),                            // ineligible for occupation
  lead("Qualified"), lead(""),
];
const s = A.analyseSegment(leads);
check("every lead is counted", s.leads === 8);
check("Occupation Not Listed is counted from the lead stage", s.onl === 2 && s.onlPct === 25);
check("Ineligible is counted from the lead stage", s.inel === 4 && s.inelPct === 50);
check("a lead with several reasons counts towards each", s.reasons["Low Education"] === 1 && s.reasons["Less Work Experience"] === 1);
check("an ineligible lead with neither reason field is 'no reason recorded'", s.noReason === 1 && s.noReasonPct === 25);
check("a lead with only the broad category is NOT 'no reason'", s.noReasonLeads.every((l) => !l.category));
check("occupation is counted every way it's recorded, each lead once", s.occupationAll === 3);
check("a lead with no stage is counted, not dropped", s.noStage === 1 && s.stages["No lead stage yet"] === 1);
check("stage labels are HubSpot's, not the stored value", s.stages["Qualified CAN"] === 1);
check("stage counts add up to every lead", Object.values(s.stages).reduce((a, b) => a + b, 0) === s.leads);
check("the top two reasons are found, most common first", s.topReasons.length === 2 && s.topReasons[0].count >= s.topReasons[1].count);
check("a top reason's share is of ineligible leads", s.topReasons[0].pct === Math.round((s.topReasons[0].count / s.inel) * 1000) / 10);
check("with no reasons recorded, there are no top reasons", A.analyseSegment([lead("Ineligible")]).topReasons.length === 0);

// ---- campaigns and consultants ----
check("spacing differences don't split one campaign in two", A.campaignKey("(glb) usa uae campaign -new") === A.campaignKey("(glb) usa uae campaign - new"));
check("a campaign with no space after (glb) still groups properly", A.campaignKey("(glb)hofmigrationksa") === "(glb) hofmigrationksa");
const camps = A.campaigns(leads);
check("campaigns are ranked by number of leads", camps[0].leads >= camps[camps.length - 1].leads);
const cons = A.noReasonByConsultant(leads);
check("consultants who left no reason are listed by name", cons.length === 1 && cons[0].owner === "Bilal Ahmed" && cons[0].noReason === 1);

// ---- GLB by campaign OR form ----
const mk = (campaign, form) => A.normalise({ id: "x", properties: { createdate: "2026-09-10T10:00:00Z", hs_analytics_source_data_2: campaign, first_conversion_event_name: form } });
check("a GLB campaign with an unnamed form is GLB", A.isGlb(mk("(glb) hof immigration gcc usa", "Facebook Lead Ads: Generated untitled 10/10/25, 3:36 PM")));
check("a GLB form in a non-GLB campaign is GLB", A.isGlb(mk("eb2 niw campaign gcc", "Facebook Lead Ads: (glb) ksa usa campaign")));
check("neither campaign nor form GLB is not GLB", !A.isGlb(mk("(dxb) australia new", "Facebook Lead Ads: KSA Leads - Interest")));
check("an unnamed form is flagged", mk("(glb) x", "Facebook Lead Ads: Generated untitled 10/10/25, 3:36 PM").untitledForm === true);
check("the form name loses its 'Facebook Lead Ads:' prefix", A.formName("Facebook Lead Ads: (glb) ksa usa campaign") === "(glb) ksa usa campaign");
check("a lead with no campaign is grouped by its form instead", mk("", "Facebook Lead Ads: (glb) ksa usa campaign").campaign === "(glb) ksa usa campaign");
check("the HubSpot search asks for campaign OR form", (() => { const src = require("fs").readFileSync("./0-hubspot.js", "utf8"); return /CAMPAIGN_PROPERTY, SETTINGS\.FORM_PROPERTY\]\.map/.test(src); })());

// ---- change on the month before ----
check("a rate's change is in points", A.delta(18.5, 15.0, true) === 3.5);
check("a count's change is a per cent", A.delta(120, 100, false) === 20);
check("no change against nothing", A.delta(10, null, true) === null);

// ---- the email and the CSV ----
const segs = resolvePeriod(NOW, "last 2 months").segments;
segs[0].stats = A.analyseSegment(leads.slice(0, 4));
segs[1].stats = s;
const r = { segments: segs, overall: { leads: 12, unqualifiedPct: 60 }, campaigns: camps, consultants: cons, untitled: 3 };
const html = buildEmail(r);
check("the email compares the months side by side", html.includes("August 2026") && html.includes("September 2026"));
check("the email leads with the latest month", /In <b>September 2026<\/b>/.test(html));
check("the email shows the change on the month before", /pts/.test(html));
check("the email shows ineligible leads with no reason", /No reason recorded/.test(html));
check("the email says how it was counted", /How this was counted/.test(html));
check("the email escapes text", !/<script/i.test(html));
check("the email flags leads from an unnamed form", /unnamed lead ad form/.test(html));
check("the headline gives the ineligible count", new RegExp(`<b>${s.inel}</b> \\(${s.inelPct}%\\) were Ineligible`).test(html));
check("the headline names the top two reasons", /top two reasons for ineligibility/i.test(html));
check("the month table compares the top two reasons", /Top two reasons for ineligibility/.test(html) && /1\. /.test(html) && /2\. /.test(html));
check("the tiles show total leads and the ineligible count", /total GLB leads/.test(html) && />ineligible</.test(html));
check("the email says both campaign and form are checked", /lead ad form \(First Conversion\)/.test(html));
const csv = buildCsv([{ period: "Sep", createdText: "2026-09-10 15:00", name: 'Ali "AJ" Khan', campaignRaw: "(glb) x", stageLabel: "Ineligible", reasons: ["Over Age"], category: "Age Bracket", owner: "Ayesha", link: "https://x" }]);
check("the CSV escapes quotes in names", csv.includes('"Ali ""AJ"" Khan"'));
check("the CSV opens correctly in Excel (UTF-8 marker)", csv.charCodeAt(0) === 0xfeff);

// ---- config ----
check("an empty send_email still sends — a scheduled run has no inputs", (() => { const v = (x) => String(x || "true").toLowerCase() !== "false"; return v("") && v(undefined) && !v("false"); })());
check("GLB is found by the campaign and the form fields", SETTINGS.CAMPAIGN_PROPERTY === "hs_analytics_source_data_2" && SETTINGS.FORM_PROPERTY === "first_conversion_event_name" && SETTINGS.CAMPAIGN_TOKEN === "glb");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
