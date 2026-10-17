-- Thoune Store v1137 — CANCELAMENTO DEFINITIVO DO PEDIDO PIX
-- Execute este SQL UMA VEZ no Supabase SQL Editor.
-- IMPORTANTE: o cancelamento altera SOMENTE o status do pedido.
-- Não altera payments.status, porque a constraint existente do projeto
-- não aceita o valor "cancelled" nessa coluna.

create or replace function public.cancel_guest_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_proof_path text;
begin
  if p_order_id is null then
    return jsonb_build_object('success', false, 'message', 'Pedido não informado.');
  end if;

  select o.status, p.payment_proof_path
    into v_status, v_proof_path
  from public.orders o
  left join public.payments p on p.order_id = o.id
  where o.id = p_order_id
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  if v_status in ('cancelled', 'canceled') then
    return jsonb_build_object('success', true, 'status', 'cancelled', 'already_cancelled', true);
  end if;

  if nullif(trim(coalesce(v_proof_path, '')), '') is not null then
    return jsonb_build_object(
      'success', false,
      'status', v_status,
      'message', 'Este pedido já possui comprovante enviado. Não é possível cancelar depois do envio do comprovante.'
    );
  end if;

  if v_status not in ('awaiting_payment', 'payment_rejected') then
    return jsonb_build_object(
      'success', false,
      'status', v_status,
      'message', 'Este pedido já saiu da etapa de pagamento e não pode ser cancelado por aqui.'
    );
  end if;

  update public.orders
     set status = 'cancelled',
         updated_at = now()
   where id = p_order_id
     and status in ('awaiting_payment', 'payment_rejected');

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_guest_order(uuid) from public;
grant execute on function public.cancel_guest_order(uuid) to anon, authenticated;
