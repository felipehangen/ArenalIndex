begin;

create table public.arenalindex_properties (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '',
  place text not null,
  price numeric not null check (price >= 0 and price < 1000000000),
  area numeric not null check (area > 0 and area < 1000000000),
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  house boolean not null default false,
  volcano boolean not null default false,
  river boolean not null default false,
  water boolean not null default false,
  electricity boolean not null default false,
  well boolean not null default false,
  private_residential boolean not null default false,
  approximate boolean not null default true,
  images text[] not null default '{}',
  is_demo boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.arenalindex_properties is 'Public property catalog for arenalindex.com. No private owner or contact data.';
alter table public.arenalindex_properties enable row level security;
revoke all on public.arenalindex_properties from anon, authenticated;
grant select on public.arenalindex_properties to anon, authenticated;
create policy arenalindex_read_published
  on public.arenalindex_properties for select to anon, authenticated
  using (status = 'published');
create index arenalindex_published_order on public.arenalindex_properties (sort_order, id) where status = 'published';

commit;
