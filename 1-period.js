// 1-period.js — turning a choice into months to compare.
//
// Every period is split at month boundaries, so a custom range from 15 Aug to 20 Sep
// becomes two columns, "15–31 Aug" and "1–20 Sep", compared side by side. A part-month
// is labelled with its real dates, so its raw counts are never mistaken for a full month.
const { SETTINGS } = require("./config");
const HOUR = 3600e3, DAY = 24 * HOUR;
const OFF = SETTINGS.TZ_OFFSET_HOURS * HOUR;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// midnight on the 1st, Pakistan time
const monthStart = (y, m) => Date.UTC(y, m, 1) - OFF;
const local = (t) => new Date(t + OFF);
function parseDay(s) {
  const m = String(s || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]) - OFF;
  const d = local(t);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : null;
}

function label(from, to, full) {
  const a = local(from), b = local(to - 1);
  if (full) return `${MONTH[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  return `${a.getUTCDate()}–${b.getUTCDate()} ${MON[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

// split [from, to) at each 1st of the month
function splitByMonth(from, to) {
  const out = [];
  let cur = from;
  for (let i = 0; i < 400 && cur < to; i++) {
    const d = local(cur);
    const next = monthStart(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const end = Math.min(next, to);
    const full = cur === monthStart(d.getUTCFullYear(), d.getUTCMonth()) && end === next;
    out.push({ from: cur, to: end, full, label: label(cur, end, full), days: Math.round((end - cur) / DAY * 10) / 10 });
    cur = end;
  }
  return out;
}

function resolvePeriod(nowMs = Date.now(), choice = SETTINGS.PERIOD, fromStr = SETTINGS.FROM_DATE, toStr = SETTINGS.TO_DATE) {
  const pick = String(choice || SETTINGS.SCHEDULED_PERIOD).toLowerCase().trim();
  const n = local(nowMs);
  const thisMonth = monthStart(n.getUTCFullYear(), n.getUTCMonth());

  if (pick === "custom") {
    const f = parseDay(fromStr), t = parseDay(toStr);
    if (f === null || t === null) throw new Error(`For a custom period, enter both dates as YYYY-MM-DD (got "${fromStr}" and "${toStr}").`);
    if (t < f) throw new Error(`The "to" date (${toStr}) is before the "from" date (${fromStr}).`);
    const end = Math.min(t + DAY, nowMs);                       // the to-date counts in full
    if (end <= f) throw new Error(`That period is in the future.`);
    const segs = splitByMonth(f, end);
    if (segs.length > SETTINGS.MAX_MONTHS) throw new Error(`That covers ${segs.length} months; the limit is ${SETTINGS.MAX_MONTHS}.`);
    if (end < t + DAY) segs[segs.length - 1].label += " (so far)";
    return { name: `${fromStr} to ${toStr}`, segments: segs };
  }
  if (pick === "this month so far") {
    const segs = splitByMonth(thisMonth, nowMs);
    segs[0].label = `${MONTH[n.getUTCMonth()]} ${n.getUTCFullYear()} (so far)`;
    return { name: "this month so far", segments: segs };
  }
  const months = pick === "previous month" ? 1 : Number((pick.match(/last (\d+) months?/) || [])[1]);
  if (!months) throw new Error(`Unknown period "${choice}".`);
  const from = monthStart(n.getUTCFullYear(), n.getUTCMonth() - months);
  return { name: pick, segments: splitByMonth(from, thisMonth) };
}

module.exports = { resolvePeriod, splitByMonth, parseDay, DAY };
