-- Thoune Store v1172 — duas lojas independentes com um único painel.
-- Faça backup do banco antes de executar. Não apaga produtos, pedidos nem avaliações.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS game text NOT NULL DEFAULT 'ftf';
UPDATE public.products SET game = 'ftf' WHERE game IS NULL OR btrim(game) = '';
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_game_check;
ALTER TABLE public.products ADD CONSTRAINT products_game_check CHECK (game IN ('ftf','mm2'));
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check CHECK (
 (game = 'ftf' AND category IN ('Lendária','Épica','Rara','Comum','Exclusiva','Atualização')) OR
 (game = 'mm2' AND category IN ('Godly','Ancient','Chroma','Vintage','Unique','Legendary','Rare','Uncommon','Common','Seasonal'))
);

CREATE TABLE IF NOT EXISTS public.storefront_settings (
  game text PRIMARY KEY CHECK (game IN ('ftf','mm2')),
  online boolean NOT NULL DEFAULT false,
  pix_key text,
  delivery_bot_username text,
  delivery_bot_url text,
  join_open boolean NOT NULL DEFAULT true,
  discount_percent numeric NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_active boolean NOT NULL DEFAULT false,
  discount_event text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.storefront_settings (game, online, pix_key, delivery_bot_username, delivery_bot_url, join_open, discount_percent, discount_active, discount_event)
SELECT 'ftf', COALESCE(online, false), pix_key, delivery_bot_username, delivery_bot_url, COALESCE(join_open, true), COALESCE(discount_percent, 0), COALESCE(discount_active, false), discount_event
FROM public.store_settings WHERE id = 1
ON CONFLICT (game) DO NOTHING;
INSERT INTO public.storefront_settings (game, online, pix_key, delivery_bot_username, delivery_bot_url, join_open, discount_percent, discount_active, discount_event)
SELECT 'mm2', false, pix_key, delivery_bot_username, delivery_bot_url, COALESCE(join_open, true), COALESCE(discount_percent, 0), COALESCE(discount_active, false), discount_event
FROM public.store_settings WHERE id = 1
ON CONFLICT (game) DO NOTHING;
ALTER TABLE public.storefront_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS storefront_settings_public_read ON public.storefront_settings;
CREATE POLICY storefront_settings_public_read ON public.storefront_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS storefront_settings_admin_write ON public.storefront_settings;
CREATE POLICY storefront_settings_admin_write ON public.storefront_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT SELECT ON public.storefront_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.storefront_settings TO authenticated;
CREATE INDEX IF NOT EXISTS products_game_active_sort_idx ON public.products (game, active, sort_order, name);

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
  v_discount_event text := null;
  v_product_event text := null;
  v_game text := 'ftf';
  v_order_game text := null;
  v_store_online boolean := false;
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

  select coalesce(discount_percent, 0), coalesce(discount_active, false), discount_event
    into v_discount_percent, v_discount_active, v_discount_event
  from public.store_settings where id = 1;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Produto ou quantidade inválida';
    end;
    if v_quantity is null or v_quantity <= 0 then raise exception 'Quantidade inválida'; end if;

    select name, price, stock, coalesce(discount_percent, 0), coalesce(discount_active, false), event_name, coalesce(game, 'ftf')
      into v_product_name, v_product_price, v_stock, v_product_discount_percent, v_product_discount_active, v_product_event, v_game
    from public.products
    where id = v_product_id and active = true;

    if not found then raise exception 'Produto não encontrado ou indisponível'; end if;

    if v_order_game is null then
      v_order_game := v_game;
    elsif v_order_game <> v_game then
      raise exception 'Não é possível misturar produtos de lojas diferentes no mesmo pedido';
    end if;

    select online into v_store_online from public.storefront_settings where game = v_game;
    if coalesce(v_store_online, false) = false then raise exception 'A loja deste jogo está fechada no momento'; end if;
    if v_quantity > v_stock then raise exception 'Estoque insuficiente para: %', v_product_name; end if;

    if v_product_discount_active and v_product_discount_percent > 0 then
      if v_product_discount_percent > 100 then raise exception 'Desconto individual inválido para: %', v_product_name; end if;
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0 and (v_discount_event is null or v_discount_event = v_product_event) then
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

    select name, price, coalesce(discount_percent, 0), coalesce(discount_active, false), event_name
      into v_product_name, v_product_price, v_product_discount_percent, v_product_discount_active, v_product_event
    from public.products where id = v_product_id and active = true;

    if v_product_discount_active and v_product_discount_percent > 0 then
      v_effective_price := round(v_product_price * (1 - v_product_discount_percent / 100), 2);
    elsif v_discount_active and v_discount_percent > 0 and (v_discount_event is null or v_discount_event = v_product_event) then
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
REVOKE ALL ON FUNCTION public.create_guest_order(jsonb,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_order(jsonb,text,text,text) TO anon, authenticated;
COMMIT;
