Thoune Store v1137 — correção do cancelamento Pix

CORREÇÃO:
- O botão de cancelar funciona nos dois painéis de pagamento.
- A função não altera mais payments.status para "cancelled", pois a constraint payments_status_check do banco não aceita esse valor.
- O cancelamento altera somente orders.status para "cancelled".
- Depois de cancelar, o painel é fechado e o pedido sai da fila.

SUPABASE:
Execute UMA VEZ:
supabase_v1137_cancel_guest_order.sql

Não execute os SQL antigos de cancelamento.
