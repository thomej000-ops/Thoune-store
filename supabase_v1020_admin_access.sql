-- Thoune Store v1020 — acesso administrativo seguro
-- 1) Cria uma função que verifica o cargo do usuário autenticado sem depender
--    da leitura direta da tabela profiles pelo navegador.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all
on function public.is_admin()
from public;

grant execute
on function public.is_admin()
to authenticated;

-- 2) Se sua conta ainda não estiver como admin, execute o bloco abaixo
--    trocando SEU_EMAIL pelo e-mail usado no Supabase Auth.
--
-- update public.profiles p
-- set role = 'admin'
-- from auth.users u
-- where p.id = u.id
--   and lower(u.email) = lower('SEU_EMAIL');
