-- Thoune Store v1042
-- Fluxo de checkout público sem conta/e-mail + fila dinâmica + acompanhamento por pedido
-- Execute uma vez no Supabase SQL Editor.

create or replace function public.get_guest_order_status(
  p_order_id uuid
)
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
    'queue_position', case
      when o.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery') then (
        select count(*) + 1
        from public.orders prior
        where prior.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery')
          and (prior.created_at < o.created_at or (prior.created_at = o.created_at and prior.id < o.id))
      )
      else 0
    end
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke all on function public.get_guest_order_status(uuid) from public;
grant execute on function public.get_guest_order_status(uuid) to anon, authenticated;

-- Garante que a função de fila continue disponível para o checkout público.
revoke all on function public.get_guest_queue_preview() from public;
grant execute on function public.get_guest_queue_preview() to anon, authenticated;

revoke all on function public.get_guest_order_queue_position(uuid) from public;
grant execute on function public.get_guest_order_queue_position(uuid) to anon, authenticated;

-- A exclusão de avaliações é feita pelo administrador autenticado no painel.
-- Não abrimos DELETE para anon/authenticated comum.
