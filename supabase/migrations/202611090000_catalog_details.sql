-- Apply before deploying the catalog reader that selects currency and details.
begin;
alter table public.arenalindex_properties add column if not exists currency text not null default 'USD' check (currency in ('USD','CRC'));
alter table public.arenalindex_properties add column if not exists details jsonb;
commit;
