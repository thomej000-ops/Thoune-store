-- Thoune Store v1028 — permite que visitantes e clientes vejam marretas ativas.
-- Execute no Supabase > SQL Editor > New query > Run.
-- Esta política é somente de leitura pública; não permite cadastrar, editar ou excluir produtos.

grant select on table public.products to anon, authenticated;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
on public.products
for select
to anon, authenticated
using (active = true);
