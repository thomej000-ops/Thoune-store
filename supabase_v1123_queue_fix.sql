-- Thoune Store v1123 — fila corrigida de verdade
--
-- Regra: todo pedido que ainda está ativo no fluxo de atendimento ocupa uma
-- posição da fila. Pedidos cancelados, rejeitados e entregues não ocupam.
-- Assim, se existir somente o pedido atual, a posição será #1.
--
-- Execute este arquivo UMA vez no SQL Editor do Supabase.

-- Estes são os únicos status que ocupam a fila.
-- awaiting_payment / awaiting_verification = pedido atual ainda no fluxo Pix
-- payment_confirmed / awaiting_delivery = pagamento confirmado, aguardando entrega

-- Posição estimada antes de criar o pedido.
drop function if exists public.get_guest_queue_preview();
create or replace function public.get_guest_queue_preview()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (count(*) + 1)::integer
    from public.orders
   where status in (
     'awaiting_payment',
     'awaiting_verification',
     'payment_confirmed',
     'awaiting_delivery'
   );
$$;

revoke all on function public.get_guest_queue_preview() from public;
grant execute on function public.get_guest_queue_preview() to anon, authenticated;

-- Posição real de um pedido que já entrou no fluxo da fila.
drop function if exists public.get_guest_order_queue_position(uuid);
create or replace function public.get_guest_order_queue_position(p_order_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.orders where id = p_order_id
    ) then 0
    when not exists (
      select 1
        from public.orders
       where id = p_order_id
         and status in (
           'awaiting_payment',
           'awaiting_verification',
           'payment_confirmed',
           'awaiting_delivery'
         )
    ) then 0
    else (
      select (count(*) + 1)::integer
        from public.orders o
        join public.orders target on target.id = p_order_id
       where o.status in (
         'awaiting_payment',
         'awaiting_verification',
         'payment_confirmed',
         'awaiting_delivery'
       )
         and (
           o.created_at < target.created_at
           or (o.created_at = target.created_at and o.id < target.id)
         )
    )
  end;
$$;

revoke all on function public.get_guest_order_queue_position(uuid) from public;
grant execute on function public.get_guest_order_queue_position(uuid) to anon, authenticated;

-- Status público + posição da fila.
drop function if exists public.get_guest_order_status(uuid);
create or replace function public.get_guest_order_status(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'found', true,
    'id', o.id,
    'status', o.status,
    'tiktok_username', o.tiktok_username,
    'delivery_username', o.delivery_username,
    'rejection_reason', o.rejection_reason,
    'queue_position', case
      when o.status in (
        'awaiting_payment',
        'awaiting_verification',
        'payment_confirmed',
        'awaiting_delivery'
      ) then (
        select count(*) + 1
          from public.orders prior
         where prior.status in (
           'awaiting_payment',
           'awaiting_verification',
           'payment_confirmed',
           'awaiting_delivery'
         )
           and (
             prior.created_at < o.created_at
             or (prior.created_at = o.created_at and prior.id < o.id)
           )
      )
      else 0
    end
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke all on function public.get_guest_order_status(uuid) from public;
grant execute on function public.get_guest_order_status(uuid) to anon, authenticated;

-- TESTE opcional depois de executar:
-- Deve mostrar somente os pedidos que realmente ocupam a fila.
-- select id, status, created_at
-- from public.orders
-- where status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery')
-- order by created_at asc;
