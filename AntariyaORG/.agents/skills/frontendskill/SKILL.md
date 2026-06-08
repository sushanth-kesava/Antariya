---
name: frontendskill
description: >
  Frontend guidance for this Antariya/Next.js storefront and portal app.
  Use this skill for UI work in the frontend app, including marketplace, auth,
  portals, Tailwind styling, component structure, and frontend debugging.
---

# Frontend Skill for Antariya

Use this skill when working on the frontend app in this repository.

## Project Context

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS with shadcn/ui components
- Frontend app root: `frontend/`
- Backend API: Express in `backend/`
- Primary UI areas: public pages, marketplace, customize flow, customer portal, admin portal, superadmin portal

## What To Prefer

- Build UI around the actual portal role instead of a one-size-fits-all layout.
- Keep shared behavior in reusable components and route-specific behavior in route-local components.
- Fetch backend-driven data for categories, products, and portal-specific views instead of hardcoding duplicated arrays.
- Preserve accessibility, semantic HTML, and keyboard-friendly interactions.
- Keep visual design intentional, polished, and consistent with the existing brand language.

## Repo-Specific Rules

- Use the backend marketplace layout endpoint for role-aware category data.
- Keep admin product creation categories aligned with the marketplace source of truth.
- Use portal layouts to provide variant-specific footers.
- Avoid introducing duplicate footer or navigation implementations inside individual portal pages.
- Respect the current app structure under `frontend/src/app/` and `frontend/src/components/`.

## Common Commands

- Start frontend development server: `npm --prefix frontend run dev`
- Run frontend build: `npm --prefix frontend run build`
- Run frontend lint: `npm --prefix frontend run lint`
- Run frontend typecheck: `npm --prefix frontend run typecheck`
- Start backend development server: `npm --prefix backend run dev`

## Working Pattern

1. Identify the page, route, or component that owns the behavior.
2. Check whether the data should come from the backend or can stay local.
3. Update shared API types before wiring new UI around them.
4. Keep portal-specific presentation in portal layouts or portal-local components.
5. Validate with the narrowest useful command before broad testing.

## Next.js Guidance

- Prefer server components where data does not need client state.
- Use client components only for interactivity, browser APIs, or authenticated session state.
- Keep route wrappers thin and move complex UI into named components.
- When a route depends on a role or auth state, wait for resolution before fetching role-specific data.

## Tailwind Guidance

- Use utility classes directly for layout and spacing.
- Prefer shared design tokens and component variants over one-off style drift.
- Keep responsive behavior explicit for mobile and desktop.
- Avoid visual clutter when a simpler composition already communicates the hierarchy.

## Portal UI Guidance

- Customer portal: prioritize browsing, orders, and personalization.
- Admin portal: prioritize operations, moderation, and product management.
- Superadmin portal: prioritize oversight, grouped summaries, and control surfaces.
- Public pages: keep marketing and shopping flows lightweight and focused.

## Validation Checklist

- The changed page renders without runtime errors.
- API calls resolve against the expected backend route.
- Categories and portal-specific data match the active role.
- Lint and typecheck stay clean for the touched area.
- The UI works on mobile and desktop widths.

## When To Escalate

- Ask before changing backend contracts that affect multiple portals.
- Ask before restructuring route groups or shared layouts.
- Ask before adding a new dependency if the existing stack already covers the need.
