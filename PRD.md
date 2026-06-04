# Sitea Product Requirements

Document version: 3.0
Last updated: June 4, 2026
Status: Demo-ready, active hardening

## 1. Product Summary

Sitea helps land buyers and homeowners understand land, floor plans, and building ideas in an interactive 3D scene. The product should feel like an AI planning agent, not a blank CAD tool: users describe the outcome they want, upload a scanned plan when useful, and Sitea prepares the visual workspace for them.

Core promise: tell Sitea what you want to understand, then Sitea does the setup, shows the result in 3D, and asks for decisions only when human judgment is needed.

## 2. Target Users

- Land buyers deciding whether a parcel fits their life and budget
- Homeowners planning a new build, renovation, extension, or outdoor layout
- Families comparing plan options before talking to builders
- Agents/developers who need a simple visual demo for a buyer

Sitea can support professional users later, but the primary product language should stay simple enough for non-CAD users.

## 3. Product Principles

- Agent-delivered first: the user describes the outcome; Sitea prepares the land, comparisons, floor-plan preview, and next step.
- Visual proof over explanation: show the land, object, floor plan, and placement in 3D.
- Simple controls: manual measuring, drawing, and tool panels remain advanced fallback paths, not the primary journey.
- Decision checkpoints: Sitea should ask the user to confirm intent, placement, or quality only when automation should not guess.
- Trustworthy state: paid access, upload quota, saves, and shares must be backed by server/Supabase state.
- Mobile-polished demo path: the core flow must work on phone-sized screens, even if advanced editing remains better on desktop.

## 4. Current Demo Scope

The demo-ready path is:

1. User opens Sitea and sees the 3D world with Sitea Agent available.
2. User asks what they want to see or uploads a scanned site plan/floor plan.
3. Sitea Agent routes the upload:
   - Site plan: recognize it as land context, prepare the land workspace, and offer scale comparisons.
   - Floor plan: analyze walls, doors, windows, rooms, stairs, and scale, then prepare a 3D building preview.
4. Sitea adds or prepares the requested visual result and moves the user into the scene to review it.
5. User switches between 3D, 2D, and first-person walkthrough views.
6. User signs in to save and can create an expiring read-only share link.

## 5. Functional Requirements

### Land Visualization

- Define land through the agent, rectangle/templates, custom polygon, or uploaded site plan.
- Calculate area and dimensions in useful units.
- Show site boundaries clearly against the 3D environment and comparison objects.
- Support 3D orbit, 2D top-down, and first-person views.
- Keep manual tracing/editing available, but treat it as review and correction after Sitea prepares the workspace.

### Sitea Agent

- Open by default without hiding the world.
- Welcome the user with a practical "How can we help you?" prompt.
- Accept text, image, and scanned PDF uploads.
- Route site plans and floor plans differently.
- Explain what Sitea did, what is ready, and what decision remains.
- Offer one-tap actions that deliver visual results, such as adding a comparison or opening the prepared 3D preview.
- Avoid making the user hunt for panels, measure manually, or guess the next tool when Sitea can prepare the step.

### Floor-Plan Import

- Accept images and scanned PDFs.
- Detect walls, doors, windows, rooms, stairs, scale, and dimension labels where possible.
- Produce geometry that can be placed in the 3D scene.
- Move users into a clear 3D review/placement state after detection.
- Keep real-plan QA fixtures available for regression checks.

### Comparison Objects

- Help users understand land scale by placing recognizable objects.
- Sports objects such as tennis, basketball, and soccer should preserve realistic markings and remain visibly distinct from the site surface.
- Objects should be draggable, rotatable, and understandable from the minimap and 3D view.
- The agent should be able to add a relevant comparison directly from chat.

### Saving And Sharing

- Saving requires Supabase sign-in.
- Signed-in users can save projects to Supabase.
- Shared links are read-only.
- New shared links expire after 30 days.
- Expired or missing shared links should show a friendly unavailable state.

### Payments And Quota

- PayPal payment state must be verified on the server before access is granted.
- Supabase stores active subscriptions and upload usage.
- Upload usage is enforced server-side, not by localStorage.

Current plans:

| Plan | Price | Upload limit |
|---|---:|---|
| Free signed-in | `$0` | `1` upload forever |
| Monthly | `$9.99/month` | `3` uploads per calendar month |
| Homeowner | `$20` | `20` uploads forever |
| Lifetime | `$149` | unlimited uploads |

## 6. Technical Requirements

- Keep the app deployable as a Vite app on Vercel.
- Keep browser-exposed variables under `VITE_` and server secrets server-only.
- Use OpenAI as the default AI provider for chat, site-plan analysis, floor-plan analysis, and AI visualization.
- Keep Gemini and Roboflow as optional floor-plan fallbacks only while they improve reliability.
- Keep Supabase SQL migrations in `sql/`.
- Keep QA scripts for floor-plan detection and placement repeatable from `package.json`.
- Prefer focused, low-risk changes because `src/App.jsx` and `src/components/LandScene.jsx` remain large legacy hotspots.

## 7. Current Implementation Reality

Completed and active:

- Agent-first landing/workspace
- Upload routing for site plans vs floor plans
- OpenAI-first chat/site-plan/floor-plan APIs
- Scanned PDF support for plan uploads
- Floor-plan QA fixtures and real-plan review samples
- 3D placement checks for real analyzer output
- Server-verified PayPal one-time and subscription flows
- Supabase subscriptions, projects, shared scenes, and upload quota
- Save requires sign-in
- Public shared links expire after 30 days
- Mobile demo path polish for the main agent/upload/pricing flows

Not complete or still risky:

- Full lint baseline cleanup
- Continued visual QA for real scanned plans
- Further simplification of large App/LandScene surfaces
- More agent-delivered actions after upload/placement
- Better long-term editing UX after AI-generated geometry is placed
- More product-grade confirmation flows when automation needs human approval

## 8. Success Criteria

Demo success means a non-technical land buyer or homeowner can:

- Understand the purpose of Sitea within seconds.
- Ask Sitea Agent for help without searching through menus.
- Upload a plan and understand what Sitea detected.
- Let Sitea add at least one realistic comparison object to their land.
- Let Sitea prepare a generated building preview and guide them into 3D review/placement.
- Save only after signing in.
- Share a link that opens reliably at `/s/:id`.
- Use the core flow on a mobile viewport without layout breakage.

## 9. Non-Goals For Current Demo

- Full CAD replacement
- Building-code compliance guarantees
- Construction-ready drawings
- Perfect automatic detection on every scanned plan
- Stripe support
- Complex multi-user collaboration

## 10. References

- Current status: `APP_STATUS.md`
- Operator setup: `README.md`
- Running work log: `tasks/todo.md`
- Floor-plan QA: `tasks/floor-plan-qa-results.md`
- Supabase migrations: `sql/`
