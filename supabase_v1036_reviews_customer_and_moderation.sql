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
