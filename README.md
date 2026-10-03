# Thoune Store v1029

Versão baseada na v1028, com correções no fluxo de entrega:
- Botão para copiar apenas o nome do bot de entrega.
- Botão “Entendi, aguardar entrega” fecha o painel e mantém o acompanhamento do pedido.
- Pedidos entregues permanecem disponíveis para o cliente, em vez de serem apagados do acompanhamento.
- Ao detectar a mudança para “Entregue”, o cliente vê a confirmação de conclusão e é direcionado ao painel de avaliação.

Mantenha os scripts SQL das versões anteriores já aplicados no Supabase. Esta versão não exige uma nova alteração SQL.


v1032: padroniza somente os ícones dos botões da barra superior com CSS, sem emojis/SVG nesses três controles, para aparência consistente em iPhone, Android e desktop.
