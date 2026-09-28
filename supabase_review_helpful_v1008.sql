-- Thoune Store v1008
-- Sistema de "Achou útil" para avaliações.
-- Execute este arquivo no Supabase SQL Editor.

create table if not exists public.review_helpful_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint review_helpful_votes_unique unique (review_id, user_id)
);

alter table public.review_helpful_votes enable row level security;

-- Os clientes não precisam acessar os votos diretamente.
-- As funções abaixo retornam somente o necessário para a interface.
revoke all on table public.review_helpful_votes from anon, authenticated;

drop function if exists public.get_review_helpfulness(uuid[]);
create or replace function public.get_review_helpfulness(p_review_ids uuid[])
returns table (
  review_id uuid,
  helpful_count bigint,
  user_voted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.review_id,
    count(v.id)::bigint as helpful_count,
    coalesce(bool_or(v.user_id = auth.uid()), false) as user_voted
  from unnest(p_review_ids) as r(review_id)
  left join public.review_helpful_votes v
    on v.review_id = r.review_id
  group by r.review_id;
$$;

revoke all on function public.get_review_helpfulness(uuid[]) from public;
grant execute on function public.get_review_helpfulness(uuid[]) to anon, authenticated;

drop function if exists public.toggle_review_helpful(uuid);
create or replace function public.toggle_review_helpful(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exists boolean;
  v_count bigint;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if not exists (
    select 1 from public.reviews
    where id = p_review_id and status = 'approved'
  ) then
    raise exception 'Avaliação não encontrada';
  end if;

  select exists (
    select 1
    from public.review_helpful_votes
    where review_id = p_review_id and user_id = v_user_id
  ) into v_exists;

  if v_exists then
    delete from public.review_helpful_votes
    where review_id = p_review_id and user_id = v_user_id;
  else
    insert into public.review_helpful_votes (review_id, user_id)
    values (p_review_id, v_user_id);
  end if;

  select count(*) into v_count
  from public.review_helpful_votes
  where review_id = p_review_id;

  return jsonb_build_object(
    'success', true,
    'review_id', p_review_id,
    'helpful_count', v_count,
    'user_voted', not v_exists
  );
end;
$$;

revoke all on function public.toggle_review_helpful(uuid) from public;
grant execute on function public.toggle_review_helpful(uuid) to authenticated;
