-- Thoune Store — proteção específica da tabela public.products
-- IMPORTANTE: execute primeiro a seção "AUDITORIA PRÉVIA" no arquivo de documentação.
-- Este script altera SOMENTE permissões/políticas de public.products.
-- Pré-requisitos confirmados no código do ZIP: tabela public.products e função public.is_admin().
-- Não altera pedidos, pagamentos, Pix, avaliações nem funções de checkout.

begin;

do $precheck$
begin
  if to_regclass('public.products') is null then
    raise exception 'Tabela public.products não encontrada. Nenhuma alteração aplicada.';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'Função public.is_admin() não encontrada. Aplique/revise a configuração administrativa antes deste SQL.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='active'
  ) then
    raise exception 'Coluna public.products.active não encontrada. Nenhuma alteração aplicada.';
  end if;
end
$precheck$;

-- RLS fica habilitada. A política de leitura pública só expõe produtos ativos.
alter table public.products enable row level security;

-- Remove apenas políticas desta tabela, para impedir que uma política permissiva antiga
-- continue autorizando escrita anônima. Nenhuma tabela ou dado é apagado.
do $drop_product_policies$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='products'
  loop
    execute format('drop policy %I on public.products', p.policyname);
  end loop;
end
$drop_product_policies$;

-- Evita privilégios de tabela herdados por PUBLIC/anon. RLS continua sendo a barreira de linha.
revoke all privileges on table public.products from public;
revoke all privileges on table public.products from anon;
revoke all privileges on table public.products from authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

create policy "Public can view active products"
on public.products
for select
to anon, authenticated
using (active = true or (select public.is_admin()));

create policy "Admins can insert products"
on public.products
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update products"
on public.products
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete products"
on public.products
for delete
to authenticated
using ((select public.is_admin()));

commit;

-- Verificação pós-execução: produtos com RLS ativa e políticas instaladas.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='products';

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public' and tablename='products'
order by cmd, policyname;

-- Verifique separadamente o papel de administrador. Deve retornar apenas a conta administradora esperada.
select id, role
from public.profiles
where role = 'admin';
