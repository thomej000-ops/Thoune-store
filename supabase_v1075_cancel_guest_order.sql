-- Thoune Store v1075 — cancelamento explícito de pedidos Pix não pagos
-- Execute uma vez no SQL Editor do Supabase antes de publicar esta versão.
-- Só cancela pedidos que ainda estejam em awaiting_payment; pedidos já enviados
-- para verificação ou com pagamento confirmado não podem ser cancelados pelo cliente.

create or replace function public.cancel_guest_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if p_order_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('success', true, 'status', 'cancelled');
  end if;

  if v_status <> 'awaiting_payment' then
    return jsonb_build_object(
      'success', false,
      'status', v_status,
      'message', 'Este pedido já saiu da etapa de pagamento e não pode ser cancelado por aqui.'
    );
  end if;

  update public.orders
  set status = 'cancelled', updated_at = now()
  where id = p_order_id and status = 'awaiting_payment';

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_guest_order(uuid) from public;
grant execute on function public.cancel_guest_order(uuid) to anon, authenticated;
