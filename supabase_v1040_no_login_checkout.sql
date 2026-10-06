-- Thoune Store v1040 — checkout público sem login/e-mail
-- Execute este arquivo UMA vez no SQL Editor do Supabase antes de publicar a v1040.
-- O login do administrador em admin.html continua existindo. Esta mudança remove apenas a conta do cliente.

-- 1) Pedidos públicos não têm customer_id.
alter table public.orders
  alter column customer_id drop not null;

-- 2) Guardamos os dois identificadores informados no checkout.
alter table public.orders
  add column if not exists tiktok_username text;

-- 3) RPC pública para criar o pedido sem autenticação.
drop function if exists public.create_guest_order(jsonb, text, text);
drop function if exists public.create_guest_order(jsonb, text, text, text);
create or replace function public.create_guest_order(
  p_items jsonb,
  p_tiktok_username text,
  p_delivery_username text,
  p_pix_name text
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
  v_product_discount_percent numeric;
  v_product_discount_active boolean;
  v_tiktok text := trim(coalesce(p_tiktok_username, ''));
  v_roblox text := trim(coalesce(p_delivery_username, ''));
  v_pix_name text := trim(coalesce(p_pix_name, ''));
begin
  if v_tiktok = '' then raise exception 'Usuário do TikTok é obrigatório'; end if;
  if v_roblox = '' then raise exception 'Usuário do Roblox é obrigatório'; end if;
  if v_pix_name = '' then raise exception 'Nome do remetente do Pix é obrigatório'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio';
  end if;

  select coalesce(discount_percent, 0), coalesce(discount_active, false)
    into v_discount_percent, v_discount_active
  from public.store_settings where id = 1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Produto ou quantidade inválida';
    end;

    if v_quantity is null or v_quantity <= 0 then raise exception 'Quantidade inválida'; end if;

    select name, price, stock, coalesce(discount_percent, 0), coalesce(discount_active, false)
      into v_product_name, v_product_price, v_stock, v_product_discount_percent, v_product_discount_active
    from public.products
    where id = v_product_id and active = true;

    if not found then raise exception 'Produto não encontrado ou indisponível'; end if;
    if v_quantity > v_stock then raise exception 'Estoque insuficiente para: %', v_product_name; end if;

    if v_product_discount_active and v_product_discount_percent > 0 then
      if v_product_discount_percent > 100 then raise exception 'Desconto individual inválido para: %', v_product_name; end if;
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0 then
      if v_discount_percent > 100 then raise exception 'Desconto global inválido'; end if;
      v_effective_price := round(v_product_price * (1 - v_discount_percent / 100), 2);
    else
      v_effective_price := v_product_price;
    end if;

    v_total := v_total + (v_effective_price * v_quantity);
  end loop;

  v_total := round(v_total, 2);

  insert into public.orders (customer_id, status, total, pix_name, delivery_username, tiktok_username)
  values (null, 'awaiting_payment', v_total, v_pix_name, v_roblox, v_tiktok)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select name, price, coalesce(discount_percent, 0), coalesce(discount_active, false)
      into v_product_name, v_product_price, v_product_discount_percent, v_product_discount_active
    from public.products where id = v_product_id and active = true;

    if v_product_discount_active and v_product_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_discount_percent / 100), 2);
    else
      v_effective_price := v_product_price;
    end if;

    insert into public.order_items (order_id, product_id, product_name, product_price, quantity)
    values (v_order_id, v_product_id, v_product_name, v_effective_price, v_quantity);
  end loop;

  insert into public.payments (order_id, method, pix_name, status)
  values (v_order_id, 'pix', v_pix_name, 'pending');

  return jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total, 'status', 'awaiting_payment');
end;
$$;

revoke all on function public.create_guest_order(jsonb, text, text, text) from public;
grant execute on function public.create_guest_order(jsonb, text, text, text) to anon;

-- 4) O cliente sem conta avisa que já fez o Pix.
drop function if exists public.request_guest_payment_verification(uuid);
create or replace function public.request_guest_payment_verification(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.orders
     set status = 'awaiting_verification', updated_at = now()
   where id = p_order_id and status = 'awaiting_payment';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    if exists(select 1 from public.orders where id = p_order_id and status = 'awaiting_verification') then
      return jsonb_build_object('success', true, 'status', 'awaiting_verification');
    end if;
    raise exception 'Pedido não encontrado ou não está aguardando pagamento';
  end if;
  return jsonb_build_object('success', true, 'status', 'awaiting_verification');
end;
$$;

revoke all on function public.request_guest_payment_verification(uuid) from public;
grant execute on function public.request_guest_payment_verification(uuid) to anon;

-- 5) Votos de avaliações sem login, usando um identificador aleatório salvo somente no navegador.
create table if not exists public.review_guest_helpful_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  voter_token text not null,
  created_at timestamptz not null default now(),
  constraint review_guest_helpful_votes_unique unique (review_id, voter_token)
);

alter table public.review_guest_helpful_votes enable row level security;
revoke all on table public.review_guest_helpful_votes from anon, authenticated;

drop function if exists public.get_guest_review_helpfulness(uuid[], text);
create or replace function public.get_guest_review_helpfulness(p_review_ids uuid[], p_voter_token text)
returns table(review_id uuid, helpful_count bigint, user_voted boolean)
language sql stable security definer set search_path = public
as $$
  select r.review_id,
         count(v.id)::bigint as helpful_count,
         coalesce(bool_or(v.voter_token = p_voter_token), false) as user_voted
    from unnest(p_review_ids) as r(review_id)
    left join public.review_guest_helpful_votes v on v.review_id = r.review_id
   group by r.review_id;
$$;
revoke all on function public.get_guest_review_helpfulness(uuid[], text) from public;
grant execute on function public.get_guest_review_helpfulness(uuid[], text) to anon, authenticated;

drop function if exists public.toggle_guest_review_helpful(uuid, text);
create or replace function public.toggle_guest_review_helpful(p_review_id uuid, p_voter_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_exists boolean;
  v_count bigint;
begin
  if p_voter_token is null or length(trim(p_voter_token)) < 8 then raise exception 'Identificador de voto inválido'; end if;
  if not exists(select 1 from public.reviews where id = p_review_id and status = 'approved') then raise exception 'Avaliação não encontrada'; end if;
  select exists(select 1 from public.review_guest_helpful_votes where review_id=p_review_id and voter_token=p_voter_token) into v_exists;
  if v_exists then
    delete from public.review_guest_helpful_votes where review_id=p_review_id and voter_token=p_voter_token;
  else
    insert into public.review_guest_helpful_votes(review_id, voter_token) values(p_review_id, p_voter_token);
  end if;
  select count(*) into v_count from public.review_guest_helpful_votes where review_id=p_review_id;
  return jsonb_build_object('success', true, 'review_id', p_review_id, 'helpful_count', v_count, 'user_voted', not v_exists);
end;
$$;
revoke all on function public.toggle_guest_review_helpful(uuid, text) from public;
grant execute on function public.toggle_guest_review_helpful(uuid, text) to anon, authenticated;

-- Observação: o admin continua usando Supabase Auth normalmente. Só o cliente deixou de usar login/e-mail.
