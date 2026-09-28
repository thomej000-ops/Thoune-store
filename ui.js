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
  const container = document.querySelector("#product-grid");
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
      : `<span class="placeholder">◇</span>`;

    return `
      <article class="product-card" data-product-id="${escape(product.id)}">
        <div class="product-image">
          ${image}
          <button type="button" class="favorite" data-favorite="${escape(product.id)}" aria-label="Adicionar aos favoritos">
            <span class="ui-icon ui-icon-heart" aria-hidden="true"></span>
          </button>
        </div>

        <div class="product-info">
          <span class="rarity">${escape(product.category || "Item")}</span>
          <h3 class="product-name">${escape(product.name || "Produto")}</h3>
          ${product.description ? `<p>${escape(product.description)}</p>` : ""}

          <div class="product-bottom">
            <div>
              <strong class="price">${money(price)}</strong>
              <div class="stock">${out ? "Esgotado" : `${Number.isFinite(stock) ? stock : 0} em estoque`}</div>
            </div>

            <button type="button" class="primary-button small add-button" data-product-add="${escape(product.id)}" ${out ? "disabled" : ""}>
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

/* =========================================================
   CORREÇÕES PONTUAIS — v1012
   Somente os pontos solicitados nesta rodada.
========================================================= */

function installThouneFixes() {
  if (window.__thouneV1012Installed) return;
  window.__thouneV1012Installed = true;

  const style = document.createElement("style");
  style.id = "thoune-v1012-fixes";
  style.textContent = `
    /* TERMOS: modal sempre visível quando aberto e nunca deixa uma camada invisível travando a página */
    .modal-shell.hidden{display:none !important;}
    .modal-shell.open{display:flex !important;}
    #terms-modal{
      position:fixed !important;
      inset:0 !important;
      z-index:1000 !important;
      align-items:center !important;
      justify-content:center !important;
      padding:16px !important;
    }
    #terms-modal .modal-card,
    #terms-modal .terms-card{
      width:min(720px,calc(100vw - 28px)) !important;
      max-height:min(82vh,760px) !important;
      overflow:auto !important;
      border-radius:24px !important;
      position:relative !important;
      z-index:2 !important;
    }
    #terms-backdrop{
      position:absolute !important;
      inset:0 !important;
      z-index:0 !important;
    }

    /* PEDIDOS: cartão centralizado, responsivo e legível */
    #order-details-modal{
      padding:16px !important;
      align-items:center !important;
      justify-content:center !important;
    }
    #order-details-modal .modal-card{
      width:min(560px,calc(100vw - 28px)) !important;
      max-height:86vh !important;
      overflow:auto !important;
      border-radius:24px !important;
    }
    #order-details-modal .current-order-summary{
      width:100% !important;
      min-width:0 !important;
      overflow:visible !important;
    }
    #order-details-modal .order-number{
      display:block !important;
      overflow-wrap:anywhere !important;
      word-break:break-word !important;
      line-height:1.08 !important;
    }
    #order-details-modal .order-status{
      display:inline-flex !important;
      max-width:100% !important;
      white-space:normal !important;
    }
    .orders-list{
      grid-template-columns:1fr !important;
    }
    .orders-list > *{
      min-width:0 !important;
      overflow:hidden !important;
    }

    /* ORDENAR */
    .sort-box{
      position:relative !important;
      min-width:220px !important;
    }
    .sort-box select{
      position:relative !important;
      z-index:2 !important;
      width:100% !important;
      cursor:pointer !important;
    }
    .sort-arrow{
      pointer-events:none !important;
      z-index:3 !important;
    }

    /* LIMPAR FILTROS */
    #clear-search-button{
      min-height:44px !important;
    }

    /* MODO CLARO: contraste mais equilibrado */
    body.theme-light{
      background:
        radial-gradient(circle at 8% 8%,rgba(43,130,149,.10),transparent 28%),
        linear-gradient(180deg,#eef8fa 0%,#e7f3f5 48%,#f4fafb 100%) !important;
      color:#173942 !important;
    }
    body.theme-light .site-header{
      background:rgba(242,250,251,.96) !important;
      border-color:#bdd9df !important;
      box-shadow:0 8px 28px rgba(8,44,58,.08) !important;
    }
    body.theme-light .desktop-nav,
    body.theme-light .brand-text strong,
    body.theme-light .section-heading h2,
    body.theme-light .section-heading p:not(.eyebrow),
    body.theme-light .product-name,
    body.theme-light .product-info strong,
    body.theme-light .benefits strong,
    body.theme-light .steps h3,
    body.theme-light .faq-list summary{
      color:#173942 !important;
    }
    body.theme-light .search-box,
    body.theme-light #sort-select,
    body.theme-light .category,
    body.theme-light .product-card,
    body.theme-light .benefits article,
    body.theme-light .step-card,
    body.theme-light .review-card,
    body.theme-light .support-card,
    body.theme-light .orders-list > *,
    body.theme-light .account-menu-button,
    body.theme-light .modal-card,
    body.theme-light .drawer-panel{
      background:rgba(247,252,253,.96) !important;
      color:#173942 !important;
      border-color:#bdd9df !important;
      box-shadow:0 12px 34px rgba(8,44,58,.09) !important;
    }
    body.theme-light .search-box input,
    body.theme-light #sort-select,
    body.theme-light input,
    body.theme-light textarea{
      color:#173942 !important;
      background:transparent !important;
    }
    body.theme-light .muted,
    body.theme-light .stock,
    body.theme-light .section-heading p:not(.eyebrow),
    body.theme-light .benefits p,
    body.theme-light .steps p{
      color:#5e7b84 !important;
    }
    body.theme-light .category.active{
      color:#fff !important;
      background:linear-gradient(135deg,#082c3a,#0d4051) !important;
    }
    body.theme-light .modal-shell{
      background:rgba(5,29,36,.38) !important;
    }
  `;
  document.head.appendChild(style);

  const setOverlayLock = () => {
    const openPanels = document.querySelectorAll(
      ".modal-shell.open,.account-side-panel.open,#favorites-panel.open,#notifications-global-panel.open,#order-details-modal.open,#cart-drawer.open"
    );
    document.body.classList.toggle("overlay-lock", openPanels.length > 0);
  };

  const showTerms = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    const modal = document.querySelector("#terms-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    setOverlayLock();
  };

  const hideTerms = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    const modal = document.querySelector("#terms-modal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    setOverlayLock();
  };

  const bind = () => {
    document.querySelector("#open-terms-button")?.addEventListener("click", showTerms, true);
    document.querySelector("#close-terms")?.addEventListener("click", hideTerms, true);
    document.querySelector("#terms-backdrop")?.addEventListener("click", hideTerms, true);

    /* Limpar filtros: busca + categoria + ordenação */
    document.querySelector("#clear-search-button")?.addEventListener("click", (event) => {
      event.preventDefault();

      const search = document.querySelector("#search-input");
      const sort = document.querySelector("#sort-select");

      if (search) {
        search.value = "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }

      if (sort) {
        sort.value = "popular";
        sort.dispatchEvent(new Event("change", { bubbles: true }));
      }

      document.querySelectorAll(".category").forEach(button => {
        button.classList.toggle("active", button.dataset.category === "Todas");
      });

      document.querySelector('.category[data-category="Todas"]')?.click();
    }, true);

    /* Ao abrir meus pedidos, volta ao início da lista. */
    document.querySelector("#open-orders-panel")?.addEventListener("click", () => {
      window.setTimeout(() => {
        document.querySelector("#orders-list")?.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }, true);

    document.querySelector("#open-orders-from-floating")?.addEventListener("click", () => {
      window.setTimeout(() => {
        document.querySelector("#orders-list")?.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }, true);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const modal = document.querySelector("#terms-modal.open");
        if (modal) hideTerms(event);
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
}

installThouneFixes();
