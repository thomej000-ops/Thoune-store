
const KEY = "thoune-cart-v2";


/* =========================================================
   CARREGAR CARRINHO
========================================================= */

export function loadCart() {
  try {
    const saved =
      localStorage.getItem(KEY);

    if (!saved) {
      return [];
    }

    const cart =
      JSON.parse(saved);

    if (!Array.isArray(cart)) {
      return [];
    }

    return cart
      .filter(item =>
        item &&
        item.id &&
        item.name &&
        Number(item.qty) > 0
      )
      .map(item => ({
        id: item.id,
        name: String(item.name),
        price: Number(item.price) || 0,
        original_price:
          item.original_price != null
            ? Number(item.original_price) || Number(item.price) || 0
            : Number(item.price) || 0,
        discount_percent: Number(item.discount_percent) || 0,
        image: item.image
          ? String(item.image)
          : "",
        qty: Math.max(
          1,
          Math.floor(
            Number(item.qty) || 1
          )
        )
      }));

  } catch {
    return [];
  }
}


/* =========================================================
   SALVAR CARRINHO
========================================================= */

export function saveCart(cart) {
  if (!Array.isArray(cart)) {
    return;
  }

  localStorage.setItem(
    KEY,
    JSON.stringify(cart)
  );
}


/* =========================================================
   ADICIONAR AO CARRINHO
========================================================= */

export function addToCart(product) {
  if (!product || !product.id) {
    return loadCart();
  }

  const cart =
    loadCart();

  const found =
    cart.find(
      item =>
        String(item.id) ===
        String(product.id)
    );


  if (found) {
    found.qty =
      Math.max(
        1,
        Number(found.qty) + 1
      );

  } else {
    const price =
      Number(product.price) || 0;

    const originalPrice =
      product.original_price != null
        ? Number(product.original_price) || price
        : price;


    cart.push({
      id: product.id,
      name:
        String(
          product.name ||
          "Produto"
        ),
      price,
      original_price:
        originalPrice,
      discount_percent: Number(product.discount_percent) || 0,
      image:
        product.image
          ? String(product.image)
          : "",
      qty: 1
    });
  }


  saveCart(cart);

  return cart;
}


/* =========================================================
   ALTERAR QUANTIDADE
========================================================= */

export function changeQty(
  id,
  delta
) {
  const cart =
    loadCart();

  const item =
    cart.find(
      product =>
        String(product.id) ===
        String(id)
    );


  if (!item) {
    return cart;
  }


  const amount =
    Number(delta);


  if (!Number.isFinite(amount)) {
    return cart;
  }


  item.qty =
    Number(item.qty) + amount;


  const next =
    cart.filter(
      product =>
        Number(product.qty) > 0
    );


  saveCart(next);

  return next;
}


/* =========================================================
   REMOVER ITEM
========================================================= */

export function removeFromCart(id) {
  const next =
    loadCart().filter(
      item =>
        String(item.id) !==
        String(id)
    );


  saveCart(next);

  return next;
}


/* =========================================================
   LIMPAR CARRINHO
========================================================= */

export function clearCart() {
  saveCart([]);

  return [];
}


/* =========================================================
   QUANTIDADE TOTAL
========================================================= */

export function cartCount(
  cart = loadCart()
) {
  if (!Array.isArray(cart)) {
    return 0;
  }

  return cart.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        Number(item.qty) || 0
      ),
    0
  );
}


/* =========================================================
   TOTAL DO CARRINHO
========================================================= */

export function cartTotal(
  cart = loadCart()
) {
  if (!Array.isArray(cart)) {
    return 0;
  }

  return cart.reduce(
    (sum, item) => {
      const price =
        Number(item.price) || 0;

      const qty =
        Number(item.qty) || 0;

      return sum +
        (price * qty);
    },
    0
  );
}


/* =========================================================
   TEXTO DO PEDIDO
========================================================= */

export function orderText(
  cart = loadCart()
) {
  if (!Array.isArray(cart) || !cart.length) {
    return "◫ Pedido — Thoune Store\n\nNenhum item no carrinho.";
  }


  const lines =
    cart.map(item =>
      `• ${item.name} ×${item.qty} — ${money(
        (Number(item.price) || 0) *
        (Number(item.qty) || 0)
      )}`
    );


  return [
    "◫ Pedido — Thoune Store",
    "",
    ...lines,
    "",
    `◇ Total: ${money(
      cartTotal(cart)
    )}`
  ].join("\n");
}


/* =========================================================
   FORMATAÇÃO DE DINHEIRO
========================================================= */

export function money(value) {
  return Number(
    value || 0
  ).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}
