-- Thoune Store v1043
-- Fluxo: dados -> Pix -> verificando pagamento -> entrega/recusa
-- Comprovante Pix privado para consulta do administrador.
-- Execute uma vez no Supabase SQL Editor.

alter table public.payments
  add column if not exists payment_proof_path text;

alter table public.orders
  add column if not exists rejection_reason text;

-- Bucket privado para comprovantes.
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update set public = false;

-- Cliente pode enviar imagem; somente usuários autenticados podem ler objetos.
drop policy if exists "guest can upload payment proofs" on storage.objects;
create policy "guest can upload payment proofs"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'payment-proofs'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

drop policy if exists "admins can read payment proofs" on storage.objects;
create policy "admins can read payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

drop policy if exists "admins can delete payment proofs" on storage.objects;
create policy "admins can delete payment proofs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

-- Vincula o caminho do comprovante ao pedido.
drop function if exists public.submit_guest_payment_proof(uuid, text);
create or replace function public.submit_guest_payment_proof(
  p_order_id uuid,
  p_proof_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_proof_path is null or length(trim(p_proof_path)) < 10 then
    raise exception 'Comprovante inválido';
  end if;

  if not exists (
    select 1 from public.orders
    where id = p_order_id
      and status in ('awaiting_payment','awaiting_verification','payment_rejected')
  ) then
    raise exception 'Pedido não pode receber comprovante neste momento';
  end if;

  update public.payments
     set payment_proof_path = trim(p_proof_path),
         status = 'pending',
         updated_at = now()
   where order_id = p_order_id;

  update public.orders
     set status = 'awaiting_verification',
         updated_at = now()
   where id = p_order_id
     and status = 'payment_rejected';

  return jsonb_build_object('success', true, 'status', 'awaiting_verification');
end;
$$;

revoke all on function public.submit_guest_payment_proof(uuid,text) from public;
grant execute on function public.submit_guest_payment_proof(uuid,text) to anon;

-- Recusar pagamento: o cliente recebe uma tela informando que o Pix não foi localizado.
drop function if exists public.reject_guest_payment(uuid, text);
create or replace function public.reject_guest_payment(
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  update public.orders
     set status = 'payment_rejected',
         rejection_reason = coalesce(v_reason, 'Pix não localizado pela loja.'),
         updated_at = now()
   where id = p_order_id
     and status = 'awaiting_verification';

  if not found then
    raise exception 'Pedido não está aguardando verificação';
  end if;

  update public.payments
     set status = 'rejected',
         updated_at = now()
   where order_id = p_order_id;

  return jsonb_build_object('success', true, 'status', 'payment_rejected');
end;
$$;

revoke all on function public.reject_guest_payment(uuid,text) from public;
grant execute on function public.reject_guest_payment(uuid,text) to authenticated;

-- Status público do pedido.
drop function if exists public.get_guest_order_status(uuid);
create or replace function public.get_guest_order_status(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'found', true,
    'id', o.id,
    'status', o.status,
    'rejection_reason', o.rejection_reason,
    'queue_position', case
      when o.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery') then (
        select count(*) + 1
        from public.orders prior
        where prior.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery')
          and (prior.created_at < o.created_at or (prior.created_at = o.created_at and prior.id < o.id))
      )
      else 0
    end
  )
  from public.orders o
  where o.id = p_order_id;
$$;

revoke all on function public.get_guest_order_status(uuid) from public;
grant execute on function public.get_guest_order_status(uuid) to anon;
