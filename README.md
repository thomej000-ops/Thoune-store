# Thoune Store v1019

Versão de correção e refinamento geral.

Principais focos:
- fluxo de pagamento/verificação mais claro;
- painéis de pedido e entrega maiores e mais legíveis;
- favoritos e imagens sem fundo branco;
- modo claro/escuro e menu corrigidos;
- notificações e FAQ com melhor contraste;
- catálogo com sombra/animação suave nas marretas;
- painel administrativo com contraste corrigido;
- descontos individuais por produto preservados;
- link do perfil do bot de entrega disponível nas configurações ADM.

Antes de publicar, mantenha as alterações SQL da v1016 e v1018 aplicadas no Supabase.


## v1020
- Tema claro removido: a loja usa somente o modo escuro.
- Header com nome da loja mais destacado e ícones monocromáticos estáveis.
- Busca/lupa e seletor de ordenação reorganizados.
- Cards de produto com cantos arredondados completos.
- Quantidade do carrinho com contraste corrigido.
- Checkout reorganizado em blocos, com formulário de entrega espaçado e QR Code redimensionado.
- Painel ADM recebeu entrada por e-mail/senha e verificação segura de cargo.
- Aplicar `supabase_v1020_admin_access.sql` no Supabase SQL Editor antes de usar o novo acesso ADM.
