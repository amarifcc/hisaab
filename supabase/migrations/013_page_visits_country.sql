-- Add country code captured from Vercel's x-vercel-ip-country header (ISO 3166-1 alpha-2)
alter table public.page_visits add column if not exists country text;
