-- Thoune Store v1044
-- Avaliação persistente para compras sem conta/e-mail.
-- Execute uma vez no Supabase SQL Editor.

alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.reviews add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.reviews add column if not exists customer_id uuid;
create index if not exists reviews_order_id_idx on public.reviews(order_id);

drop function if exists public.get_guest_order_status(uuid);
create or replace function public.get_guest_order_status(p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'found',true,
  'id',o.id,
  'status',o.status,
  'rejection_reason',o.rejection_reason,
  'tiktok_username',o.tiktok_username,
  'delivered_at',o.delivered_at,
  'queue_position',case when o.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery') then (
    select count(*)+1 from public.orders prior
    where prior.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery')
      and (prior.created_at<o.created_at or (prior.created_at=o.created_at and prior.id<o.id))
  ) else 0 end
)
from public.orders o where o.id=p_order_id;
$$;
revoke all on function public.get_guest_order_status(uuid) from public;
grant execute on function public.get_guest_order_status(uuid) to anon,authenticated;

drop function if exists public.get_guest_review_status(uuid);
create or replace function public.get_guest_review_status(p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('has_review',exists(select 1 from public.reviews r where r.order_id=p_order_id));
$$;
revoke all on function public.get_guest_review_status(uuid) from public;
grant execute on function public.get_guest_review_status(uuid) to anon,authenticated;

drop function if exists public.submit_guest_review(uuid,text,integer,text);
create or replace function public.submit_guest_review(p_order_id uuid,p_tiktok_username text,p_rating integer,p_text text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_tiktok text:=trim(coalesce(p_tiktok_username,''));
begin
  if p_order_id is null then raise exception 'Pedido não informado.'; end if;
  if p_rating is null or p_rating<1 or p_rating>5 then raise exception 'A nota deve estar entre 1 e 5.'; end if;
  if p_text is null or length(trim(p_text))<3 then raise exception 'Escreva pelo menos 3 caracteres.'; end if;
  if v_tiktok='' then raise exception 'Usuário do TikTok não informado.'; end if;
  select * into v_order from public.orders where id=p_order_id and status='delivered';
  if not found then raise exception 'Só é possível avaliar pedidos entregues.'; end if;
  if lower(regexp_replace(coalesce(v_order.tiktok_username,''),'^@',''))<>lower(regexp_replace(v_tiktok,'^@','')) then raise exception 'O usuário do TikTok não corresponde ao pedido.'; end if;
  if exists(select 1 from public.reviews where order_id=p_order_id) then raise exception 'Este pedido já possui uma avaliação.'; end if;
  insert into public.reviews(customer_id,order_id,tiktok_username,rating,text,status) values(null,p_order_id,v_tiktok,p_rating,trim(p_text),'pending');
  return jsonb_build_object('success',true,'status','pending');
end;
$$;
revoke all on function public.submit_guest_review(uuid,text,integer,text) from public;
grant execute on function public.submit_guest_review(uuid,text,integer,text) to anon,authenticated;
