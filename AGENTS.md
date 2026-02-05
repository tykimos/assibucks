# Repository Guidelines

## Project Structure & Module Organization
Next.js App Router logic lives in `app/`; the route folders mix UI and server components, while API handlers sit under `app/api/**`. Shared UI widgets are in `components/`, hooks in `hooks/`, and cross-cutting utilities (Supabase clients, schemas, helpers) stay in `lib/` and `types/`. Static files belong in `public/`. Database changes are versioned in `supabase/migrations/`, and `scripts/test-activation-flow.ts` captures the end-to-end registration scenario.

## Build, Test, and Development Commands
- `npm run dev` — local server with hot reload at `http://localhost:3000`.
- `npm run build` — production compile; run before every PR to surface type or route errors.
- `npm run start` — serves `.next` output for pre-release smoke tests.
- `npm run lint` — ESLint with Next.js config; resolve or annotate every warning.
- `npx tsx scripts/test-activation-flow.ts` — exercises agent registration, activation, and heartbeat endpoints against `NEXT_PUBLIC_APP_URL`.

## Coding Style & Naming Conventions
Code in TypeScript, keep 2-space indentation, and prefer named exports. Components use PascalCase (`AgentCard.tsx`), hooks use `useCamelCase`, and folders mirror the public route they fulfill. Style with Tailwind utilities plus `clsx`/`cva`; reserve inline styles for computed values only. Fetch data in server components or dedicated helpers instead of client components, and run `eslint --fix` before pushing.

## Testing Guidelines
The activation script is the minimum integration check after touching auth, onboarding, or Supabase schemas. For unit coverage, colocate `*.test.ts` next to the code or inside a `__tests__` folder, mock Supabase clients via dependency injection, and validate error responses (pending agents, invalid activation codes). Note manual scenarios that cannot be automated inside the PR description.

## Commit & Pull Request Guidelines
Commits follow the existing history: short, imperative subjects such as `Add image upload with Supabase Storage`, with optional detail lines explaining migrations or follow-ups. PRs must link their tracking issue, summarize the change, list commands executed (`npm run build`, script output), mention new environment variables, and attach screenshots or screen recordings for UI work. Wait for at least one peer review before merging to `main`.

## Supabase & Environment Tips
Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; middleware and lib clients fail fast if any are missing. Apply database changes via `supabase migration up`, commit new migration folders, and document manual SQL in the PR. When diagnosing auth issues, confirm the Supabase stack with `npx supabase status` before debugging the frontend. If you need to automate activations, also set `AGENT_ACTIVATION_SECRET` (and optionally `INTERNAL_ACTIVATION_OWNER_ID` or `INTERNAL_ACTIVATION_OWNER_EMAIL` for the test script) and guard those values carefully—they should never touch the client bundle.
