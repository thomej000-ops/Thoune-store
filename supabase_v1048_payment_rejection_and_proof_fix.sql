-- Thoune Store v1048
-- Corrige a recusa de pagamento e reforça o envio de comprovantes Pix.
-- Execute UMA vez no Supabase SQL Editor.

-- ============================================================
-- 1) Permitir o novo status payment_rejected nos pedidos.
-- ============================================================
-- A constraint antiga não conhecia payment_rejected, por isso
-- o botão "Recusar pedido" retornava orders_status_check.

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'awaiting_payment',
      'awaiting_verification',
      'payment_confirmed',
      'awaiting_delivery',
      'payment_rejected',
      'delivered',
      'cancelled'
    )
  );

alter table public.orders
  add column if not exists rejection_reason text;

-- ============================================================
-- 2) Garantir o bucket privado dos comprovantes.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update
set public = false;

-- Cliente sem conta pode enviar apenas imagens para o bucket.
drop policy if exists "guest can upload payment proofs" on storage.objects;

create policy "guest can upload payment proofs"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'payment-proofs'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

-- Administrador autenticado pode visualizar os comprovantes.
drop policy if exists "admins can read payment proofs" on storage.objects;

create policy "admins can read payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

-- Administrador pode apagar comprovantes quando necessário.
drop policy if exists "admins can delete payment proofs" on storage.objects;

create policy "admins can delete payment proofs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

-- ============================================================
-- 3) Corrigir/fortalecer o vínculo do comprovante com o pedido.
-- ============================================================

alter table public.payments
  add column if not exists payment_proof_path text;

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
declare
  v_path text := trim(coalesce(p_proof_path, ''));
  v_payment_id uuid;
begin
  if p_order_id is null then
    raise exception 'Pedido não informado.';
  end if;

  if v_path = '' then
    raise exception 'Comprovante inválido.';
  end if;

  -- O caminho precisa pertencer ao próprio pedido.
  if v_path not like p_order_id::text || '/%' then
    raise exception 'Comprovante não pertence ao pedido.';
  end if;

  if not exists (
    select 1
    from public.orders
    where id = p_order_id
      and status in (
        'awaiting_payment',
        'awaiting_verification',
        'payment_rejected'
      )
  ) then
    raise exception 'Pedido não pode receber comprovante neste momento.';
  end if;

  select id
    into v_payment_id
  from public.payments
  where order_id = p_order_id
  limit 1;

  if v_payment_id is null then
    raise exception 'Pagamento do pedido não foi encontrado.';
  end if;

  update public.payments
     set payment_proof_path = v_path,
         status = 'pending',
         updated_at = now()
   where id = v_payment_id;

  update public.orders
     set status = 'awaiting_verification',
         rejection_reason = null,
         updated_at = now()
   where id = p_order_id
     and status = 'payment_rejected';

  return jsonb_build_object(
    'success', true,
    'status', 'awaiting_verification'
  );
end;
$$;

revoke all
on function public.submit_guest_payment_proof(uuid, text)
from public;

grant execute
on function public.submit_guest_payment_proof(uuid, text)
to anon;

-- ============================================================
-- 4) Recriar a recusa de pagamento de forma compatível.
-- ============================================================

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
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Acesso negado.';
  end if;

  update public.orders
     set status = 'payment_rejected',
         rejection_reason = coalesce(v_reason, 'Pix não localizado pela loja.'),
         updated_at = now()
   where id = p_order_id
     and status = 'awaiting_verification';

  if not found then
    raise exception 'Pedido não está aguardando verificação.';
  end if;

  update public.payments
     set status = 'rejected',
         updated_at = now()
   where order_id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'status', 'payment_rejected'
  );
end;
$$;

revoke all
on function public.reject_guest_payment(uuid, text)
from public;

grant execute
on function public.reject_guest_payment(uuid, text)
to authenticated;

-- ============================================================
-- 5) Permissão pública para consultar o status do pedido.
-- ============================================================

revoke all
on function public.get_guest_order_status(uuid)
from public;

grant execute
on function public.get_guest_order_status(uuid)
to anon, authenticated;
