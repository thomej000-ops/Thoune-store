# Thoune Store v1040 — checkout sem login

Esta versão remove a conta do cliente do site público.

## O cliente agora faz apenas
1. Escolhe as marretas.
2. Usa o carrinho.
3. No checkout informa somente usuário do TikTok e usuário do Roblox.
4. Cria o pedido.
5. Faz o Pix.
6. Clica em “Já fiz o Pix” para avisar a loja.
7. Aguarda a entrega manual.

Não existe mais no site público: login, criar conta, senha, e-mail, Minha conta, Meus pedidos ou acompanhamento por conta.

## Importante
O login do `admin.html` continua existindo para proteger o painel administrativo.

Antes de publicar, execute `supabase_v1040_no_login_checkout.sql` no SQL Editor do Supabase. Ele cria as RPCs públicas necessárias para pedidos sem autenticação e votos de avaliações sem login.

O pedido público guarda TikTok e Roblox em `orders`. O `customer_id` fica nulo.


### Nome do remetente do Pix
O checkout público exige TikTok, Roblox e o nome do remetente do Pix. O nome é salvo no pedido/pagamento para conferência manual.
