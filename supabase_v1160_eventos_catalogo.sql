-- Thoune Store v1160: suporte a eventos no catálogo e desconto global por evento.
-- Faça backup antes de executar no SQL Editor do Supabase.
alter table public.products add column if not exists event_name text;
alter table public.store_settings add column if not exists discount_event text;

-- Valores aceitos: anniversary, autumn, christmas, clover, easter, halloween, lunar, spring, summer, valentines.
-- Produtos sem evento ficam com event_name NULL.
