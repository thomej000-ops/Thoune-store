-- Thoune Store — correção do upload de comprovantes (v1139)
-- Execute UMA vez no SQL Editor do Supabase, após conferir que está no projeto correto.
-- Mantém o bucket privado e a leitura/exclusão de comprovantes restritas ao administrador.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'];

-- O site pode estar com sessão autenticada no mesmo navegador; autoriza os dois papéis,
-- mas somente para imagens com extensão permitida no bucket privado de comprovantes.
drop policy if exists "guest can upload payment proofs" on storage.objects;
create policy "guest can upload payment proofs"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','gif','heic','heif')
);

-- A leitura continua privada: somente a conta administradora autenticada.
drop policy if exists "admins can read payment proofs" on storage.objects;
create policy "admins can read payment proofs"
on storage.objects
for select
to authenticated
using (bucket_id = 'payment-proofs' and public.is_admin());

drop policy if exists "admins can delete payment proofs" on storage.objects;
create policy "admins can delete payment proofs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'payment-proofs' and public.is_admin());
