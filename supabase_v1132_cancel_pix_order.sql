-- Thoune Store v1132
-- Cancelamento correto do pedido Pix pendente.
-- O pedido sai da fila e deixa de aparecer como pedido/pagamento pendente no painel.
-- Não permite cancelar depois que um comprovante já foi enviado.

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
  limit 1
  for update of o;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado.');
  end if;

  if v_status = 'cancelled' then
    return jsonb_build_object('success', true, 'status', 'cancelled');
  end if;

  -- Depois que o cliente enviou comprovante, não apagamos/cancelamos o pedido
  -- por este fluxo, pois ele pode já ter realizado o Pix.
  if nullif(trim(coalesce(v_proof_path, '')), '') is not null then
    return jsonb_build_object(
      'success', false,
      'status', v_status,
      'message', 'Este pedido já possui comprovante enviado. Não cancele por aqui; aguarde a verificação do pagamento.'
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

  update public.payments
     set status = 'cancelled',
         updated_at = now()
   where order_id = p_order_id
     and status in ('pending', 'rejected');

  return jsonb_build_object('success', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_guest_order(uuid) from public;
grant execute on function public.cancel_guest_order(uuid) to anon, authenticated;
