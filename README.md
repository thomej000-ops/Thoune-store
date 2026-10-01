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


## v1021
- Restaurados emojis nos ícones; removidos traços/pontos desenhados por pseudo-elementos CSS.
- Tratamento de erros no carregamento e login do painel ADM, com mensagem clara em vez de tela presa carregando.
- O acesso ADM continua exigindo autenticação e cargo de administrador configurado no Supabase.


## v1024 — correção do ADM e alinhamento dos ícones
- O acesso administrativo agora tem limite de tempo nas verificações de sessão, RPC e perfil; falhas mostram uma mensagem em vez de deixar a tela carregando indefinidamente.
- Ícones ajustados para centralizar os glifos e emojis e remover posicionamento absoluto que os deslocava.
- Se a conta não estiver marcada como admin no banco, o painel informa isso claramente; não contorna a autorização.

## v1025 — ajustes solicitados nas imagens e ícones
- Resumo de dados da conta usa marcas TikTok e Roblox estilizadas, sem depender dos emojis do sistema.
- Ícone do carrinho usa o emoji 🛒 diretamente, sem sobreposição de pseudo-ícones.
- Ordenação recebe um ícone de caixa alinhado e com fundo integrado ao botão.
- Estado vazio do catálogo usa um símbolo de redefinir simples e o botão Limpar filtros fica alinhado.
- Cadastro/edição de marretas permite selecionar foto do aparelho; a imagem é reduzida para até 900 px e otimizada em WebP automaticamente. A URL manual continua disponível.
