<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Route implementation notes

The visible `/home` page is implemented by `app/(app)/home/page.tsx`.
Its tabbed UI lives in `app/(app)/home/HomeView.tsx`.

When a request mentions the home page, overview page, expense tab, transfer tab,
or deals tab, make UI changes in `HomeView.tsx` unless the request is about
server-side data loading, auth, or Supabase queries in `home/page.tsx`.

The routes `/reports`, `/expenses`, `/transfers`, `/deals`, `/records`, and
`/transactions` currently redirect to `/home`.
