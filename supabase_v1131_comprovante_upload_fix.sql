-- Thoune Store v1131
-- Corrige o envio do comprovante Pix, especialmente fotos HEIC/HEIF de iPhone.
-- Execute uma vez no Supabase SQL Editor.

-- Garante que o bucket privado exista.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

-- Permite que o cliente sem login envie o comprovante.
-- iPhone pode enviar HEIC/HEIF, por isso esses formatos também são aceitos.
drop policy if exists "guest can upload payment proofs" on storage.objects;
create policy "guest can upload payment proofs"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'payment-proofs'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','gif','heic','heif')
);

-- Mantém a leitura restrita ao administrador.
drop policy if exists "admins can read payment proofs" on storage.objects;
create policy "admins can read payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

-- Mantém a exclusão restrita ao administrador.
drop policy if exists "admins can delete payment proofs" on storage.objects;
create policy "admins can delete payment proofs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);
