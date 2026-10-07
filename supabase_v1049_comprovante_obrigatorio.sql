-- Thoune Store v1049
-- Comprovante Pix obrigatório + correção do fluxo de recusa/reenviar comprovante.
-- Execute UMA vez no SQL Editor do Supabase.

-- ============================================================
-- 1) Status permitidos para pedidos
-- ============================================================
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
-- 2) Bucket privado para comprovantes
-- ============================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do update
set public = false;

-- Cliente guest pode enviar somente imagens para o bucket.
drop policy if exists "guest can upload payment proofs" on storage.objects;

create policy "guest can upload payment proofs"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'payment-proofs'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);

-- Administrador autenticado pode visualizar comprovantes.
drop policy if exists "admins can read payment proofs" on storage.objects;

create policy "admins can read payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

-- Administrador pode excluir comprovantes.
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
-- 3) Campo que guarda o caminho do comprovante
-- ============================================================
alter table public.payments
add column if not exists payment_proof_path text;

-- ============================================================
-- 4) Vincular comprovante ao pedido
-- ============================================================
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

  -- Se o pagamento havia sido recusado, o novo comprovante devolve o pedido
  -- para a fila de conferência.
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
-- 5) Comprovante é OBRIGATÓRIO para avisar que o Pix foi feito.
-- ============================================================
drop function if exists public.request_guest_payment_verification(uuid);

create or replace function public.request_guest_payment_verification(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proof_path text;
  v_updated integer;
begin
  select payment_proof_path
  into v_proof_path
  from public.payments
  where order_id = p_order_id
  limit 1;

  if nullif(trim(coalesce(v_proof_path, '')), '') is null then
    return jsonb_build_object(
      'success', false,
      'message', 'O comprovante do Pix é obrigatório antes de avisar a loja.'
    );
  end if;

  update public.orders
  set status = 'awaiting_verification',
      rejection_reason = null,
      updated_at = now()
  where id = p_order_id
    and status in ('awaiting_payment', 'payment_rejected');

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    if exists (
      select 1
      from public.orders
      where id = p_order_id
        and status = 'awaiting_verification'
    ) then
      return jsonb_build_object(
        'success', true,
        'status', 'awaiting_verification'
      );
    end if;

    raise exception 'Pedido não encontrado ou não pode ser enviado para verificação.';
  end if;

  return jsonb_build_object(
    'success', true,
    'status', 'awaiting_verification'
  );
end;
$$;

revoke all
on function public.request_guest_payment_verification(uuid)
from public;

grant execute
on function public.request_guest_payment_verification(uuid)
to anon;

-- ============================================================
-- 6) Recusa do Pix pelo administrador
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
-- 7) Status público do pedido
-- ============================================================
revoke all
on function public.get_guest_order_status(uuid)
from public;

grant execute
on function public.get_guest_order_status(uuid)
to anon, authenticated;
