# Thoune Store v1029

Versão baseada na v1028, com correções no fluxo de entrega:
- Botão para copiar apenas o nome do bot de entrega.
- Botão “Entendi, aguardar entrega” fecha o painel e mantém o acompanhamento do pedido.
- Pedidos entregues permanecem disponíveis para o cliente, em vez de serem apagados do acompanhamento.
- Ao detectar a mudança para “Entregue”, o cliente vê a confirmação de conclusão e é direcionado ao painel de avaliação.

Mantenha os scripts SQL das versões anteriores já aplicados no Supabase. Esta versão não exige uma nova alteração SQL.


v1032: padroniza somente os ícones dos botões da barra superior com CSS, sem emojis/SVG nesses três controles, para aparência consistente em iPhone, Android e desktop.


## v1036 — avaliações
1. Antes de publicar, execute `supabase_v1036_reviews_customer_and_moderation.sql` no SQL Editor do Supabase.
2. Publique os arquivos deste ZIP mantendo a estrutura de pastas.
3. Teste com uma conta cliente e um pedido entregue. O envio fica pendente até aprovação administrativa. A rejeição exige motivo e tenta notificar o cliente.


## Atualização v1037 — avaliações
- Inclui `supabase_v1037_reviews_and_helpful_fix.sql`, migração conjunta para votos úteis e envio/moderação de avaliações.
- Execute esse SQL no Supabase SQL Editor antes de publicar os arquivos.
- O ZIP não altera o banco automaticamente; a migração precisa ser executada no projeto Supabase correto.


v1041: checkout sem login/e-mail, nome do Pix mantido, posição estimada da fila atualizada a cada 5s, posição real após criação do pedido, logo Roblox no campo, avaliações públicas mantidas com @ do TikTok e voto útil sem conta. Execute supabase_v1041_no_login_queue.sql no Supabase antes de publicar.

Thoune Store v1041 — SEM LOGIN PARA CLIENTES

Mudanças principais:
- Cliente não cria conta e não informa e-mail.
- Checkout exige TikTok, Roblox e nome do remetente do Pix.
- Nome do Pix continua salvo no pedido e no pagamento.
- Posição estimada da fila aparece antes da confirmação e atualiza a cada 5 segundos.
- Após criar o pedido, posição atual é exibida.
- Logo do Roblox aparece corretamente no campo.
- Erros do Supabase relacionados à função ausente são apresentados de forma amigável.
- Avaliações continuam públicas; identificação exibida é somente o @ do TikTok.
- Voto "Achou útil" continua funcionando sem conta, por token anônimo do navegador.
- Painel administrativo continua protegido por login.

IMPORTANTE:
Execute supabase_v1041_no_login_queue.sql no SQL Editor do Supabase antes de publicar a versão.
