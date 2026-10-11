-- THOUNE STORE v1078 — TABELA DE TEMAS
-- Cole este SQL no Supabase > SQL Editor > New query e clique em Run.
-- A leitura é pública para que todos os visitantes vejam o tema publicado.
-- A escrita exige sessão autenticada; o painel themes.html também valida a função/perfil admin.

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
drop policy if exists "Authenticated can manage store theme" on public.store_theme_settings;
create policy "Authenticated can manage store theme" on public.store_theme_settings for all to authenticated using (true) with check (true);

insert into public.store_theme_settings (id, theme_name, primary_color, palette, is_published)
values (true, 'Padrão azul-petróleo', '#17677a', '{"primary":"#17677a","deep":"#082c3a","deep2":"#0d4051","accent":"#2b8295","mist":"#eaf5f7","mist2":"#f3fafb","line":"#d6e8ec","bg":"#edf7f9","bg2":"#e3f2f5"}'::jsonb, false)
on conflict (id) do nothing;
