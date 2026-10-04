-- Thoune Store v1037 — correção conjunta de votos úteis e envio/moderação de avaliações
-- Execute este arquivo no Supabase SQL Editor antes de publicar o ZIP v1037.
-- Recria as RPCs esperadas pelo app.js e mantém um voto por cliente/avaliação.

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

-- Thoune Store v1036: correção segura do envio e moderação de avaliações
-- Execute no Supabase SQL Editor antes de publicar os arquivos v1036.

alter table public.reviews add column if not exists customer_id uuid references auth.users(id) on delete set null;
alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.reviews add column if not exists moderation_reason text;
alter table public.reviews add column if not exists moderated_at timestamptz;
alter table public.reviews add column if not exists moderated_by uuid references auth.users(id) on delete set null;

-- Recria a função com a identidade autenticada e o pedido entregue do próprio cliente.
drop function if exists public.submit_customer_review(integer, text);
drop function if exists public.submit_customer_review(integer, text, uuid);
create function public.submit_customer_review(p_rating integer, p_text text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text;
  v_order public.orders%rowtype;
begin
  if v_user_id is null then raise exception 'Você precisa entrar na sua conta para avaliar.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'A nota deve estar entre 1 e 5.'; end if;
  if p_text is null or length(trim(p_text)) < 3 then raise exception 'Escreva um comentário com pelo menos 3 caracteres.'; end if;
  if p_order_id is null then raise exception 'Pedido não informado. Abra novamente o pedido entregue.'; end if;

  select * into v_order from public.orders where id = p_order_id and customer_id = v_user_id;
  if not found then raise exception 'Este pedido não pertence à sua conta.'; end if;
  if v_order.status <> 'delivered' then raise exception 'Só é possível avaliar pedidos entregues.'; end if;
  if exists(select 1 from public.reviews where order_id = p_order_id and customer_id = v_user_id) then
    raise exception 'Este pedido já possui uma avaliação enviada.';
  end if;

  select tiktok_username into v_username from public.profiles where id = v_user_id;
  insert into public.reviews(customer_id, order_id, tiktok_username, rating, text, status)
  values(v_user_id, p_order_id, coalesce(v_username, 'Cliente'), p_rating, trim(p_text), 'pending');
  return jsonb_build_object('success', true, 'status', 'pending');
end;
$$;

revoke all on function public.submit_customer_review(integer, text, uuid) from public, anon;
grant execute on function public.submit_customer_review(integer, text, uuid) to authenticated;
