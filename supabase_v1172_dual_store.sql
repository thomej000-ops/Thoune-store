-- Thoune Store v1172 — dual store: Flee the Facility + Murder Mystery 2
-- Execute once in Supabase SQL Editor AFTER the current v1161/v1165 migrations.
-- This migration is additive: existing Flee the Facility products/orders remain in place.

begin;

-- =========================================================
-- 1) Identify which store owns each product/order
-- =========================================================
alter table public.products
  add column if not exists store_type text;

update public.products
set store_type = 'ftf'
where store_type is null or trim(store_type) = '';

alter table public.products
  alter column store_type set default 'ftf',
  alter column store_type set not null;

alter table public.products
  drop constraint if exists products_store_type_check;

alter table public.products
  add constraint products_store_type_check
  check (store_type in ('ftf','mm2'));

create index if not exists products_store_type_active_idx
  on public.products(store_type, active, sort_order);

alter table public.orders
  add column if not exists store_type text;

update public.orders o
set store_type = coalesce(
  (
    select p.store_type
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = o.id
    limit 1
  ),
  'ftf'
)
where o.store_type is null or trim(o.store_type) = '';

alter table public.orders
  alter column store_type set default 'ftf',
  alter column store_type set not null;

alter table public.orders
  drop constraint if exists orders_store_type_check;

alter table public.orders
  add constraint orders_store_type_check
  check (store_type in ('ftf','mm2'));

create index if not exists orders_store_type_created_idx
  on public.orders(store_type, created_at);

-- =========================================================
-- 2) MM2-specific settings live alongside the existing FTF settings
-- =========================================================
alter table public.store_settings
  add column if not exists mm2_online boolean not null default false,
  add column if not exists mm2_pix_key text,
  add column if not exists mm2_delivery_bot_username text,
  add column if not exists mm2_delivery_bot_url text,
  add column if not exists mm2_join_open boolean not null default true,
  add column if not exists mm2_discount_percent numeric not null default 0,
  add column if not exists mm2_discount_active boolean not null default false,
  add column if not exists mm2_discount_event text;

-- =========================================================
-- 3) Public settings view: keep old fields + expose MM2 fields
-- =========================================================
create or replace view public.public_store_settings as
select
  id,
  online,
  pix_key,
  delivery_bot_username,
  delivery_bot_url,
  join_open,
  discount_percent,
  discount_active,
  discount_event,
  mm2_online,
  mm2_pix_key,
  mm2_delivery_bot_username,
  mm2_delivery_bot_url,
  mm2_join_open,
  mm2_discount_percent,
  mm2_discount_active,
  mm2_discount_event,
  updated_at
from public.store_settings;

grant select on public.public_store_settings to anon, authenticated;

-- =========================================================
-- 4) Secure dual-store guest checkout
--    MM2 uses the 5-argument function.
--    The old 4-argument function is intentionally left intact for
--    compatibility; its orders default to FTF.
-- =========================================================
drop function if exists public.create_guest_order(jsonb, text, text, text, text);

create or replace function public.create_guest_order(
  p_items jsonb,
  p_tiktok_username text,
  p_delivery_username text,
  p_pix_name text,
  p_store_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_name text;
  v_product_price numeric;
  v_stock integer;
  v_effective_price numeric;
  v_total numeric := 0;
  v_discount_percent numeric := 0;
  v_discount_active boolean := false;
  v_discount_event text := null;
  v_product_event text := null;
  v_product_store text := null;
  v_product_discount_percent numeric;
  v_product_discount_active boolean;
  v_tiktok text := trim(coalesce(p_tiktok_username, ''));
  v_roblox text := trim(coalesce(p_delivery_username, ''));
  v_pix_name text := trim(coalesce(p_pix_name, ''));
  v_store text := lower(trim(coalesce(p_store_type, '')));
begin
  if v_store not in ('ftf','mm2') then
    raise exception 'Loja inválida.';
  end if;

  if v_tiktok = '' then raise exception 'Usuário do TikTok é obrigatório'; end if;
  if v_roblox = '' then raise exception 'Usuário do Roblox é obrigatório'; end if;
  if v_pix_name = '' then raise exception 'Nome do remetente do Pix é obrigatório'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;

  if v_store = 'mm2' then
    select coalesce(mm2_discount_percent,0),
           coalesce(mm2_discount_active,false),
           mm2_discount_event
      into v_discount_percent, v_discount_active, v_discount_event
    from public.store_settings
    where id = 1;
  else
    select coalesce(discount_percent,0),
           coalesce(discount_active,false),
           discount_event
      into v_discount_percent, v_discount_active, v_discount_event
    from public.store_settings
    where id = 1;
  end if;

  if v_discount_percent < 0 or v_discount_percent > 100 then
    raise exception 'Percentual de desconto global inválido';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Produto ou quantidade inválida';
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select name, price, stock,
           coalesce(discount_percent,0),
           coalesce(discount_active,false),
           event_name,
           store_type
      into v_product_name, v_product_price, v_stock,
           v_product_discount_percent,
           v_product_discount_active,
           v_product_event,
           v_product_store
    from public.products
    where id = v_product_id
      and active = true;

    if not found then
      raise exception 'Produto não encontrado ou indisponível';
    end if;

    if v_product_store <> v_store then
      raise exception 'Este carrinho contém itens de lojas diferentes. Separe Flee the Facility e Murder Mystery 2 em compras diferentes.';
    end if;

    if v_quantity > v_stock then
      raise exception 'Estoque insuficiente para: %', v_product_name;
    end if;

    if v_product_discount_active and v_product_discount_percent > 0 then
      if v_product_discount_percent > 100 then
        raise exception 'Desconto individual inválido para: %', v_product_name;
      end if;
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0
          and (v_discount_event is null or v_discount_event = v_product_event) then
      v_effective_price := round(v_product_price * (1 - v_discount_percent / 100), 2);
    else
      v_effective_price := v_product_price;
    end if;

    v_total := v_total + (v_effective_price * v_quantity);
  end loop;

  v_total := round(v_total, 2);

  insert into public.orders (
    customer_id, status, total, pix_name, delivery_username, tiktok_username, store_type
  )
  values (
    null, 'awaiting_payment', v_total, v_pix_name, v_roblox, v_tiktok, v_store
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select name, price,
           coalesce(discount_percent,0),
           coalesce(discount_active,false),
           event_name
      into v_product_name, v_product_price,
           v_product_discount_percent,
           v_product_discount_active,
           v_product_event
    from public.products
    where id = v_product_id
      and active = true
      and store_type = v_store;

    if v_product_discount_active and v_product_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0
          and (v_discount_event is null or v_discount_event = v_product_event) then
      v_effective_price := round(v_product_price * (1 - v_discount_percent / 100), 2);
    else
      v_effective_price := v_product_price;
    end if;

    insert into public.order_items (
      order_id, product_id, product_name, product_price, quantity
    )
    values (
      v_order_id, v_product_id, v_product_name, v_effective_price, v_quantity
    );
  end loop;

  insert into public.payments (order_id, method, pix_name, status)
  values (v_order_id, 'pix', v_pix_name, 'pending');

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total', v_total,
    'status', 'awaiting_payment',
    'store_type', v_store
  );
end;
$$;

revoke all on function public.create_guest_order(jsonb,text,text,text,text) from public;
grant execute on function public.create_guest_order(jsonb,text,text,text,text) to anon, authenticated;

-- =========================================================
-- 5) Queue is isolated per store, so MM2 orders never block FTF
--    and vice versa.
-- =========================================================
drop function if exists public.get_guest_order_queue_position(uuid);

create or replace function public.get_guest_order_queue_position(p_order_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (
      select 1 from public.orders where id = p_order_id
    ) then 0
    when not exists (
      select 1 from public.orders
      where id = p_order_id
        and status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery')
    ) then 0
    else (
      select (count(*) + 1)::integer
      from public.orders o
      join public.orders target on target.id = p_order_id
      where o.store_type = target.store_type
        and o.status in ('awaiting_payment','awaiting_verification','payment_confirmed','awaiting_delivery')
        and (
          o.created_at < target.created_at
          or (o.created_at = target.created_at and o.id < target.id)
        )
    )
  end;
$$;

revoke all on function public.get_guest_order_queue_position(uuid) from public;
grant execute on function public.get_guest_order_queue_position(uuid) to anon, authenticated;

commit;

-- =========================================================
-- Verification
-- =========================================================
select store_type, count(*) as products
from public.products
group by store_type
order by store_type;

select store_type, count(*) as orders
from public.orders
group by store_type
order by store_type;

select id, online, mm2_online,
       delivery_bot_username, mm2_delivery_bot_username
from public.store_settings
where id = 1;
