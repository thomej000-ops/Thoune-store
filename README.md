# Thoune Store — nova base

Nova construção da Thoune Store para Flee the Facility.

## Estrutura

- `index.html` — página pública
- `css/styles.css` — identidade visual e responsividade
- `js/app.js` — inicialização e eventos
- `js/modules/cart.js` — carrinho
- `js/modules/ui.js` — renderização
- `js/data/demo-products.js` — produtos temporários de demonstração
- `js/config.js` — configuração pública do Supabase (sem segredos)
- `assets/snoopy-banner.jpg` — imagem do Snoopy enviada pelo proprietário
- `admin/index.html` — estrutura inicial do ADM

## Importante

Os produtos de demonstração ainda não são o catálogo real. O próximo passo é conectar o catálogo ao Supabase.

Não coloque Secret Key / Service Role Key / senha do banco no frontend ou em um repositório público.

A regra definitiva de estoque será implementada no backend: adicionar ao carrinho e criar pedido não reduzem estoque; somente a confirmação de pagamento pelo ADM fará a baixa, de forma atômica e segura.


## Estrutura simplificada para upload pelo celular
Os arquivos foram colocados na raiz para facilitar o envio ao GitHub pelo seletor de arquivos do Android.
