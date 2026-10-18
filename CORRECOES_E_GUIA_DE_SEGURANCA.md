# Thoune Store — correção do painel de produtos e segurança

## Resumo da análise do ZIP recebido

Projeto analisado: pasta `v1139/` dentro do ZIP enviado. A publicação é um site estático com HTML/CSS/JavaScript e Supabase JS v2 carregado por CDN. O painel administrativo está em `admin.html`; a configuração pública está em `config.js`. Não havia `.env`, pasta `.git`, workflows do GitHub Actions nem `package.json` no ZIP.

### Causa comprovada do botão de salvar

No script do painel, o manipulador de `#save-product-button` tentava executar `Number(productStock.value)`, mas não existe elemento `#product-stock` no formulário nem declaração da variável `productStock`. Isso dispara `ReferenceError` antes da chamada ao Supabase. O erro ocorria tanto ao editar quanto ao cadastrar, interrompendo o evento de clique.

### Correções aplicadas em `admin.html`

- Removida a leitura da variável inexistente `productStock`. O projeto já usa estoque infinito na gravação (`stock: 2147483647`) e o formulário não tem campo de estoque; mantive esse comportamento existente, sem inventar um campo novo.
- Validação do preço agora rejeita campo vazio, preço inválido ou negativo. O valor decimal é enviado como número em reais, sem multiplicação/divisão por 100.
- A edição e o cadastro agora pedem o identificador retornado pelo Supabase (`select("id")`) para confirmar que houve uma linha afetada/inserida. Se a política RLS bloquear a operação, o erro aparece no formulário em vez de parecer sucesso.
- Adicionado tratamento de exceções inesperadas e mensagem clara de sucesso/erro.
- O botão fica desabilitado durante a operação, reduzindo risco de duplo clique/cadastros duplicados.
- Mantidos os campos atuais: nome, raridade/categoria, preço, desconto individual, ordem, imagem, descrição e ativo. A imagem enviada pelo formulário continua sendo otimizada no navegador e gravada no campo `image`, como o código original fazia.
- Não alterei checkout, Pix, pedidos, avaliações, cancelamentos, fila de atendimento, CSS visual nem a lógica do catálogo.

### Segurança do Supabase

O ZIP contém `supabase_v1020_admin_access.sql`, que define `public.is_admin()` como `SECURITY DEFINER` e confere `profiles.role = 'admin'`. O frontend também verifica esse papel. O arquivo `config.js` contém URL do projeto e uma chave `sb_publishable_...`, destinada a uso público no navegador; não encontrei no código examinado texto indicativo de `service_role`, `sb_secret`, chave privada ou token de serviço. Isso não prova que o histórico do Git ou as configurações remotas estejam limpos.

O ZIP não contém um dump do banco nem o estado atual das políticas. Portanto, não é possível confirmar offline se a RLS está habilitada, se políticas antigas permitem escrita anônima ou se as migrações SQL foram aplicadas no projeto remoto.

Arquivos incluídos:
- `thoune_products_security_hardening.sql`: endurece **somente** `public.products`, depois de verificar a existência da tabela, coluna `active` e função `public.is_admin()`. Ativa RLS, remove políticas existentes apenas dessa tabela, cria leitura pública de produtos ativos e restringe INSERT/UPDATE/DELETE a administradores. Não apaga dados. Revise a seção abaixo antes de executar.
- `thoune_supabase_audit_readonly.sql`: consultas de auditoria somente leitura para RLS, políticas, colunas, privilégios, funções `SECURITY DEFINER`, Storage e usuários administradores.

### Antes de executar o SQL de endurecimento

1. Faça backup do projeto Supabase (ou confirme que tem um backup recente).
2. Abra `thoune_supabase_audit_readonly.sql` no SQL Editor e execute as consultas.
3. Confirme que a função `public.is_admin()` está instalada e que sua conta esperada aparece em `public.profiles` com `role = 'admin'`. Não atribua esse papel a todos os usuários autenticados.
4. Revise as políticas atuais de `products`. O script de endurecimento substitui todas as políticas **dessa tabela apenas**. Se houver uma integração legítima que grava produtos sem sessão autenticada, ela deixará de funcionar — não é esperada pelo painel deste ZIP.
5. Execute `thoune_products_security_hardening.sql` em horário de manutenção e confira as consultas de verificação no final.
6. Teste login administrativo, leitura do catálogo sem login, edição e criação por admin, e tente confirmar que uma sessão anônima não consegue inserir/alterar/excluir produtos.

O SQL não altera permissões das tabelas `orders`, `payments`, `order_items`, `reviews`, `profiles`, `notifications` ou `store_settings`; essas políticas precisam ser avaliadas com os resultados reais da auditoria para evitar quebrar o checkout. Não seria seguro inventar políticas para essas tabelas sem conhecer todas as funções/RPCs e o estado atual do banco.

## Testes realizados localmente

- ZIP aberto e inventário de 58 entradas realizado.
- Verificação sintática `node --check` passou para o script módulo inline do painel e para `app.js`, `ui.js`, `cart.js`, `config.js` e `demo-products.js`.
- Não foram encontrados IDs HTML duplicados no `admin.html`.
- A referência a `productStock` foi removida do painel.
- Busca textual nos arquivos principais não encontrou marcadores comuns de chave `service_role`/`sb_secret`/`sk_live`/JWT de serviço.
- Os arquivos originais de checkout, Pix e SQL foram preservados no ZIP corrigido.

## Limites importantes

Não tive acesso autenticado ao banco Supabase nem ao site publicado. Não foi possível executar testes de integração reais, verificar a resposta efetiva das políticas, confirmar persistência após recarga no banco remoto, testar upload no Storage ou confirmar o checkout real. A correção de JavaScript elimina a causa local comprovada, mas a gravação remota ainda depende de o SQL/políticas atuais permitirem a operação.

## Publicação

1. Descompacte o ZIP corrigido.
2. Publique os arquivos mantendo a estrutura de pasta que o repositório já usa. Se o repositório publica o conteúdo de `v1139/` como raiz do site, envie o conteúdo dessa pasta para a branch/pasta de publicação já configurada — não crie um segundo nível de pasta sem conferir o caminho publicado.
3. Não envie chaves privilegiadas. A chave publishable/anon é destinada ao cliente; nunca coloque `service_role` ou `sb_secret` no frontend.
4. Aguarde o deploy e teste no celular em janela anônima e no painel com a conta administrativa.

## Teste de lançamento

- [ ] Catálogo público abre e mostra somente os produtos ativos.
- [ ] Login administrativo funciona e uma conta não administradora não entra no painel.
- [ ] Editar o preço de um produto existente, salvar, recarregar o painel e confirmar o preço persistido.
- [ ] Criar uma marreta real usando somente os dados fornecidos por você; confirmar que aparece no catálogo.
- [ ] Confirmar preço decimal, categoria, descrição, imagem, desconto e status.
- [ ] Testar botão Atualizar, ativar/desativar e excluir com um registro que possa ser removido com segurança.
- [ ] Fazer um pedido de teste controlado e conferir o fluxo Pix e o status do pedido sem confirmar pagamento real indevidamente.
- [ ] Confirmar que um visitante não autenticado não consegue alterar produtos.
- [ ] Confirmar que comprovantes e dados privados de pedidos não ficam publicamente acessíveis.

## GitHub — medidas manuais

1. Ative autenticação de dois fatores (preferencialmente passkey ou app autenticador) na conta GitHub e guarde códigos de recuperação fora do computador.
2. Se o repositório não precisa ser público, altere-o para privado em Settings → General → Danger Zone → Change visibility.
3. Settings → Branches / Rulesets: crie uma regra para a branch principal, bloqueando exclusão e force-push e exigindo revisão quando apropriado.
4. Settings → Code security and analysis: ative Secret scanning e Push protection se disponíveis no plano/repositório.
5. O `.gitignore` incluído cobre `.env`, arquivos de chave privada e pastas de credenciais. Ele não remove arquivos que já estejam rastreados pelo Git.
6. Se uma chave privilegiada já foi publicada, revogue-a no provedor imediatamente e gere outra. Remover o texto do commit mais recente não apaga o histórico; avalie reescrita do histórico e invalide a chave mesmo assim.
7. Se houver GitHub Actions no repositório remoto, armazene segredos em Settings → Secrets and variables → Actions, restrinja permissões de `GITHUB_TOKEN` e nunca imprima segredos nos logs. O ZIP recebido não contém workflows para avaliar.
8. Revise o histórico de commits e os logs de deploy; a busca local atual não consegue inspecionar o histórico Git que não veio no ZIP.
