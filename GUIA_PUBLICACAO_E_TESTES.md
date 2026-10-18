# Guia rápido de publicação — Thoune Store

1. Baixe e extraia `Thoune-Store-corrigida-seguranca.zip`.
2. Mantenha os arquivos e caminhos como estão dentro de `v1139/`.
3. No GitHub, abra o repositório que já publica a loja e confira em Settings → Pages qual branch/pasta está configurada.
4. Se o Pages publica a raiz do repositório, copie o conteúdo de `v1139/` para a raiz; se publica `/docs` ou outra pasta, use a mesma pasta configurada. Não publique uma pasta extra `v1139/v1139`.
5. Faça commit e push. Aguarde o status do Pages concluir.
6. Teste primeiro em janela anônima: catálogo, navegação e imagens.
7. Entre no painel administrativo com a conta já autorizada e teste editar o preço de um produto existente. Salve, recarregue a página e confirme.
8. Cadastre produto somente com os dados reais fornecidos por você. Confirme se está ativo e aparece no catálogo.
9. Teste o checkout sem concluir pagamento real. Verifique que o Pix continua sendo exibido como antes.
10. Se aparecer erro de permissão no painel, não tente remover RLS: execute a auditoria SQL e confira as políticas e o papel admin.

**Importante:** não foi possível testar deploy nem integração com o Supabase remoto a partir deste ambiente. A publicação deve ser validada no seu repositório e projeto reais.
