# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Sitea Upload Quota

Uploads require a signed-in Supabase user so usage can be enforced on the server. The browser displays quota state, but it is not the authority.

- Supabase table: `public.upload_usage`
- Server mutation: `public.consume_upload_credit(uuid, integer)`
- API route: `/api/upload-quota`
- Required server env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

Plan limits:

- Free signed-in user: `1` upload
- Monthly: `3` uploads per calendar month
- Homeowner: `20` uploads forever
- Lifetime: unlimited uploads

Monthly usage is tracked with a server-generated `monthly:YYYY-MM` period key. Homeowner, free, and lifetime usage use the `forever` period.

Floor-plan analyzer usage is consumed inside `/api/analyze-floor-plan`. Site-plan boundary analysis is consumed inside `/api/analyze-site-plan`. Local site-plan upload flows that do not call a paid analyzer consume through `/api/upload-quota`.
