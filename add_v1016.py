from pathlib import Path
import re, zipfile, shutil
root=Path('/mnt/data/work/v1015')

# app.js
p=root/'app.js'; s=p.read_text()
s=s.replace('href="./styles.css?v=1015"', 'href="./styles.css?v=1016"') if p.name=='index.html' else s
# replace pricing helpers
old='''function getEffectivePrice(price) {\n  const value = Number(price) || 0;\n\n  if (!storeSettings.discount_active) {\n    return value;\n  }\n\n  const discount = Number(storeSettings.discount_percent) || 0;\n\n  if (discount <= 0) {\n    return value;\n  }\n\n  return Math.max(\n    0,\n    value * (1 - discount / 100)\n  );\n}\n\nfunction getProductPrice(product) {\n  return getEffectivePrice(product?.price);\n}\n'''
new='''function getDiscountPercent(product) {\n  const individualActive = Boolean(product?.discount_active);\n  const individual = Number(product?.discount_percent) || 0;\n\n  if (individualActive && individual > 0) {\n    return Math.min(100, individual);\n  }\n\n  if (storeSettings.discount_active) {\n    return Math.min(100, Number(storeSettings.discount_percent) || 0);\n  }\n\n  return 0;\n}\n\nfunction getEffectivePrice(price, discountPercent = 0) {\n  const value = Number(price) || 0;\n  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));\n\n  if (discount <= 0) return value;\n  return Math.max(0, Math.round(value * (1 - discount / 100) * 100) / 100);\n}\n\nfunction getProductPrice(product) {\n  return getEffectivePrice(product?.price, getDiscountPercent(product));\n}\n'''
assert old in s
s=s.replace(old,new)
# theme emoji
s=s.replace('if (icon) icon.textContent = "";', 'if (icon) icon.textContent = light ? "☀️" : "🌙";')
# render catalog discount calculation
old='''  const discountPercent = Number(storeSettings.discount_percent) || 0;\n  const displayProducts = filtered.map(product => {\n    const originalPrice = Number(product.price) || 0;\n    const price = getProductPrice(product);\n    return {\n      ...product,\n      price,\n      original_price: originalPrice,\n      discount_percent: storeSettings.discount_active && price < originalPrice ? discountPercent : 0\n    };\n  });'''
new='''  const displayProducts = filtered.map(product => {\n    const originalPrice = Number(product.price) || 0;\n    const discountPercent = getDiscountPercent(product);\n    const price = getEffectivePrice(originalPrice, discountPercent);\n    return {\n      ...product,\n      price,\n      original_price: originalPrice,\n      discount_percent: discountPercent\n    };\n  });'''
assert old in s
s=s.replace(old,new)
# add handler price/discount
old='''            price: getProductPrice(product),\n            original_price:\n              Number(product.price) || 0,\n            image: product.image || "",\n            qty: 1'''
new='''            price: getProductPrice(product),\n            original_price:\n              Number(product.price) || 0,\n            discount_percent: getDiscountPercent(product),\n            image: product.image || "",\n            qty: 1'''
assert old in s
s=s.replace(old,new)
# remove product card click delegation
old='''    const productButton =\n      event.target.closest("[data-product-id]");\n\n    if (\n      productButton &&\n      !event.target.closest(\n        "button[data-product-add], [data-favorite]"\n      )\n    ) {\n      openProductModal(\n        productButton.dataset.productId\n      );\n\n      return;\n    }\n'''
assert old in s
s=s.replace(old,'')
# checkout display discount
old='''  container.innerHTML = cart.map(item => `\n    <div class="checkout-item">\n      <span>\n        ${escapeHtml(item.name)} ×${Number(item.qty) || 1}\n      </span>\n\n      <strong>\n        ${money(\n          (Number(item.price) || 0) *\n          (Number(item.qty) || 0)\n        )}\n      </strong>\n    </div>\n  `).join("");'''
new='''  container.innerHTML = cart.map(item => {\n    const qty = Number(item.qty) || 1;\n    const price = Number(item.price) || 0;\n    const original = Number(item.original_price ?? price) || price;\n    const hasDiscount = original > price + 0.001;\n    const percent = Number(item.discount_percent) || (hasDiscount ? Math.round((1 - price / original) * 100) : 0);\n    return `\n      <div class="checkout-item">\n        <span>\n          ${escapeHtml(item.name)} ×${qty}\n          ${hasDiscount ? `<small class="checkout-discount">-${percent}% OFF</small>` : ""}\n        </span>\n\n        <strong>\n          ${hasDiscount ? `<del>${money(original * qty)}</del> ` : ""}${money(price * qty)}\n        </strong>\n      </div>\n    `;\n  }).join("");'''
assert old in s
s=s.replace(old,new)
# opening effect function and call after DOM ready-ish: add near initializeTheme
insert='''\nfunction playOpeningEffect() {\n  if (sessionStorage.getItem("thoune-opening-effect-v1016")) return;\n  sessionStorage.setItem("thoune-opening-effect-v1016", "1");\n  const layer = document.createElement("div");\n  layer.className = "opening-effect";\n  layer.innerHTML = Array.from({length: 10}, (_, i) => `<span class="opening-bubble b${i+1}"></span>`).join("");\n  document.body.appendChild(layer);\n  window.setTimeout(() => layer.remove(), 1800);\n}\n'''
marker='function initializeTheme() {'
assert marker in s
s=s.replace(marker,insert+'\n'+marker)
# call effect on DOMContentLoaded hook: locate initializeTheme();
s=s.replace('initializeTheme();', 'initializeTheme();\n  playOpeningEffect();', 1)
p.write_text(s)

# cart.js add discount_percent persistence
p=root/'cart.js'; s=p.read_text()
s=s.replace('''        original_price:\n          item.original_price != null\n            ? Number(item.original_price) || Number(item.price) || 0\n            : Number(item.price) || 0,\n        image:''','''        original_price:\n          item.original_price != null\n            ? Number(item.original_price) || Number(item.price) || 0\n            : Number(item.price) || 0,\n        discount_percent: Number(item.discount_percent) || 0,\n        image:''')
s=s.replace('''      original_price:\n        originalPrice,\n      image:''','''      original_price:\n        originalPrice,\n      discount_percent: Number(product.discount_percent) || 0,\n      image:''')
p.write_text(s)

# ui.js cart discount badge and product animation hook
p=root/'ui.js'; s=p.read_text()
old='''  const hasDiscount = originalPrice > currentPrice + 0.001;\n  const lineOriginal = originalPrice * qty;'''
new='''  const hasDiscount = originalPrice > currentPrice + 0.001;\n  const discountPercent = Number(item.discount_percent) || (hasDiscount ? Math.round((1 - currentPrice / originalPrice) * 100) : 0);\n  const lineOriginal = originalPrice * qty;'''
assert old in s
s=s.replace(old,new)
s=s.replace('''          ${hasDiscount ? `<span class="cart-discount-badge">DESCONTO</span>` : ""}''','''          ${hasDiscount ? `<span class="cart-discount-badge">-${discountPercent}% OFF</span>` : ""}''')
p.write_text(s)

# index html stylesheet version and add Roblox hint, opening layer placeholder
p=root/'index.html'; s=p.read_text()
s=s.replace('styles.css?v=1015','styles.css?v=1016')
s=s.replace('''<span class="account-summary-label">ROBLOX</span>\n                  <strong id="account-roblox">—</strong>''','''<span class="account-summary-label"><span class="roblox-mini-logo">R</span> ROBLOX</span>\n                  <strong id="account-roblox">—</strong>''')
# Add opening effect marker before toast region
s=s.replace('''<body>\n\n  <!-- =====================================================\n       REGIÃO DE TOASTS''','''<body>\n\n  <!-- =====================================================\n       EFEITO DE ABERTURA\n  ====================================================== -->\n\n  <div id="opening-effect" aria-hidden="true"></div>\n\n  <!-- =====================================================\n       REGIÃO DE TOASTS''')
p.write_text(s)

# admin: add fields
p=root/'admin.html'; s=p.read_text()
s=s.replace('''          <div class="form-field">\n\n            <label for="product-stock">''','''          <div class="form-field">\n\n            <label for="product-discount-percent">\n              Desconto individual (%)\n            </label>\n\n            <input\n              id="product-discount-percent"\n              type="number"\n              min="0"\n              max="100"\n              step="0.01"\n              placeholder="Ex.: 15"\n            >\n\n          </div>\n\n\n          <div class="checkbox-field">\n\n            <input\n              id="product-discount-active"\n              type="checkbox"\n            >\n\n            <label for="product-discount-active">\n              Aplicar desconto individual\n            </label>\n\n          </div>\n\n\n          <div class="form-field">\n\n            <label for="product-stock">''')
s=s.replace('''const productStock =\n  document.querySelector("#product-stock");''','''const productStock =\n  document.querySelector("#product-stock");\n\nconst productDiscountPercent =\n  document.querySelector("#product-discount-percent");\n\nconst productDiscountActive =\n  document.querySelector("#product-discount-active");''')
s=s.replace('''    productStock.value =\n      product.stock ?? 0;''','''    productStock.value =\n      product.stock ?? 0;\n\n    productDiscountPercent.value =\n      product.discount_percent ?? 0;\n\n    productDiscountActive.checked =\n      product.discount_active === true;''')
s=s.replace('''    productStock.value = 0;\n\n    productOrder.value = 0;''','''    productStock.value = 0;\n\n    productDiscountPercent.value = 0;\n    productDiscountActive.checked = false;\n\n    productOrder.value = 0;''')
# This replacement hits closeProductForm too, desired.
# Add validation vars
s=s.replace('''    const stock =\n      Number(productStock.value);\n\n    const sortOrder =''','''    const stock =\n      Number(productStock.value);\n\n    const discountPercent =\n      Number(productDiscountPercent.value || 0);\n\n    const discountActive =\n      productDiscountActive.checked;\n\n    const sortOrder =''')
s=s.replace('''    if(\n      !Number.isInteger(stock) ||\n      stock < 0\n    ){''','''    if(\n      !Number.isInteger(stock) ||\n      stock < 0\n    ){''')
# insert discount validation before sort validation
needle='''    if(\n      !Number.isInteger(sortOrder) ||\n      sortOrder < 0\n    ){'''
replacement='''    if(\n      !Number.isFinite(discountPercent) ||\n      discountPercent < 0 ||\n      discountPercent > 100\n    ){\n\n      productFormMessage.textContent =\n        "Informe um desconto entre 0% e 100%.";\n\n      return;\n    }\n\n\n    if(\n      !Number.isInteger(sortOrder) ||\n      sortOrder < 0\n    ){'''
assert needle in s
s=s.replace(needle,replacement,1)
s=s.replace('''        stock,\n\n        sort_order:''','''        stock,\n\n        discount_percent: discountPercent,\n        discount_active: discountActive,\n\n        sort_order:''')
# display admin discount
s=s.replace('''    meta.append(\n      rarity,\n      price,\n      stock,\n      status\n    );''','''    const discount = document.createElement("span");\n    if (product.discount_active && Number(product.discount_percent) > 0) {\n      discount.textContent = `-${Number(product.discount_percent)}% OFF`;\n      discount.className = "admin-discount-badge";\n    }\n\n    meta.append(\n      rarity,\n      price,\n      stock,\n      ...(discount.textContent ? [discount] : []),\n      status\n    );''')
p.write_text(s)

# styles append overrides
p=root/'styles.css'; s=p.read_text()
css=r'''

/* =========================================================
   v1016 — EMOJIS, PRODUCT FOCUS, CART POLISH
========================================================= */
.ui-icon{
  -webkit-mask:none !important;
  mask:none !important;
  background:none !important;
  width:1.35em !important;
  height:1.35em !important;
  flex:0 0 1.35em !important;
  display:inline-grid !important;
  place-items:center !important;
  font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif !important;
  font-size:1.15em !important;
  line-height:1 !important;
  color:inherit !important;
}
.ui-icon::before{display:block !important;line-height:1 !important;}
.ui-icon-user::before{content:"👤" !important;}
.ui-icon-cart::before{content:"🛒" !important;}
.ui-icon-menu::before{content:"☰" !important;}
.ui-icon-heart::before{content:"♡" !important;}
.favorite.active .ui-icon-heart::before,.favorite-button.active .ui-icon-heart::before{content:"♥" !important;}
.ui-icon-search::before{content:"🔍" !important;}
.ui-icon-bag::before{content:"🛍️" !important;}
.ui-icon-box::before{content:"📦" !important;}
.ui-icon-card::before{content:"💳" !important;}
.ui-icon-lock::before{content:"🔒" !important;}
.ui-icon-headset::before{content:"🎧" !important;}
.ui-icon-receipt::before{content:"🧾" !important;}
.ui-icon-like::before{content:"👍" !important;}
.ui-icon-check::before{content:"✓" !important;}
.ui-icon-at::before{content:"@" !important;}
.ui-icon-game::before{content:"🎮" !important;}
.ui-icon-clipboard::before{content:"📋" !important;}
.ui-icon-spark::before{content:"✨" !important;}
.ui-icon-wave::before{content:"〰️" !important;}
.theme-icon-img{display:grid !important;place-items:center !important;font-size:20px !important;line-height:1 !important;}

/* Remove the old product-detail interaction: catalog cards are not buttons. */
.product-card{cursor:default !important;}
.product-card .product-image{cursor:default !important;}
.product-card .favorite,.product-card .add-button{cursor:pointer !important;}

/* Product images get depth and a gentle floating motion. */
.product-image{overflow:hidden !important;position:relative !important;isolation:isolate;}
.product-image img{
  filter:drop-shadow(0 18px 14px rgba(0,0,0,.42)) drop-shadow(0 0 14px rgba(83,214,229,.12)) !important;
  transform-origin:center bottom;
  animation:hammerFloat 4.8s ease-in-out infinite;
  transition:transform .28s ease,filter .28s ease;
}
.product-card:hover .product-image img{transform:translateY(-7px) rotate(-1.5deg) scale(1.035) !important;filter:drop-shadow(0 25px 18px rgba(0,0,0,.46)) drop-shadow(0 0 18px rgba(83,214,229,.20)) !important;}
@keyframes hammerFloat{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-5px) rotate(.8deg)}}
.product-card{box-shadow:0 18px 38px rgba(0,0,0,.18),0 0 0 1px rgba(100,216,229,.07) inset !important;}

/* Cart image should sit on the cart surface, not a white square. */
.cart-item-image{background:transparent !important;border-color:rgba(104,215,229,.16) !important;}
.cart-item-image img{background:transparent !important;mix-blend-mode:multiply;filter:drop-shadow(0 8px 7px rgba(0,0,0,.30));}
.cart-price-line{display:flex !important;align-items:center !important;gap:8px !important;flex-wrap:wrap !important;}
.cart-price-original{opacity:.58 !important;text-decoration:line-through !important;}
.cart-discount-badge{display:inline-flex !important;align-items:center !important;padding:4px 8px !important;border-radius:999px !important;background:rgba(75,213,171,.12) !important;border:1px solid rgba(75,213,171,.25) !important;color:#6fe1c2 !important;font-size:11px !important;font-weight:900 !important;}
.checkout-discount{display:inline-block;margin-left:7px;color:#6fe1c2;font-weight:800;}
.checkout-item del{opacity:.52;font-weight:500;margin-right:4px;}

/* Roblox identity marker in the account summary. */
.roblox-mini-logo{display:inline-grid;place-items:center;width:18px;height:18px;margin-right:4px;border-radius:4px;background:#111;color:#fff;font:900 11px/1 system-ui,sans-serif;transform:skew(-8deg);}

/* Individual discount in admin. */
.admin-discount-badge{display:inline-flex;padding:4px 7px;border-radius:999px;background:#e5faf2;color:#157a5a;font-weight:900;font-size:11px;}

/* Opening effect: subtle bubbles + glow, only once per tab. */
.opening-effect{position:fixed;inset:0;z-index:99999;pointer-events:none;overflow:hidden;background:radial-gradient(circle at 50% 46%,rgba(77,218,232,.10),transparent 38%),rgba(3,18,24,.36);animation:openingFade 1.75s ease forwards;}
.opening-bubble{position:absolute;display:block;width:var(--size,42px);height:var(--size,42px);border-radius:50%;border:1px solid rgba(126,231,241,.35);background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.22),rgba(88,220,233,.08) 42%,transparent 70%);box-shadow:0 0 26px rgba(82,216,231,.16);animation:bubbleRise 1.65s ease-out forwards;}
.b1{--size:30px;left:9%;bottom:-40px}.b2{--size:54px;left:22%;bottom:-60px;animation-delay:.08s}.b3{--size:22px;left:36%;bottom:-30px;animation-delay:.16s}.b4{--size:72px;left:51%;bottom:-80px;animation-delay:.04s}.b5{--size:35px;left:66%;bottom:-45px;animation-delay:.18s}.b6{--size:24px;left:78%;bottom:-35px;animation-delay:.12s}.b7{--size:48px;left:88%;bottom:-55px;animation-delay:.22s}.b8{--size:18px;left:44%;bottom:-25px;animation-delay:.3s}.b9{--size:28px;left:14%;bottom:-30px;animation-delay:.25s}.b10{--size:40px;left:59%;bottom:-45px;animation-delay:.32s}
@keyframes bubbleRise{0%{opacity:0;transform:translate3d(0,0,0) scale(.55)}20%{opacity:1}100%{opacity:0;transform:translate3d(0,-78vh,0) scale(1.12)}}
@keyframes openingFade{0%{opacity:1}72%{opacity:1}100%{opacity:0}}
@media(prefers-reduced-motion:reduce){.opening-effect,.opening-bubble,.product-image img{animation:none !important}.opening-effect{display:none !important}}
'''
s += css
p.write_text(s)

# SQL migration
sql=root/'supabase_v1016_individual_discounts.sql'
sql.write_text(r'''-- Thoune Store v1016 — descontos individuais por produto
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
''')

# zip final
out=Path('/mnt/data/Thoune-Store-v1016.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
    for f in root.iterdir():
        if f.is_file(): z.write(f, f.name)
print(out)
