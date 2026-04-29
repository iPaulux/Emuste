-- ============================================================
-- EMUSTE – Supabase setup COMPLET
-- À exécuter dans : Supabase Dashboard → SQL Editor → New Query
-- Tout est inclus : tables + buckets + policies
-- ============================================================

-- 1. Tables --------------------------------------------------

create table if not exists roms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  file_name   text not null,
  file_path   text not null,
  file_size   bigint default 0,
  chunk_count integer not null default 1,   -- nb de chunks (upload morcelé)
  created_at  timestamptz default now()
);

-- Migration si la table existait déjà sans chunk_count
alter table roms add column if not exists chunk_count integer not null default 1;

create table if not exists save_states (
  id           uuid primary key default gen_random_uuid(),
  rom_id       uuid references roms(id) on delete cascade not null,
  slot         integer default 0,
  file_path    text not null,
  screenshot   text,
  updated_at   timestamptz default now(),
  unique(rom_id, slot)
);

-- RLS désactivé (app personnelle sans auth)
alter table roms        disable row level security;
alter table save_states disable row level security;

-- 2. Storage buckets ----------------------------------------
-- Crée les buckets directement via SQL (plus besoin du dashboard)

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('roms',  'roms',  true, 1073741824),  -- 1 Go max par ROM
  ('saves', 'saves', true, 20971520)    -- 20 Mo max par save
on conflict (id) do nothing;

-- 3. Policies storage (accès public total, app sans auth) ---

-- bucket "roms"
drop policy if exists "roms_select" on storage.objects;
drop policy if exists "roms_insert" on storage.objects;
drop policy if exists "roms_delete" on storage.objects;
drop policy if exists "roms_update" on storage.objects;

create policy "roms_select" on storage.objects
  for select using (bucket_id = 'roms');
create policy "roms_insert" on storage.objects
  for insert with check (bucket_id = 'roms');
create policy "roms_delete" on storage.objects
  for delete using (bucket_id = 'roms');
create policy "roms_update" on storage.objects
  for update using (bucket_id = 'roms');

-- bucket "saves"
drop policy if exists "saves_select" on storage.objects;
drop policy if exists "saves_insert" on storage.objects;
drop policy if exists "saves_delete" on storage.objects;
drop policy if exists "saves_update" on storage.objects;

create policy "saves_select" on storage.objects
  for select using (bucket_id = 'saves');
create policy "saves_insert" on storage.objects
  for insert with check (bucket_id = 'saves');
create policy "saves_delete" on storage.objects
  for delete using (bucket_id = 'saves');
create policy "saves_update" on storage.objects
  for update using (bucket_id = 'saves');
