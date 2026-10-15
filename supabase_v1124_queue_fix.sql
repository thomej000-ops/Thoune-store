-- Thoune Store v1124 — fila real + rolagem mobile corrigida
--
-- A fila de ENTREGA conta somente pedidos que já entraram no atendimento
-- após confirmação do pagamento: payment_confirmed e awaiting_delivery.
--
-- Pedidos awaiting_payment/awaiting_verification não ocupam uma posição
-- anterior na fila. O pedido atual, depois de criado, continua podendo
-- mostrar sua posição estimada como #1, #2, etc., calculada apenas sobre
-- pedidos anteriores que realmente estão na fila de entrega.
--
-- Execute este arquivo UMA vez no SQL Editor do Supabase.

-- Prévia antes da criação do pedido: fila de entrega + o pedido atual.
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
   where status in ('payment_confirmed', 'awaiting_delivery');
$$;

revoke all on function public.get_guest_queue_preview() from public;
grant execute on function public.get_guest_queue_preview() to anon, authenticated;

-- Posição real de um pedido já criado.
-- O próprio pedido precisa estar em um status ativo; a contagem anterior
-- considera somente pedidos já posicionados na fila de entrega.
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
       where o.status in ('payment_confirmed', 'awaiting_delivery')
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
         where prior.status in ('payment_confirmed', 'awaiting_delivery')
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

-- Teste opcional: se não houver pedidos confirmados/aguardando entrega,
-- esta consulta deve retornar zero linhas, e a prévia do próximo pedido será #1.
-- select id, status, created_at
-- from public.orders
-- where status in ('payment_confirmed','awaiting_delivery')
-- order by created_at asc;
