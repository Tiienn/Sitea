# Sitea v1 Reset — "Feel the land before you drive there"

Status: draft (awaiting Tien's approval)
Date: 2026-06-12
Source: founder interview (PMF reset). This spec supersedes the positioning in PRD.md until PRD.md is rewritten to match.

## 1. Interview facts this spec is built on

- Sitea has **zero users**. It has never been marketed or announced anywhere.
- Origin insight: Tien couldn't picture land sizes his friends quoted ("5 toises", "2000 m²"). The seed problem is **area intuition**, not CAD, not floor plans.
- Market reality: Tien is in **Mauritius**, where land is quoted in toises/perches/arpents, the normal path to a home is *buy a plot, then build*, and buyers browse listings mostly on **Facebook** (plus LexpressProperty, WhatsApp forwards from agents).
- The cost of the problem: buyers who can't picture a plot **do a site visit** to find out. Sitea's job is to make the *feeling* available before the drive — so buyers pick which visits are worth making.
- Founder goal: **(a) a side project that pays for itself** — a few hundred USD/month is a win. Nights and weekends. Marketing loop must fit in ~2 h/week.
- Current costs: ~$50–60/month (mostly dev tooling), $100/yr Apple developer account.
- No emotional vetoes. Most existing features came from Tien's CAD background ("I thought it would be useful"), not from a user.

## 2. Positioning

**One-liner:** *Sitea — see exactly how big that land really is, before you visit it.*

**For:** the Mauritian land buyer scrolling listings, who reads "80 perches, Flacq, Rs 3.2M" and has no feeling for the number.

**The job:** turn a quoted land size into a physical feeling in under 15 seconds — see it, drop a house and two cars on it, walk it in first person — and decide whether the site visit is worth the drive.

**Why Sitea wins here:** none of the global tools (Planner 5D, Floorplanner, HomeByMe — see docs/competitive-analysis.md) speak toise/perche/arpent, none market in Mauritius, none are built around bare land. Mauritius-first is not Mauritius-forever; it's where the first 100 users come from because we can physically reach them. The product keeps working for anyone, anywhere.

## 3. The v1 wedge product

Everything below works **without sign-in**, loads fast on a phone, and points back to the share loop.

1. **Instant size input, front and center.** Type or pick a land size. Units: m², **toise, perche, arpent**, ft², acre, hectare. (Verify Mauritian conversion factors during build — approx: 1 arpent ≈ 4,221 m², 1 perche ≈ 42.21 m², 1 toise ≈ 3.80 m². Get these exactly right; they are the credibility of the whole product.)
2. **Deep links.** `sitea.live/?s=80perche` (or similar) loads the scene directly — no onboarding, no modal. Every shared link is a working demo. This is the single most important missing feature.
3. **Curated comparisons.** A short, locally meaningful set surfaced first: car, bus, football pitch, tennis court, typical 3-bedroom house, parking spaces. The long tail (Pokémon Center etc.) stays available — fun drives shares — but curated, not a wall of 40 thumbnails.
4. **House template drop.** "Does a 3-bedroom with parking fit?" — one tap, one template on the plot. Templates, not the wall/door editor.
5. **First-person walk.** The existing avatar, footprints, footsteps, and door work *serves this spec* — walking the plot is how a human body understands 2000 m². Keep it. Polish stops here; no further game-direction work.
6. **One-tap share image.** Branded PNG sized for Facebook: the plot, the comparisons, the size callout in local units, and `sitea.live`. This is the marketing loop's fuel. (Exists partially via screenshot/export; needs the branded, post-ready composition.)
7. **Analytics ON.** `VITE_ANALYTICS_ENABLED` is currently false in production. We cannot learn anything with it off. Turn it on; track: scene loads, deep-link loads, unit used, share-image exports, walk-mode entries, Pro purchases.

## 4. Monetization (simplified to one decision)

- **Free:** everything in section 3, plus 1 saved project (sign-in required to save). Share links as today.
- **Sitea Pro — $20 one-time:** floor-plan upload (20 uploads), unlimited saved projects, time-of-day control. The floor-plan analyzer becomes *the* paid feature — its real API costs are then paid by the only people who use it.
- **Cut:** the $9.99/month subscription (PayPal subscription verification is ongoing maintenance for a side project) and the $149 lifetime tier (meaningless at zero volume; two prices is one price too many).
- **Math:** goal ≈ $200–300/month ⇒ 10–15 Pro sales/month. Achievable from one island's Facebook groups if the free loop works.

## 5. The distribution loop (this IS the roadmap)

Weekly, ~2 hours, starting the week this spec is approved — before any further feature work:

1. Pick 2 real, current land listings from Mauritian Facebook groups / LexpressProperty.
2. Recreate each in Sitea (target: under 60 seconds each).
3. Export the share image; post it in the group / as a comment with the deep link: *"Here's what 80 perches in Flacq actually looks like — with a house and two cars on it."*
4. Log: post reach, link clicks, scene loads, any comments/DMs.
5. After ~10 posts: DM the 5 agents whose listings got visualized. Offer free visualizations for their listings. Listen for what they'd pay for. (A future agent tier is the most plausible path past $300/month — but only if pulled by demand.)

## 6. Metrics and kill criteria

90-day clock starts at the first Facebook post.

- **Week 4:** ≥10 posts published. If fewer, the problem is founder follow-through, not the product (see failure mode 3).
- **Day 90 targets:** ~1,000 scene loads from Mauritius · ≥50 share images exported by *users* (not by Tien) · ≥10 Pro purchases.
- **Kill/pivot signal:** if 10 honest posts produce <100 scene loads, the channel-or-moment hypothesis is wrong. Do not respond by building features. Next experiment is the **agent channel** (agents push Sitea links to buyers), which needs conversations, not code.

## 7. Freeze list (code stays in the repo; zero new work)

| Frozen | Why |
|---|---|
| Open-world/Genshin direction (NPCs, quests, terrain expansion) | Serves no land buyer. Current branch polish (avatar, footprints, doors) ships because it serves the walk; the *direction* stops. |
| Building editor depth (walls/doors/windows/stairs/roof/pool/fence panels) | CAD-background feature. Templates cover the persona's question ("does a house fit?"). |
| Floor-plan analyzer investment (fallback chains, QA harness expansion) | Keep it running as the Pro feature; invest again only when ≥10 Pro sales/month demand it. |
| Capacitor iOS/Android shells | App-store maintenance for zero users. Web/PWA only. Don't renew the $100/yr Apple account. |
| DXF + GLB export in primary UI | CAD-user features. Keep code; remove from the main export surface. PNG + PDF stay. |
| Subscription billing | Cut with the $9.99 tier. |

## 8. Non-goals

- Global SEO or feature-parity war with Planner 5D / Floorplanner / HomeByMe.
- Interior design, furniture libraries.
- CAD-precision drafting tools.
- An agent portal/dashboard (until agents ask for one with their wallets).

## 9. Three ways this fails

1. **The channel fails.** Facebook group posts get ignored or removed as spam; the "moment of confusion" doesn't convert into a click because a static image already satisfies the curiosity. *Mitigation:* the share image must tease, not satisfy — the walk is the payoff behind the link. Test 10 posts before believing anything. Fallback channel: agents.
2. **The value is a one-time curiosity.** People click, say "oh nice," feel the size once, and never return — and the payment moment (floor-plan upload) belongs to a *different*, later phase of their journey, so free users never convert. *Mitigation:* watch the day-90 numbers honestly; if loads are high but Pro sales are zero, the monetization must move to where the money already is (agents, listings), not to more paywalls on buyers.
3. **The founder regresses to building.** This is the most likely failure. Tien is a builder; posting in Facebook groups is uncomfortable; the Genshin branch is fun. Six months from now there are 60 more commits of avatar polish and still zero users. *Mitigation:* this spec makes the weekly post the only roadmap item. No new feature work is "allowed" until 10 posts are published. The repo should make Tien feel that.

## 10. Build queue implied by this spec (small, in order)

1. Enable + verify analytics in production.
2. Deep-link scene loading (`?s=...` with unit parsing).
3. Mauritian units (toise/perche/arpent) in the size input and area readouts — exact factors, sourced.
4. Branded share-image export (Facebook-ready composition).
5. Pricing simplification: one $20 Pro tier; remove subscription + lifetime from PricingModal and PayPal config.
6. Curate the comparison panel's default view.
7. Hide DXF/GLB from primary export UI.

Each item is a separate small task per CLAUDE.md rules. Items 1–4 are prerequisites for the first Facebook post only in spirit — posts can start immediately with manual screenshots; don't wait.
