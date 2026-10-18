-- THOUNE STORE — CONSULTAS DE AUDITORIA (somente leitura)
-- Execute no Supabase SQL Editor. Não modifica tabelas, políticas nem dados.

-- 1) RLS e políticas de todas as tabelas no schema public.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
order by tablename, cmd, policyname;

-- 2) Colunas e tipos das tabelas principais.
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('products','profiles','orders','order_items','payments','reviews','notifications','store_settings')
order by table_name, ordinal_position;

-- 3) Privilégios de tabela concedidos a PUBLIC, anon e authenticated.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('PUBLIC','anon','authenticated')
order by table_name, grantee, privilege_type;

-- 4) Funções SECURITY DEFINER e permissões EXECUTE (revisão de RPCs).
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer,
       p.provolatile as volatility,
       p.proconfig as function_settings,
       pg_get_userbyid(p.proowner) as owner,
       p.proacl as acl,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p')
order by p.proname, arguments;

-- 5) RLS de objetos de Storage (comprovantes).
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='storage' and tablename='objects'
order by policyname;

-- 6) Estado da tabela de produtos e administradores atualmente definidos.
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='products';

select id, role from public.profiles where role='admin';

-- 7) Extensões e funções de auth não são incluídas aqui; nunca copie credenciais,
-- tokens ou dados pessoais para uma conversa pública. Compartilhe apenas resultados
-- estruturais e anonimize IDs/e-mails antes de enviá-los.
