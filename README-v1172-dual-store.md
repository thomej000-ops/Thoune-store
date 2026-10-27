
# Thoune Store v1172 — Dual Store (FTF + MM2)

Esta versão mantém a loja Flee the Facility e adiciona uma segunda loja Murder Mystery 2 no mesmo site.

## Como entrar
- URL raiz: mostra a abertura com escolha entre Flee the Facility e Murder Mystery 2.
- `?store=ftf`: loja Flee the Facility.
- `?store=mm2`: loja Murder Mystery 2.

## Banco de dados
Execute `supabase_v1172_dual_store.sql` no SQL Editor do Supabase.

A migração:
- adiciona `store_type` aos produtos e pedidos;
- marca o catálogo atual como `ftf`;
- cria configurações independentes de atendimento, Pix, bot e promoção para MM2;
- cria checkout público de 5 parâmetros com isolamento por loja;
- impede carrinho com produtos das duas lojas;
- separa a fila por loja;
- mantém avaliações globais;
- mantém o histórico de pedidos existente.

## Administração
O painel administrativo ganhou um seletor de loja para Produtos, Atendimento, Promoção e Entrega. A tela de Pedidos continua global e mostra pedidos das duas lojas, identificando a loja e o bot correspondente.

## Importante
O catálogo MM2 começa vazio. Depois da migração, entre no painel, selecione Murder Mystery 2 e cadastre os itens com as raridades MM2:
Comum, Incomum, Raro, Lendário, Godly, Ancient, Unique, Vintage e Chroma.

O bot MM2 deve ser configurado em Administração > Entrega com a loja Murder Mystery 2 selecionada.
