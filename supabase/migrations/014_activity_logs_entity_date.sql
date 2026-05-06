-- Store the entity's own date on CREATE/UPDATE logs so the logs page
-- can flag backdated entries (entity_date more than 48h before performed_at).
alter table public.activity_logs add column if not exists entity_date date;
