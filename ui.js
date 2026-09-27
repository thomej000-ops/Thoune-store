import { loadCart, saveCart, changeQty, removeFromCart, cartCount, cartTotal, money } from "./cart.js";

const escape = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

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
  if (badge) badge.textContent = String(count);
}

export function renderProducts(products = []) {
  const container = document.querySelector("#products-grid");
  if (!container) return;

  if (!products.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = products.map(product => {
    const price = Number(product.price) || 0;
    const stock = Number(product.stock);
    const out = Number.isFinite(stock) && stock <= 0;
    const image = product.image
      ? `<img src="${escape(product.image)}" alt="${escape(product.name)}" loading="lazy">`
      : `<span class="product-image-placeholder">🔨</span>`;

    return `
      <article class="product-card" data-product-id="${escape(product.id)}">
        <div class="product-card-image">
          ${image}
          <button type="button" class="favorite-button" data-favorite="${escape(product.id)}" aria-label="Adicionar aos favoritos">♡</button>
        </div>
        <div class="product-card-content">
          <span class="product-card-category">${escape(product.category || "")}</span>
          <h3>${escape(product.name || "Produto")}</h3>
          ${product.description ? `<p>${escape(product.description)}</p>` : ""}
          <div class="product-card-bottom">
            <strong>${money(price)}</strong>
            <button type="button" class="primary-button small" data-product-add="${escape(product.id)}" ${out ? "disabled" : ""}>
              ${out ? "Esgotado" : "Adicionar"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("[data-favorite]").forEach(button => {
    const key = `thoune-fav-${button.dataset.favorite}`;
    if (localStorage.getItem(key) === "1") {
      button.textContent = "♥";
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

  return `
    <article class="cart-item" data-cart-id="${escape(item.id)}">
      <div class="cart-item-image">${image}</div>
      <div class="cart-item-info">
        <strong>${escape(item.name)}</strong>
        <span>${money(line)}</span>
        <div class="cart-quantity">
          <button type="button" data-cart-minus="${escape(item.id)}" aria-label="Diminuir quantidade">−</button>
          <b>${qty}</b>
          <button type="button" data-cart-plus="${escape(item.id)}" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
      <button type="button" class="cart-remove" data-cart-remove="${escape(item.id)}" aria-label="Remover">×</button>
    </article>
  `;
}

export function renderCart(cart = loadCart()) {
  const container = document.querySelector("#cart-items");
  if (!container) return;

  if (!cart.length) {
    container.innerHTML = `
      <div class="empty-panel">
        <strong>Seu carrinho está vazio.</strong>
        <p>Escolha suas marretas no catálogo para começar.</p>
      </div>
    `;
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
