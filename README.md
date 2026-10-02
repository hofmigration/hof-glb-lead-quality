# GLB lead quality

Every lead that came in through a **GLB campaign**, month by month: how many there were,
how many were **Occupation Not Listed**, how many were **Ineligible**, and **why**. The
report arrives as an email with everything in the body, and a CSV of every lead attached.

Read-only. Nothing in HubSpot is changed.

---

## Setting it up

New private repo, e.g. `hof-glb-lead-quality`. Upload the files to the root, and
`glb-leads.yml` to `.github/workflows/`.

Two secrets — the same values your other agents use:

| Secret | |
|---|---|
| `HUBSPOT_TOKEN` | the HOF private app token |
| `RESEND_KEY` | the key your compliance reports already send with |

No packages to install.

## Running it

**Actions → GLB lead quality → Run workflow**, and pick the months:

| Choice | Compares |
|---|---|
| previous month | last month on its own |
| last 2 months | last month against the month before |
| last 3 months / last 6 months | the last 3 or 6 full months, side by side |
| this month so far | the month to date |
| custom | any range — fill in **from** and **to** as `YYYY-MM-DD` |

A custom range is split at each month, so **15 Aug to 20 Sep** becomes two columns,
*15–31 Aug* and *1–20 Sep*. Part-months are labelled with their dates. Compare their
**percentages and leads per day**, not their totals — a 17-day column will always have
fewer leads than a 30-day one.

It also runs by itself on the **1st of every month at 9 AM**, covering the last 3 full months.

---

## What's in the email

- **The headline** — the latest month, against the one before
- **Month by month** — leads, leads per day, Occupation Not Listed, Ineligible, and leads
  with no stage yet. Every rate shows its change on the month before; for every rate in
  this report, up is worse.
- **Why leads were ineligible** — each reason, as a share of ineligible leads
- **The broad category** — Hof Ineligible Reason
- **Every lead stage** — where all the GLB leads ended up
- **Campaigns** — which GLB campaigns bring the most leads, and how many of them are
  unsuitable, with the worst flagged
- **Ineligible with no reason, by consultant**

---

## How it counts — and three things found in HubSpot while building it

**A GLB lead** is a contact whose ad **campaign** (*Original Traffic Source Drill-Down 2*)
**or** lead ad **form** (*First Conversion*) contains "glb", counted in the month it was
created, midnight to midnight Pakistan time.

Both are checked because they don't always agree. In September 2026:

| GLB by | Leads |
|---|---|
| both campaign and form | 2,670 |
| campaign only — the form was an unnamed *"Generated untitled 10/10/25, 3:36 PM"* | 314 |
| form only | 1 |

Counting by form alone would have missed about 1 in 10 GLB leads. The report flags the
unnamed-form leads every month, since anything that reports by form name will miss them —
worth asking marketing to rename that form in Meta.

**Two reason fields are in use, and they don't always agree.** *Reason For Lead Stage* is
the detailed one — Less Work Experience, Over Age, Low Education — and one lead can carry
several. *Hof Ineligible Reason* is broader, and often just "Other". The report shows both,
and leads with the detailed one.

**Many ineligible leads have no reason at all.** In a sample of September's ineligible leads,
about a third had neither field filled. The report counts these openly, and lists the
consultants concerned, because a lead turned away without a reason can't be checked later.

**Occupation gets recorded three ways** — as the *Occupation Not Listed* stage, or as an
Ineligible lead whose reason is *Occupation Not Listed* or *Occupation Not In Demand*. The
report gives the stage as you asked, and a separate line counting every route, each lead once.

A month with more than 10,000 leads is read in parts, so a busy month is never cut short.

## Changing a rule

Everything is in `config.js`. Every counting rule has a test in `selftest.js` —
`49 passed, 0 failed` — which runs before each report.
