-- THOUNE STORE v1079 — TEMAS, PRESETS E UPLOAD DE BANNER
-- Execute este script inteiro no Supabase > SQL Editor > New query > Run.
-- A leitura do tema publicado é pública; alterações exigem public.is_admin().

create table if not exists public.store_theme_settings (
  id boolean primary key default true check (id = true),
  theme_name text not null default 'Padrão azul-petróleo',
  primary_color text not null default '#17677a' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  palette jsonb not null default '{"primary":"#17677a","deep":"#082c3a","deep2":"#0d4051","accent":"#2b8295","mist":"#eaf5f7","mist2":"#f3fafb","line":"#d6e8ec","bg":"#edf7f9","bg2":"#e3f2f5"}'::jsonb,
  effect_emoji text not null default '',
  banner_image_url text not null default '',
  banner_effect text not null default 'none' check (banner_effect in ('none','glow')),
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.store_theme_settings enable row level security;
drop policy if exists "Public can read published store theme" on public.store_theme_settings;
create policy "Public can read published store theme" on public.store_theme_settings for select to anon, authenticated using (is_published = true);
drop policy if exists "Admins can read all store theme settings" on public.store_theme_settings;
create policy "Admins can read all store theme settings" on public.store_theme_settings for select to authenticated using (public.is_admin());
drop policy if exists "Authenticated can manage store theme" on public.store_theme_settings;
drop policy if exists "Admins can insert store theme settings" on public.store_theme_settings;
create policy "Admins can insert store theme settings" on public.store_theme_settings for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update store theme settings" on public.store_theme_settings;
create policy "Admins can update store theme settings" on public.store_theme_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.store_theme_settings (id, theme_name, primary_color, palette, is_published)
values (true, 'Padrão azul-petróleo', '#17677a', '{"primary":"#17677a","deep":"#082c3a","deep2":"#0d4051","accent":"#2b8295","mist":"#eaf5f7","mist2":"#f3fafb","line":"#d6e8ec","bg":"#edf7f9","bg2":"#e3f2f5"}'::jsonb, false)
on conflict (id) do nothing;

create table if not exists public.store_theme_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  palette jsonb not null,
  effect_emoji text not null default '',
  banner_image_url text not null default '',
  banner_effect text not null default 'none' check (banner_effect in ('none','glow')),
  updated_at timestamptz not null default now()
);
alter table public.store_theme_presets enable row level security;
drop policy if exists "Admins can manage store theme presets" on public.store_theme_presets;
create policy "Admins can manage store theme presets" on public.store_theme_presets for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-assets', 'store-assets', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view store theme assets" on storage.objects;
create policy "Public can view store theme assets" on storage.objects for select to anon, authenticated using (bucket_id = 'store-assets');
drop policy if exists "Admins can upload store theme assets" on storage.objects;
create policy "Admins can upload store theme assets" on storage.objects for insert to authenticated with check (bucket_id = 'store-assets' and public.is_admin());
drop policy if exists "Admins can update store theme assets" on storage.objects;
create policy "Admins can update store theme assets" on storage.objects for update to authenticated using (bucket_id = 'store-assets' and public.is_admin()) with check (bucket_id = 'store-assets' and public.is_admin());
drop policy if exists "Admins can delete store theme assets" on storage.objects;
create policy "Admins can delete store theme assets" on storage.objects for delete to authenticated using (bucket_id = 'store-assets' and public.is_admin());
