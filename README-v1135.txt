Thoune Store v1135

Correção desta versão:
- mantém o envio do comprovante Pix;
- corrige o cancelamento de pedidos awaiting_payment/payment_rejected;
- fecha o painel depois do cancelamento confirmado;
- mostra a mensagem real do Supabase quando o cancelamento é recusado;
- SQL definitivo: supabase_v1135_cancel_guest_order.sql

IMPORTANTE: executar o SQL v1135 uma vez no Supabase antes de testar o botão de cancelar.
