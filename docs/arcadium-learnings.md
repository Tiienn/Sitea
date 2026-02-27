# What Sitea Can Learn From Arcadium 3D

> February 2026 | Based on hands-on exploration of arcadium3d.com

---

## Quick Context

Arcadium is Sitea's closest competitor: browser-only, real-time 3D, first-person walkthrough, free tier. They have 132,800+ users, 5-star reviews from architects, and are clearly investing heavily in AI and content marketing. This doc breaks down what they do well that we should steal, adapt, or leapfrog.

---

## 1. Steal — Things They Do Better Right Now

### 1a. Furniture Library
**What they have:** A large built-in 3D model library (chairs, tables, beds, sofas, kitchen cabinets, appliances, lighting fixtures, plants, garden objects). Drag-drop into the scene. All built to scale.

**Why it matters:** Every single competitor has this. It's the #1 feature gap in our competitive analysis. Without furniture, users can walk through empty rooms. That's not enough to visualize "what my house will feel like."

**Recommendation:** Start with a small curated set (10-15 models): bed, sofa, dining table, 4 chairs, kitchen counter, fridge, toilet, sink, bathtub, TV, desk. Use free GLB models from Sketchfab/Poly Pizza. Drag-drop placement with snap-to-floor. This is the single highest-impact feature we're missing.

**Effort:** Medium | **Impact:** Very High

---

### 1b. AI Visualization (Image-to-Image)
**What they have:** Take any 3D view, click "AI", and generate variations: photorealistic render, different interior style, specific furniture, pencil sketch, watercolor. 5 distinct output styles from one input.

**Why it matters:** This is their biggest wow factor. The before/after is compelling (basic 3D model -> photorealistic room). It's also their monetization lever (150 AI images/mo on Pro, 400 on Power).

**Recommendation:** We could implement this using an image-to-image API (Stability AI, Replicate, or OpenAI DALL-E). Take a screenshot of the current 3D view, send it to an API with a style prompt, return the result. Start with 1-2 styles (photorealistic + sketch). Gate behind Pro plan.

**Status: PARKED.** Exciting but premature. We don't have furniture yet. Adding AI image generation before that fundamental is like putting a turbocharger on a car with no seats. The wow factor is real, but the retention infrastructure isn't there to capitalize on it. Build this after furniture + saved projects are solid.

**Effort:** Medium | **Impact:** High (wow factor + monetization)

---

### 1c. Multiple View Modes
**What they have:** 6 toolbar shortcuts for switching views:
- **Key 1 - Elevations:** Floor plan (2D), Top down, Front, Right, Back, Left
- **Key 2 - 3D Isometric:** Cutaway view with roof wireframe
- **Key 3 - First person:** WASD + mouse look, adjustable FOV
- **Key 4 - Cross section:** Horizontal cut at adjustable height (shows wall thickness/hatching)
- **Key 5 - Outline mode:** Clean wireframe/line-art view (great for floor plans)

**What we have:** First person, third person camera, minimap, AND a 2D top-down orthographic view.

**Status: PARTIALLY DONE.** We already have 2D top-down view. What we're still missing: front/side elevations, cross-section mode, and outline/wireframe mode. Elevations are just camera-angle changes. Outline mode would be low effort with high visual impact (great for shareable floor plan screenshots).

**Effort:** Low-Medium | **Impact:** Medium (incremental, since 2D view exists)

---

### ~~1d. Shareable URLs~~ DONE
**What they have:** Every project gets a public URL. Anyone with the link can view the 3D model, rotate it, take a first-person walkthrough. No login needed to view.

**Status: ALREADY SHIPPED.** We have scene sharing via Supabase with read-only mode. Cross this off.

**Remaining opportunity:** Make sure the share flow is prominent and frictionless. Every share = free marketing. Consider adding a "Share" button to the main toolbar if it's buried.

---

### 1e. Dimension Annotations & Labels
**What they have:** Clickable dimension lines showing exact measurements on walls and rooms (e.g., "5.00m", "2.40m"). Both horizontal and vertical. Plus text labels for room names.

**What we have:** We show dimensions during wall drawing but not as persistent annotations.

**Recommendation:** Add persistent dimension labels on walls/rooms that show in both 3D and 2D views. Room labels ("Living Room", "Bedroom") that users can name. Essential for the floor-plan-to-contractor workflow.

**Effort:** Medium | **Impact:** Medium-High

---

## 2. Adapt — Things They Do Differently That We Can Learn From

### 2a. Environment & Lighting Controls
**What they have:** Full environment settings panel: ambient light intensity (0-1), directional light (brightness, rotation angle, altitude angle, color), floor color, sky gradient (top/bottom), grid toggle, dimension toggle, snap-to-grid toggle. Individual light fixtures (lamps, pendants, spots) with per-light brightness.

**What we have:** Day/night toggle.

**Recommendation:** Don't go full Arcadium here - their target is designers, ours is homeowners. But adding sun position control (time-of-day slider) and maybe 2-3 lighting presets ("Morning", "Noon", "Golden Hour", "Night") would add polish without complexity. Keep it simple.

**Effort:** Low | **Impact:** Medium

---

### 2b. Parametric Components
**What they have:** Stairs, windows, and doors that auto-adjust parameters. Stairs dynamically generate based on height/width/depth. Windows cut into walls automatically. Doors auto-fit wall openings.

**What we have:** We have stairs with customizable properties. Our wall openings (doors/windows) exist but may not be as parametrically flexible.

**Recommendation:** Ensure our stairs, doors, and windows feel parametric - where changing one dimension intelligently adjusts related dimensions. This is about polish, not new features.

**Effort:** Low | **Impact:** Medium

---

### 2c. Their Pricing Model
**What they charge:**
- Free: 2 projects, 50 objects max, single editor
- Pro: $18/mo yearly ($26/mo monthly) - unlimited everything, 150 AI images, custom models
- Power: $60/mo yearly ($80/mo monthly) - 400 AI images, 10GB storage

**Our pricing:** Free / $9.99 monthly / $29 homeowner (one-time) / $149 lifetime

**Analysis:** They charge significantly more ($18-26/mo vs our $9.99/mo) and don't offer a one-time option. Their free tier is more limited (2 projects, 50 objects). Our $29 one-time Homeowner plan is a major advantage for consumers - nobody else offers this.

**Recommendation:** Keep our pricing as-is. Our one-time $29 is a competitive weapon. But we should tighten our free tier limits slightly to create upgrade pressure (like Arcadium's 2-project limit). Consider adding AI image credits as a Pro feature when we add AI visualization.

**Effort:** Low | **Impact:** Medium

---

### 2d. Content Marketing / SEO Pages
**What they have:** Dedicated landing pages for every use case: `/interior_design`, `/kitchen_layouts`, `/house_plans`, `/landscape_design`, `/feng_shui`, `/bedroom_ideas`, `/floor_plan_creator`, `/room_designer`, `/3d_modeling`. Plus a color palette generator tool, resource articles, and YouTube tutorials.

**What we have:** Just the app.

**Recommendation:** Create 3-5 SEO landing pages targeting our core use case: "land plot house design", "visualize house on my land", "free 3D house design tool", "house design for homeowners". Each page should have screenshots, a brief description, and a CTA to start designing. This is free traffic.

**Status: CORRECT BUT WRONG TIMING.** We need something worth landing on first. A user who Googles "free 3D house design tool" and lands on Sitea currently gets empty rooms with no furniture. After furniture library ships and house templates are polished, THEN SEO pages convert. Build these after the product experience is strong enough that landing page traffic actually sticks.

**Effort:** Medium | **Impact:** High (SEO/growth)

---

## 3. Leapfrog — Where We Already Win and Should Double Down

### 3a. Land-First Flow (Our Moat)
Arcadium starts with an empty canvas. No concept of "your land." They're interior-focused. We start with "what's your lot size?" and help you design what fits. **No competitor does this.** This is our moat. Keep investing here - add setback line visualization, lot coverage %, building-to-land ratio.

### 3b. Mobile-First Touch Controls
Arcadium's mobile experience is an afterthought - their toolbar and keyboard shortcuts (1-5, WASD) don't translate to touch. We have purpose-built joystick + camera controls. Keep refining this. Add haptic feedback, gesture shortcuts.

### 3c. Outdoor Structures Bundle
Arcadium has no pools, fences, or foundations. We bundle these free. This is a real differentiator for the homeowner building their first house. Add more outdoor elements: driveway, garage, pergola, deck.

### 3d. Zero Friction
Arcadium requires signup even for the free tier. We don't. Keep this. It's a huge conversion advantage.

### 3e. One-Time Pricing — Our Biggest Competitive Weapon
No competitor offers a $29 one-time plan. Arcadium charges $18-26/month with no one-time option. A homeowner comparing "$26/month forever" vs "$29 once" won't think twice. Our pricing isn't just competitive — it's disruptive. This should be front and center in all marketing copy, especially when we build SEO landing pages. The math is simple: our plan is 5-10x cheaper for a homeowner designing one house.

---

## 4. Priority Roadmap (Corrected)

Shareable URLs and 2D top-down view are already shipped. AI viz is parked until fundamentals are solid. Saved projects is the critical missing retention piece the original analysis overlooked.

| Priority | Feature | Effort | Impact | Why This Order |
|----------|---------|--------|--------|----------------|
| P0 | Revenue specs (Homeowner plan, upload flow, upgrade copy, pro banner) | Low | High | Pricing/copy changes, near-zero effort, ship fast |
| P1 | **Furniture library (10-15 items)** | Medium | Very High | Transforms "3D walls" into "3D home." The single biggest gap. A user who places a sofa is 3x more likely to pay $29 than one walking through empty walls. |
| P2 | **Saved projects** | Medium | Very High | Without it, every session is throwaway. A user who places furniture + uploads a floor plan will want to come back. If they can't save, they won't. #1 missing retention feature. |
| P3 | SEO landing pages (3-5 pages) | Medium | High | Only after the product experience converts. Furniture + saved projects make landing page traffic stick. |
| P4 | AI visualization (1-2 styles) | Medium | High | Only after furniture + saved projects + proven $29 conversion. Gate behind Pro plan. |
| P5 | Persistent dimension labels | Medium | Medium-High | Professional polish for contractor-sharing workflow |
| P6 | Outline/wireframe view mode | Low | Medium | Clean floor plan aesthetic, low effort |
| P7 | Lighting presets (time-of-day) | Low | Medium | Easy visual upgrade |
| P8 | Elevation views (front/side/back) | Low | Medium | Camera-angle changes, incremental value |

---

## 5. What NOT to Copy

- **Complex parametric editing UI** - Arcadium's interface is designer-focused with lots of parameters. Ours should stay simple. Homeowners don't want 15 sliders.
- **Collaborative multi-editor** - Nice for design teams, irrelevant for our target user (individual homeowner).
- **Color palette generator** - Clever SEO play but tangential to our core value. Not worth the effort.
- **Per-light brightness controls** - Too complex for homeowners. Stick with presets.
- **Custom model imports** - Pro feature for designers, not homeowners. Maybe later.

---

## Key Takeaway

Arcadium is building for **designers and architects** who want a lightweight alternative to SketchUp. Sitea is building for **homeowners** who want to see their house before building it. These are different users with different needs.

The main risk is doing too many things at once. **Furniture library is the one feature that changes the product category.** Everything else is optimization. A user who walks through a bedroom with a bed and a nightstand feels something. A user who walks through an empty box does not. That emotional gap is the entire conversion funnel.

Build order: revenue specs (fast, near-free) -> furniture (product transformation) -> saved projects (retention) -> SEO (growth) -> AI viz (wow factor). Everything we add should pass one filter: **"Does a homeowner designing their first house need this?"** If no, skip it.

---

*Based on hands-on exploration of Arcadium 3D - February 2026 | Updated with strategic corrections*
