-- Thoune Store v1016 — descontos individuais por produto
-- Execute este arquivo no Supabase SQL Editor antes de usar o desconto individual no painel ADM.

alter table public.products
  add column if not exists discount_percent numeric(5,2) not null default 0,
  add column if not exists discount_active boolean not null default false;

update public.products
set discount_percent = 0
where discount_percent is null;

update public.products
set discount_active = false
where discount_active is null;

-- A função de criação de pedido usa o desconto individual quando ele estiver ativo;
-- caso contrário, utiliza o desconto global da loja.
create or replace function public.create_order(p_items jsonb, p_pix_name text, p_delivery_username text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product_name text;
  v_product_price numeric(10,2);
  v_effective_price numeric(10,2);
  v_stock integer;
  v_discount_percent numeric := 0;
  v_discount_active boolean := false;
  v_product_discount_percent numeric := 0;
  v_product_discount_active boolean := false;
  v_store_online boolean := false;
begin
  v_customer_id := auth.uid();

  if v_customer_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select coalesce(online, false)
    into v_store_online
  from public.store_settings
  where id = 1;

  if not v_store_online then
    raise exception 'A loja está offline no momento';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;

  if p_pix_name is null or trim(p_pix_name) = '' then
    raise exception 'Nome do remetente do Pix é obrigatório';
  end if;

  if p_delivery_username is null or trim(p_delivery_username) = '' then
    raise exception 'Usuário para entrega é obrigatório';
  end if;

  select coalesce(discount_percent, 0), coalesce(discount_active, false)
    into v_discount_percent, v_discount_active
  from public.store_settings
  where id = 1;

  if not found then
    v_discount_percent := 0;
    v_discount_active := false;
  end if;

  if v_discount_percent < 0 or v_discount_percent > 100 then
    raise exception 'Percentual de desconto global inválido';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then
      raise exception 'Item do carrinho inválido';
    end if;

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
           coalesce(discount_percent, 0), coalesce(discount_active, false)
      into v_product_name, v_product_price, v_stock,
           v_product_discount_percent, v_product_discount_active
    from public.products
    where id = v_product_id
      and active = true;

    if not found then
      raise exception 'Produto não encontrado ou indisponível';
    end if;

    if v_quantity > v_stock then
      raise exception 'Estoque insuficiente para: %', v_product_name;
    end if;

    if v_product_discount_active and v_product_discount_percent > 0 then
      if v_product_discount_percent > 100 then
        raise exception 'Desconto individual inválido para: %', v_product_name;
      end if;
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_discount_percent / 100), 2);
    else
      v_effective_price := v_product_price;
    end if;

    v_total := v_total + (v_effective_price * v_quantity);
  end loop;

  v_total := round(v_total, 2);

  insert into public.orders (
    customer_id, status, total, pix_name, delivery_username
  ) values (
    v_customer_id, 'awaiting_payment', v_total,
    trim(p_pix_name), trim(p_delivery_username)
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select name, price,
           coalesce(discount_percent, 0), coalesce(discount_active, false)
      into v_product_name, v_product_price,
           v_product_discount_percent, v_product_discount_active
    from public.products
    where id = v_product_id
      and active = true;

    if v_product_discount_active and v_product_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_discount_percent / 100), 2);
    else
      v_effective_price := v_product_price;
    end if;

    insert into public.order_items (
      order_id, product_id, product_name, product_price, quantity
    ) values (
      v_order_id, v_product_id, v_product_name, v_effective_price, v_quantity
    );
  end loop;

  insert into public.payments (order_id, method, pix_name, status)
  values (v_order_id, 'pix', trim(p_pix_name), 'pending');

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total', v_total,
    'status', 'awaiting_payment'
  );
end;
$function$;

revoke all on function public.create_order(jsonb, text, text) from public;
grant execute on function public.create_order(jsonb, text, text) to authenticated;
