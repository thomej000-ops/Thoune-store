import { loadCart, saveCart, changeQty, removeFromCart, cartCount, cartTotal, money } from "./cart.js";

const escape = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

// Resolve event icons consistently, whether the database stores a slug or a display name.
const eventIconFile = (value) => {
  const key = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const aliases = {
    anniversary: "anniversary", aniversario: "anniversary",
    autumn: "autumn", outono: "autumn",
    christmas: "christmas", natal: "christmas",
    clover: "clover",
    easter: "easter", pascoa: "easter",
    halloween: "halloween",
    lunar: "lunar",
    spring: "spring", primavera: "spring",
    summer: "summer", verao: "summer",
    valentines: "valentines", namorados: "valentines", "dia dos namorados": "valentines"
  };
  return aliases[key] || "";
};

export function toast(message, type = "info") {
  const region = document.querySelector("#toast-region");
  if (!region) return;

  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.textContent = message;
  region.appendChild(item);

  requestAnimationFrame(() => item.classList.add("show"));
  window.setTimeout(() => {
    item.classList.remove("show");
    window.setTimeout(() => item.remove(), 220);
  }, 2800);
}

export function updateCartBadge(cart = loadCart()) {
  const count = cartCount(cart);
  const badge = document.querySelector("#cart-count");
  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count <= 0;
    badge.setAttribute("aria-hidden", count <= 0 ? "true" : "false");
    badge.classList.toggle("is-empty", count <= 0);
  }
}

export function renderProducts(products = []) {
  const container = document.querySelector("#product-grid");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = products.map(product => {
    const price = Number(product.price) || 0;
    const image = product.image
      ? `<img src="${escape(product.image)}" alt="${escape(product.name)}" loading="lazy">`
      : `<span class="placeholder">◇</span>`;

    const originalPrice = Number(product.original_price ?? product.price) || 0;
    const discountPercent = Number(product.discount_percent) || 0;
    const hasDiscount = originalPrice > price + 0.001 && discountPercent > 0;

    return `
      <article class="product-card" data-product-id="${escape(product.id)}">
        <div class="product-image">
          ${image}
          ${hasDiscount ? `<span class="discount-badge">-${discountPercent}%</span>` : ""}
          ${eventIconFile(product.event_name) ? `<span class="event-card-badge" title="Evento: ${escape(product.event_name)}"><img src="./${eventIconFile(product.event_name)}.png" alt="Evento ${escape(product.event_name)}" loading="lazy"></span>` : ""}
        </div>

        <div class="product-info">
          <span class="rarity rarity-${escape(String(product.category || "item").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase())}">${String(product.category || "Item").toLowerCase() === "exclusiva" ? `<img class="rarity-exclusive-icon" src="./exclusive.png" alt="" loading="lazy">` : ""}${escape(product.category || "Item")}</span>
          <h3 class="product-name">${escape(product.name || "Produto")}</h3>
          ${product.description ? `<p>${escape(product.description)}</p>` : ""}

          <div class="product-bottom">
            <div class="price-block">
              ${hasDiscount ? `<span class="price-original">${money(originalPrice)}</span>` : ""}
              <strong class="price">${money(price)}</strong>
              ${hasDiscount ? `<span class="price-discount-label">${discountPercent}% OFF</span>` : ""}
            </div>

            <button type="button" class="primary-button small add-button" data-product-add="${escape(product.id)}">
              Adicionar
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-favorite]").forEach(button => {
    const key = `thoune-fav-${button.dataset.favorite}`;
    if (localStorage.getItem(key) === "1") {
      button.classList.add("active");
    }
  });
}

function cartRow(item) {
  const qty = Math.max(1, Number(item.qty) || 1);
  const line = (Number(item.price) || 0) * qty;
  const image = item.image
    ? `<img src="${escape(item.image)}" alt="${escape(item.name)}" loading="lazy">`
    : "";
  const originalPrice = Number(item.original_price ?? item.price) || 0;
  const currentPrice = Number(item.price) || 0;
  const hasDiscount = originalPrice > currentPrice + 0.001;
  const discountPercent = Number(item.discount_percent) || (hasDiscount ? Math.round((1 - currentPrice / originalPrice) * 100) : 0);
  const lineOriginal = originalPrice * qty;

  return `
    <article class="cart-item" data-cart-id="${escape(item.id)}">
      <div class="cart-item-image">${image}</div>
      <div class="cart-item-info">
        <strong>${escape(item.name)}</strong>
        <div class="cart-price-line">
          ${hasDiscount ? `<span class="cart-price-original">${money(lineOriginal)}</span>` : ""}
          <span class="cart-item-price-current">${money(line)}</span>
          ${hasDiscount ? `<span class="cart-discount-badge">-${discountPercent}% OFF</span>` : ""}
        </div>
        <div class="cart-quantity">
          <button type="button" class="cart-qty-button" data-cart-minus="${escape(item.id)}" aria-label="Diminuir quantidade">−</button>
          <b>${qty}</b>
          <button type="button" class="cart-qty-button" data-cart-plus="${escape(item.id)}" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
      <button type="button" class="cart-remove" data-cart-remove="${escape(item.id)}" aria-label="Remover">×</button>
    </article>
  `;
}

export function renderCart(cart = loadCart()) {
  const container = document.querySelector("#cart-items");
  if (!container) return;

  const emptyState = document.querySelector("#cart-empty");
  if (emptyState) {
    emptyState.classList.toggle("hidden", cart.length > 0);
    emptyState.setAttribute("aria-hidden", cart.length > 0 ? "true" : "false");
  }

  if (!cart.length) {
    container.innerHTML = "";
  } else {
    container.innerHTML = cart.map(cartRow).join("");
  }

  const total = cartTotal(cart);
  const totalElement = document.querySelector("#cart-total");
  if (totalElement) totalElement.textContent = money(total);

  const countElement = document.querySelector("#cart-items-count");
  if (countElement) countElement.textContent = `${cartCount(cart)} ${cartCount(cart) === 1 ? "item" : "itens"}`;

  container.querySelectorAll("[data-cart-plus]").forEach(button => {
    button.addEventListener("click", () => renderCart(changeQty(button.dataset.cartPlus, 1)));
  });
  container.querySelectorAll("[data-cart-minus]").forEach(button => {
    button.addEventListener("click", () => renderCart(changeQty(button.dataset.cartMinus, -1)));
  });
  container.querySelectorAll("[data-cart-remove]").forEach(button => {
    button.addEventListener("click", () => renderCart(removeFromCart(button.dataset.cartRemove)));
  });

  updateCartBadge(cart);
}
