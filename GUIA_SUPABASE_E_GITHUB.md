# Guia SQL, Supabase e GitHub — Thoune Store

## Supabase — sequência segura

1. Abra o projeto Supabase correto e faça/confirme um backup recente.
2. No SQL Editor, execute `thoune_supabase_audit_readonly.sql`. São consultas de leitura.
3. Verifique que `public.products` existe, tem a coluna `active`, e `public.is_admin()` existe.
4. Confira em `public.profiles` que apenas a sua conta administradora pretendida tem `role = 'admin'`. Não altere IDs por suposição nem marque todos os usuários como admin.
5. Revise as políticas atuais de `products`. O arquivo de endurecimento substitui todas as políticas **somente nessa tabela**.
6. Se a configuração corresponder ao esperado, execute `thoune_products_security_hardening.sql`.
7. Rode as consultas de verificação no final do arquivo. Teste catálogo anônimo, operações administrativas e tentativa de escrita anônima.
8. Para outras tabelas (`orders`, `payments`, `order_items`, `reviews`, `profiles`, `notifications`, `store_settings` e `storage.objects`), não aplique políticas genéricas. Use os resultados da auditoria para desenhar correções compatíveis com as RPCs de checkout e Pix.

Se a auditoria indicar que `is_admin()` não existe ou que as colunas divergem, pare e não execute o endurecimento até corrigir a incompatibilidade. Não compartilhe chaves, comprovantes, e-mails ou dados pessoais nos resultados.

## GitHub — checklist

- [ ] Ativar autenticação de dois fatores/passkey e guardar os códigos de recuperação em local seguro.
- [ ] Tornar o repositório privado se não houver necessidade de código público.
- [ ] Criar regra para a branch principal: bloquear exclusão e force-push; exigir revisão se houver colaboradores.
- [ ] Ativar Secret scanning e Push protection, quando disponíveis.
- [ ] Conferir `.gitignore` incluído no ZIP.
- [ ] Verificar histórico de commits, não apenas arquivos atuais.
- [ ] Se uma credencial privilegiada foi publicada, revogá-la no serviço emissor e gerar substituta. Apagar do arquivo atual não invalida a credencial nem apaga o histórico.
- [ ] Se GitHub Actions existir no repositório remoto, guardar segredos em Settings → Secrets and variables → Actions, limitar permissões do `GITHUB_TOKEN` e evitar imprimir segredos em logs.

O ZIP recebido não continha `.git`, workflows nem arquivos `.env`; portanto, o histórico do repositório remoto e as configurações da conta não foram inspecionados nem alterados.
