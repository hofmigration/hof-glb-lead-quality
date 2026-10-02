// config.js — GLB lead quality report. SAFE TO EDIT.

const SETTINGS = {
  // ---- which leads ----
  // A lead is GLB if EITHER of these contains "glb":
  //   * its ad campaign — Original Traffic Source Drill-Down 2, e.g. "(glb) usa uae campaign - new"
  //   * its lead ad form — First Conversion, e.g. "Facebook Lead Ads: (glb) ksa usa campaign"
  // Both are needed. Checked on September 2026: 2,670 leads were GLB by both, 314 by
  // campaign only — their form was an unnamed "Generated untitled 10/10/25" one — and 1 by
  // form only. Counting by form alone would have missed about 1 in 10.
  CAMPAIGN_PROPERTY: "hs_analytics_source_data_2",
  FORM_PROPERTY: "first_conversion_event_name",
  CAMPAIGN_TOKEN: "glb",

  // ---- the period ----
  // previous month | last 2 months | last 3 months | last 6 months | this month so far | custom
  PERIOD: process.env.PERIOD || "",
  FROM_DATE: process.env.FROM_DATE || "",       // YYYY-MM-DD, for custom
  TO_DATE: process.env.TO_DATE || "",
  // the monthly scheduled run has no inputs, so it uses this
  SCHEDULED_PERIOD: "last 3 months",
  MAX_MONTHS: 24,
  TZ_OFFSET_HOURS: 5,                           // months run midnight to midnight, Pakistan time

  // ---- the stages and reasons it reports on ----
  STAGE_PROPERTY: "lead_stage",
  ONL_STAGE: "Occupation Not Listed",
  INELIGIBLE_STAGE: "Ineligible",
  // the detailed reason — can hold several at once, separated by ";"
  REASON_PROPERTY: "reason_for_didnt_fill",     // labelled "Reason For Lead Stage" in HubSpot
  // the broad category
  CATEGORY_PROPERTY: "hof_ineligible_reason",   // labelled "Hof Ineligible Reason"

  TOP_CAMPAIGNS: 12,
  TOP_CONSULTANTS: 10,

  // ---- the email ----
  REPORT_TO: process.env.REPORT_TO || "razaali@hofmigration.com",
  FROM_EMAIL: process.env.FROM_EMAIL || "onboarding@resend.dev",
  // a scheduled run has no inputs; an empty value must still send
  SEND_EMAIL: String(process.env.SEND_EMAIL || "true").toLowerCase() !== "false",
  OUT_DIR: "out",
  PORTAL_ID: "23735726",
  HUBSPOT_RPS: 4,                               // HubSpot allows about 4 searches a second
};

module.exports = { SETTINGS };
