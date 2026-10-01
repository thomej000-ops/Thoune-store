import {
  loadCart,
  orderText,
  clearCart,
  money
} from "./cart.js";

import {
  renderProducts,
  renderCart,
  updateCartBadge,
  toast
} from "./ui.js";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ============================================================
// ESTADO
// ============================================================

let products = [];
let currentUser = null;
let currentProfile = null;
let storeSettings = {
  online: false,
  pix_key: "",
  delivery_bot_username: "",
  delivery_bot_url: "",
  join_open: false,
  discount_percent: 0,
  discount_active: false
};

let currentCategory = "Todas";
let currentSearch = "";
let currentSort = "popular";
let currentReviewSort = "helpful";

let currentOrderId =
  localStorage.getItem("thoune-current-order-id") || null;

let paymentVerificationBusy = false;
let orderMonitorTimer = null;
let lastKnownOrderStatus = null;

const CURRENT_ORDER_KEY = "thoune-current-order-id";

// ============================================================
// HELPERS
// ============================================================

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setHidden(element, hidden) {
  if (!element) return;

  element.classList.toggle("hidden", hidden);
  element.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function syncOverlayLock() {
  const overlays = document.querySelectorAll(
    "#account-panel-modal, #cart-drawer, #checkout-section, #favorites-panel, #product-modal, #notifications-global-panel, #order-details-modal, #terms-modal"
  );

  const hasOpenOverlay = Array.from(overlays).some((element) =>
    element.classList.contains("open")
  );

  document.body.classList.toggle("overlay-lock", hasOpenOverlay);
}

function openPanel(element) {
  if (!element) return;

  element.classList.add("open");
  element.classList.remove("hidden");
  element.setAttribute("aria-hidden", "false");
  syncOverlayLock();
}

function closePanel(element) {
  if (!element) return;

  element.classList.remove("open");
  element.classList.add("hidden");
  element.setAttribute("aria-hidden", "true");
  syncOverlayLock();
}

function formatDate(date) {
  if (!date) return "";

  try {
    return new Date(date).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return "";
  }
}

function normalizeText(value) {
  return String(value || "").trim();
}

function setMessage(element, message = "", type = "") {
  if (!element) return;

  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }

  setHidden(element, !message);
}

function saveCurrentOrderId(id) {
  currentOrderId = id || null;

  if (currentOrderId) {
    localStorage.setItem(CURRENT_ORDER_KEY, currentOrderId);
  } else {
    localStorage.removeItem(CURRENT_ORDER_KEY);
  }
}

function clearCurrentOrderStorage() {
  saveCurrentOrderId(null);
}

function getDiscountPercent(product) {
  const individualActive = Boolean(product?.discount_active);
  const individual = Number(product?.discount_percent) || 0;

  if (individualActive && individual > 0) {
    return Math.min(100, individual);
  }

  if (storeSettings.discount_active) {
    return Math.min(100, Number(storeSettings.discount_percent) || 0);
  }

  return 0;
}

function getEffectivePrice(price, discountPercent = 0) {
  const value = Number(price) || 0;
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));

  if (discount <= 0) return value;
  return Math.max(0, Math.round(value * (1 - discount / 100) * 100) / 100);
}

function getProductPrice(product) {
  return getEffectivePrice(product?.price, getDiscountPercent(product));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================
// TEMA
// ============================================================


function playOpeningEffect() {
  if (sessionStorage.getItem("thoune-opening-effect-v1016")) return;
  sessionStorage.setItem("thoune-opening-effect-v1016", "1");
  const layer = document.createElement("div");
  layer.className = "opening-effect";
  layer.innerHTML = Array.from({length: 10}, (_, i) => `<span class="opening-bubble b${i+1}"></span>`).join("");
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1800);
}

function initializeTheme() {
  // A Thoune Store usa exclusivamente o tema escuro.
  document.body.classList.remove("theme-light");
  localStorage.removeItem("thoune-theme");
}

// ============================================================
// TERMOS
// ============================================================

function openTerms() {
  const modal = $("#terms-modal");
  if (!modal) return;
  const card = modal.querySelector(".terms-card");
  openPanel(modal);
  if (card) card.scrollTop = 0;
}

function closeTerms() {
  const modal = $("#terms-modal");
  closePanel(modal);
  syncOverlayLock();
}

// ============================================================
// STORE SETTINGS
// ============================================================

async function loadStoreSettings() {
  const { data, error } = await supabaseClient
    .from("public_store_settings")
    .select(`
      id,
      online,
      pix_key,
      delivery_bot_username,
      delivery_bot_url,
      join_open,
      discount_percent,
      discount_active,
      updated_at
    `)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar configurações da loja:", error);

    storeSettings = {
      online: false,
      pix_key: "",
      delivery_bot_username: "",
      join_open: false,
      discount_percent: 0,
      discount_active: false
    };

    updateStoreStatus();
    return;
  }

  if (data) {
    storeSettings = {
      online: Boolean(data.online),
      pix_key: data.pix_key || "",
      delivery_bot_username: data.delivery_bot_username || "",
      delivery_bot_url: data.delivery_bot_url || "",
      join_open: Boolean(data.join_open),
      discount_percent: Number(data.discount_percent) || 0,
      discount_active: Boolean(data.discount_active)
    };
  }

  updateStoreStatus();
}

function updateStoreStatus() {
  const online = Boolean(storeSettings.online);

  const statusText = online
    ? "Atendimento online"
    : "Atendimento offline";

  const serviceStatus = $("#service-status");

  if (serviceStatus) {
    const dot = serviceStatus.querySelector("span");
    const label = serviceStatus.querySelector("strong");
    if (label) label.textContent = statusText;
    if (dot) dot.classList.toggle("offline-dot", !online);
    serviceStatus.classList.toggle("offline", !online);
  }

  const headerStatus = $("#header-store-status");

  if (headerStatus) {
    const dot = headerStatus.querySelector(".status-dot");
    const text = headerStatus.querySelector(".status-text");

    if (text) {
      text.textContent = statusText;
    }

    if (dot) {
      dot.classList.toggle("offline", !online);
    }

    headerStatus.classList.toggle("offline", !online);
  }
}

// ============================================================
// PERFIL
// ============================================================

async function loadProfile() {
  if (!currentUser) {
    currentProfile = null;
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error);
    currentProfile = null;
    return;
  }

  currentProfile = data || null;

  if (currentProfile) {
    $("#tiktok-username").value =
      currentProfile.tiktok_username || "";

    $("#roblox-username").value =
      currentProfile.roblox_username || "";

  }
}

async function saveProfile(showToast = true) {
  if (!currentUser) {
    toast("Entre na sua conta primeiro.");
    return false;
  }

  const tiktokUsername =
    normalizeText($("#tiktok-username")?.value);

  const robloxUsername =
    normalizeText($("#roblox-username")?.value);

  if (!tiktokUsername || !robloxUsername) {
    setMessage(
      $("#profile-message"),
      "Preencha seu usuário do TikTok e seu usuário do Roblox.",
      "error"
    );

    return false;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      tiktok_username: tiktokUsername,
      roblox_username: robloxUsername
    })
    .eq("id", currentUser.id);

  if (error) {
    console.error(error);

    setMessage(
      $("#profile-message"),
      error.message || "Não foi possível salvar seu perfil.",
      "error"
    );

    return false;
  }

  await loadProfile();

  setMessage(
    $("#profile-message"),
    "Perfil salvo com sucesso.",
    "success"
  );

  if (showToast) {
    toast("Perfil atualizado.");
  }

  return true;
}

async function saveProfileFromProfilePanel() {
  if (!currentUser) return;

  const tiktokUsername =
    normalizeText($("#profile-panel-tiktok")?.value);

  const robloxUsername =
    normalizeText($("#profile-panel-roblox")?.value);

  if (!tiktokUsername || !robloxUsername) {
    setMessage(
      $("#profile-panel-message"),
      "Preencha os dois usuários.",
      "error"
    );

    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      tiktok_username: tiktokUsername,
      roblox_username: robloxUsername
    })
    .eq("id", currentUser.id);

  if (error) {
    setMessage(
      $("#profile-panel-message"),
      error.message || "Erro ao salvar perfil.",
      "error"
    );

    return;
  }

  await loadProfile();

  setMessage(
    $("#profile-panel-message"),
    "Perfil atualizado com sucesso.",
    "success"
  );

  updateAccountUI();
}

// ============================================================
// CONTA
// ============================================================

function updateAccountUI() {
  const accountMessage = $("#account-message");
  const profileFields = $("#profile-fields");
  const accountDetails = $("#account-details");
  const accountForm = $("#account-form");
  const logoutButton = $("#logout-button");

  if (!currentUser) {
    if (accountForm) {
      accountForm.classList.remove("hidden");
    }

    setHidden(profileFields, true);
    setHidden(accountDetails, true);
    setHidden(logoutButton, true);

    if (accountMessage) {
      accountMessage.textContent =
        "Entre ou crie sua conta para acompanhar seus pedidos.";
    }

    return;
  }

  if (accountForm) {
    accountForm.classList.add("hidden");
  }

  setHidden(profileFields, false);
  setHidden(accountDetails, false);
  setHidden(logoutButton, false);

  if (accountMessage) {
    accountMessage.textContent = "Você está conectado.";
  }

  const accountTikTok = $("#account-email");
  const accountRoblox = $("#account-roblox");

  if (accountTikTok) {
    accountTikTok.textContent = currentProfile?.tiktok_username
      ? `@${String(currentProfile.tiktok_username).replace(/^@/, "")}`
      : "Não informado";
  }

  if (accountRoblox) {
    accountRoblox.textContent = currentProfile?.roblox_username || "Não informado";
  }

  $("#tiktok-username").value =
    currentProfile?.tiktok_username || "";

  $("#roblox-username").value =
    currentProfile?.roblox_username || "";

}

async function openAccountPanel() {
  $("#account-details")?.classList.remove("subpanel-open");
  closeAccountSubpanels();
  openPanel($("#account-panel-modal"));

  if (currentUser) {
    await loadProfile();
    updateAccountUI();
  }
}

function closeAccountPanel() {
  $("#account-details")?.classList.remove("subpanel-open");
  closeAccountSubpanels();
  closePanel($("#account-panel-modal"));
}

// ============================================================
// AUTH
// ============================================================

async function login() {
  const email = normalizeText($("#auth-email")?.value);
  const password = $("#auth-password")?.value || "";

  if (!email || !password) {
    setMessage(
      $("#account-message"),
      "Preencha e-mail e senha.",
      "error"
    );

    return;
  }

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    setMessage(
      $("#account-message"),
      error.message || "Não foi possível entrar.",
      "error"
    );

    return;
  }

  setMessage(
    $("#account-message"),
    "Login realizado com sucesso.",
    "success"
  );

  toast("Bem-vindo à Thoune Store.");
}

async function signup() {
  const email = normalizeText($("#auth-email")?.value);
  const password = $("#auth-password")?.value || "";

  if (!email || !password) {
    setMessage(
      $("#account-message"),
      "Preencha e-mail e senha.",
      "error"
    );

    return;
  }

  if (password.length < 6) {
    setMessage(
      $("#account-message"),
      "A senha precisa ter pelo menos 6 caracteres.",
      "error"
    );

    return;
  }

  const { error } =
    await supabaseClient.auth.signUp({
      email,
      password
    });

  if (error) {
    setMessage(
      $("#account-message"),
      error.message || "Não foi possível criar a conta.",
      "error"
    );

    return;
  }

  setMessage(
    $("#account-message"),
    "Conta criada. Se o Supabase solicitar confirmação de e-mail, confirme antes de entrar.",
    "success"
  );
}

async function logout() {
  await supabaseClient.auth.signOut();

  currentUser = null;
  currentProfile = null;

  closeAllPanels();

  toast("Você saiu da conta.");
}

async function initializeAuth() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  currentUser = session?.user || null;

  if (currentUser) {
    await loadProfile();
  }

  updateAccountUI();

  supabaseClient.auth.onAuthStateChange((event, session) => {
    setTimeout(async () => {
      currentUser = session?.user || null;

      if (currentUser) {
        await loadProfile();
      } else {
        currentProfile = null;
      }

      updateAccountUI();

      if (currentUser) {
        await loadCurrentOrder();
      }
    }, 0);
  });
}

// ============================================================
// PRODUTOS
// ============================================================

async function loadProducts() {
  setHidden($("#catalog-loading"), false);
  setHidden($("#empty-state"), true);

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  setHidden($("#catalog-loading"), true);

  if (error) {
    console.error("Erro ao carregar produtos:", error);

    products = [];

    $("#catalog-count").textContent =
      "Não foi possível carregar o catálogo.";

    setHidden($("#empty-state"), false);

    return;
  }

  products = Array.isArray(data) ? data : [];

  renderCatalog();
}

function getFilteredProducts() {
  let result = [...products];

  if (currentCategory !== "Todas") {
    result = result.filter(
      product =>
        String(product.category || "").toLowerCase() ===
        currentCategory.toLowerCase()
    );
  }

  if (currentSearch) {
    const query = currentSearch.toLowerCase();

    result = result.filter(product => {
      const name =
        String(product.name || "").toLowerCase();

      const rarity =
        String(product.category || "").toLowerCase();

      return (
        name.includes(query) ||
        rarity.includes(query)
      );
    });
  }

  if (currentSort === "low") {
    result.sort(
      (a, b) =>
        getProductPrice(a) - getProductPrice(b)
    );
  } else if (currentSort === "high") {
    result.sort(
      (a, b) =>
        getProductPrice(b) - getProductPrice(a)
    );
  } else {
    result.sort(
      (a, b) =>
        Number(a.sort_order || 0) -
        Number(b.sort_order || 0)
    );
  }

  return result;
}

function renderCatalog() {
  const filtered = getFilteredProducts();

  if ($("#catalog-count")) {
    $("#catalog-count").textContent =
      `${filtered.length} ${filtered.length === 1 ? "item" : "itens"}`;
  }

  const displayProducts = filtered.map(product => {
    const originalPrice = Number(product.price) || 0;
    const discountPercent = getDiscountPercent(product);
    const price = getEffectivePrice(originalPrice, discountPercent);
    return {
      ...product,
      price,
      original_price: originalPrice,
      discount_percent: discountPercent
    };
  });

  renderProducts(displayProducts);

  setHidden(
    $("#empty-state"),
    filtered.length !== 0
  );
}

function resetCatalogFilters() {
  currentCategory = "Todas";
  currentSearch = "";
  currentSort = "popular";

  const search = $("#search-input");
  const sort = $("#sort-select");

  if (search) search.value = "";
  if (sort) sort.value = "popular";
  const sortTrigger = $("#sort-trigger");
  if (sortTrigger) sortTrigger.textContent = "Mais populares";
  $("#sort-options")?.querySelectorAll("[data-sort-value]").forEach(item => item.classList.toggle("active", item.dataset.sortValue === "popular"));

  $$(".category").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === "Todas"
    );
  });

  renderCatalog();
}

// ============================================================
// FAVORITOS
// ============================================================

function favoriteKey(id) {
  return `thoune-fav-${id}`;
}

function isFavorite(id) {
  return localStorage.getItem(favoriteKey(id)) === "1";
}

function toggleFavorite(id) {
  const key = favoriteKey(id);

  if (isFavorite(id)) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, "1");
  }

  renderCatalog();
  renderFavoritesPanel();
}

function getFavoriteProducts() {
  return products.filter(product =>
    isFavorite(product.id)
  );
}

function renderFavoritesPanel() {
  const container = $("#favorites-list");

  if (!container) return;

  const favorites = getFavoriteProducts();

  if (!favorites.length) {
    container.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhum favorito ainda.</strong>
        <p>Toque no coração de uma marreta para adicioná-la aos favoritos.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = favorites.map(product => {
    const price = getProductPrice(product);

    return `
      <article class="favorite-item">
        <div class="favorite-item-image">
          ${
            product.image
              ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">`
              : ""
          }
        </div>

        <div class="favorite-item-info">
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.category || "")}</span>
          <b>${money(price)}</b>
        </div>

        <button
          type="button"
          class="favorite-remove"
          data-favorite-remove="${escapeHtml(product.id)}"
          aria-label="Remover dos favoritos"
        >
          <span class="ui-icon ui-icon-heart" aria-hidden="true"></span>
        </button>
      </article>
    `;
  }).join("");
}

function renderAccountFavorites() {
  const container = $("#account-favorites-list");

  if (!container) return;

  const favorites = getFavoriteProducts();

  if (!favorites.length) {
    container.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhum favorito.</strong>
        <p>Suas marretas favoritas aparecerão aqui.</p>
      </div>
    `;

    return;
  }

  container.innerHTML = favorites.map(product => `
    <div class="account-favorite-row">
      <div class="account-favorite-thumb">
        ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">` : `<span class="ui-icon ui-icon-box" aria-hidden="true"></span>`}
      </div>
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.category || "Item")}</small>
      </div>
      <strong>${money(getProductPrice(product))}</strong>
    </div>
  `).join("");
}

// ============================================================
// MODAL DE PRODUTO
// ============================================================

function openProductModal(productId) {
  const product = products.find(
    item => String(item.id) === String(productId)
  );

  if (!product) return;

  const modal = $("#product-modal");
  const content = $("#product-modal-content");

  if (!modal || !content) return;

  const price = getProductPrice(product);
  const original = Number(product.price) || 0;

  content.innerHTML = `
    <div class="product-detail">
      ${
        product.image
          ? `
            <div class="product-detail-image">
              <img
                src="${escapeHtml(product.image)}"
                alt="${escapeHtml(product.name)}"
              >
            </div>
          `
          : ""
      }

      <div class="product-detail-info">
        <span class="product-detail-category">
          ${escapeHtml(product.category || "")}
        </span>

        <h2>${escapeHtml(product.name)}</h2>

        <div class="product-detail-price">
          <strong>${money(price)}</strong>

          ${
            storeSettings.discount_active &&
            price < original
              ? `<span class="product-detail-original">${money(original)}</span>
                 <span class="product-detail-discount">-${Number(storeSettings.discount_percent) || 0}%</span>`
              : ""
          }
        </div>

        ${
          product.description
            ? `<p>${escapeHtml(product.description)}</p>`
            : ""
        }

        <button
          type="button"
          class="primary-button"
          data-product-add="${escapeHtml(product.id)}"
        >
          Adicionar ao carrinho
        </button>
      </div>
    </div>
  `;

  openPanel(modal);
}

// ============================================================
// CARRINHO
// ============================================================

function syncCartUI() {
  const cart = loadCart();

  updateCartBadge(cart);

  const count = cart.reduce(
    (sum, item) =>
      sum + Math.max(0, Number(item.qty) || 0),
    0
  );

  if ($("#cart-count")) {
    $("#cart-count").textContent = String(count);
  }
}

function openCart() {
  renderCart(loadCart());
  syncCartUI();

  openPanel($("#cart-drawer"));
}

function closeCart() {
  closePanel($("#cart-drawer"));
}

function copyOrderText() {
  const cart = loadCart();

  if (!cart.length) {
    toast("O carrinho está vazio.");
    return;
  }

  navigator.clipboard
    .writeText(orderText(cart))
    .then(() => toast("Pedido copiado."))
    .catch(() => toast("Não foi possível copiar."));
}

function clearShoppingCart() {
  clearCart();
  renderCart([]);
  syncCartUI();
  toast("Carrinho limpo.");
}

// ============================================================
// CHECKOUT
// ============================================================

async function openCheckout() {
  const cart = loadCart();

  if (!cart.length) {
    toast("Adicione pelo menos uma marreta ao carrinho.");
    return;
  }

  if (!currentUser) {
    toast("Entre na sua conta para continuar.");
    openAccountPanel();
    return;
  }

  if (!storeSettings.online) {
    toast("O atendimento está offline no momento.");
    return;
  }

  await loadProfile();

  if (
    !currentProfile?.tiktok_username ||
    !currentProfile?.roblox_username
  ) {
    toast("Complete seu perfil antes de finalizar o pedido.");
    openAccountPanel();
    return;
  }

  renderCheckout();

  openPanel($("#checkout-section"));
}

function renderCheckout() {
  const cart = loadCart();
  const container = $("#checkout-items");

  if (!container) return;

  container.innerHTML = cart.map(item => {
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const original = Number(item.original_price ?? price) || price;
    const hasDiscount = original > price + 0.001;
    const percent = Number(item.discount_percent) || (hasDiscount ? Math.round((1 - price / original) * 100) : 0);
    return `
      <div class="checkout-item">
        <span>
          ${escapeHtml(item.name)} ×${qty}
          ${hasDiscount ? `<small class="checkout-discount">-${percent}% OFF</small>` : ""}
        </span>

        <strong>
          ${hasDiscount ? `<del>${money(original * qty)}</del> ` : ""}${money(price * qty)}
        </strong>
      </div>
    `;
  }).join("");

  const total = cart.reduce(
    (sum, item) =>
      sum +
      (Number(item.price) || 0) *
      (Number(item.qty) || 0),
    0
  );

  if ($("#checkout-total")) {
    $("#checkout-total").textContent = money(total);
  }

  if ($("#checkout-pix-key")) {
    $("#checkout-pix-key").textContent =
      storeSettings.pix_key || "Pix indisponível";
  }

  $("#checkout-tiktok").value =
    currentProfile?.tiktok_username || "";

  $("#checkout-roblox").value =
    currentProfile?.roblox_username || "";

  $("#checkout-pix-name").value = "";

  setMessage($("#checkout-message"), "");
}

async function createOrder() {
  if (!currentUser) {
    toast("Entre na sua conta primeiro.");
    return;
  }

  if (!storeSettings.online) {
    setMessage(
      $("#checkout-message"),
      "A loja está offline no momento.",
      "error"
    );

    return;
  }

  const cart = loadCart();

  if (!cart.length) {
    setMessage(
      $("#checkout-message"),
      "Seu carrinho está vazio.",
      "error"
    );

    return;
  }

  const tiktokUsername =
    normalizeText($("#checkout-tiktok")?.value);

  const robloxUsername =
    normalizeText($("#checkout-roblox")?.value);

  const pixName =
    normalizeText($("#checkout-pix-name")?.value);

  if (!tiktokUsername || !robloxUsername || !pixName) {
    setMessage(
      $("#checkout-message"),
      "Preencha TikTok, Roblox e nome usado no Pix.",
      "error"
    );

    return;
  }

  const items = cart.map(item => ({
    product_id: item.id,
    quantity: Math.max(1, Math.floor(Number(item.qty) || 1))
  }));

  const button = $("#confirm-order-button");

  if (button) {
    button.disabled = true;
  }

  setMessage(
    $("#checkout-message"),
    "Criando seu pedido..."
  );

  const { data, error } =
    await supabaseClient.rpc("create_order", {
      p_items: items,
      p_pix_name: pixName,
      p_delivery_username: robloxUsername
    });

  if (button) {
    button.disabled = false;
  }

  if (error) {
    console.error("create_order:", error);

    setMessage(
      $("#checkout-message"),
      error.message || "Não foi possível criar o pedido.",
      "error"
    );

    return;
  }

  const orderId =
    typeof data === "string"
      ? data
      : data?.order_id || data?.id;

  if (!orderId) {
    console.error("Resposta inesperada do create_order:", data);

    setMessage(
      $("#checkout-message"),
      "O pedido foi processado, mas não foi possível identificar seu código.",
      "error"
    );

    return;
  }

  saveCurrentOrderId(orderId);

  clearCart();
  syncCartUI();

  setMessage(
    $("#checkout-message"),
    "Pedido criado. Faça o pagamento via Pix para continuar.",
    "success"
  );

  // Depois de criar o pedido, abrimos diretamente o painel do pedido.
  // Assim o cliente encontra imediatamente a ação de verificar o pagamento.
  await loadCurrentOrder();
  await loadCustomerOrders();

  if (orderId) {
    closePanel($("#checkout-section"));
    await openOrderDetails(orderId);
  }

  toast("Pedido criado com sucesso.");
}

async function requestPaymentVerification(orderId = currentOrderId) {
  if (!orderId || paymentVerificationBusy) return;
  paymentVerificationBusy = true;
  const button = document.querySelector(`[data-order-verify="${String(orderId).replaceAll('"','\"')}"]`);
  const originalText = button?.textContent || "Já paguei — verificar pagamento";
  if (button) {
    button.disabled = true;
    button.textContent = "Enviando…";
    button.setAttribute("aria-busy", "true");
  }
  try {
    const { error } = await supabaseClient.rpc("request_payment_verification", { p_order_id: orderId });
    if (error) {
      console.error(error);
      toast(error.message || "Não foi possível solicitar a verificação.", "error");
      return;
    }
    saveCurrentOrderId(orderId);
    lastKnownOrderStatus = "awaiting_verification";
    toast("Pagamento enviado para verificação.");
    // Atualização imediata da interface, sem exigir vários cliques.
    await openOrderDetails(orderId);
    await loadCustomerOrders();
    await loadCurrentOrder();
  } finally {
    paymentVerificationBusy = false;
    const refreshed = document.querySelector(`[data-order-verify="${String(orderId).replaceAll('"','\"')}"]`);
    if (refreshed) {
      refreshed.disabled = false;
      refreshed.removeAttribute("aria-busy");
      refreshed.textContent = originalText;
    }
  }
}

function copyPixKey() {
  const key = storeSettings.pix_key;

  if (!key) {
    toast("A chave Pix não está disponível.");
    return;
  }

  navigator.clipboard
    .writeText(key)
    .then(() => toast("Chave Pix copiada."))
    .catch(() => toast("Não foi possível copiar."));
}

// ============================================================
// PEDIDOS
// ============================================================

const statusLabels = {
  awaiting_payment: "Aguardando pagamento",
  awaiting_verification: "Pagamento em verificação",
  payment_confirmed: "Pagamento confirmado",
  awaiting_delivery: "Aguardando entrega",
  delivered: "Entregue",
  cancelled: "Cancelado"
};

function getStatusLabel(status) {
  return statusLabels[status] || status || "Pedido";
}

function getStatusClass(status) {
  return `status-${String(status || "").replaceAll("_", "-")}`;
}

async function fetchOrder(orderId) {
  if (!orderId || !currentUser) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("customer_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar pedido:", error);
    return null;
  }

  return data || null;
}

async function loadCurrentOrder() {
  if (!currentUser) {
    clearCurrentOrderStorage();
    closeCurrentOrderPanel();
    return;
  }

  let order = null;

  if (currentOrderId) {
    order = await fetchOrder(currentOrderId);
  }

  if (!order) {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .eq("customer_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && Array.isArray(data)) {
      const active = data.find(item =>
        [
          "awaiting_payment",
          "awaiting_verification",
          "payment_confirmed",
          "awaiting_delivery",
          "delivered"
        ].includes(item.status)
      );

      if (active) {
        order = active;
        saveCurrentOrderId(active.id);
      }
    }
  }

  // Mantém o pedido entregue acessível para o cliente ver o agradecimento
  // e abrir a avaliação. Apenas pedidos cancelados são removidos do acompanhamento.
  if (order && order.status === "cancelled") {
    clearCurrentOrderStorage();
    closeCurrentOrderPanel();
    lastKnownOrderStatus = null;
    return;
  }

  lastKnownOrderStatus = order?.status || null;
  renderCurrentOrder(order);
}

function getDeliveryMessage(order) {
  if (!order || order.status !== "awaiting_delivery") return "";
  const botName = storeSettings.delivery_bot_username || "Bot de entrega";
  const botUrl = storeSettings.delivery_bot_url || "";
  return `
    <div class="delivery-message delivery-message-rich">
      <div class="delivery-message-title">🚚 Pagamento confirmado</div>
      <p>Seu pedido está pronto para a entrega.</p>
      <div class="delivery-info-grid">
        <div><span>Pedido</span><strong>#${escapeHtml(String(order.id).slice(0,8))}</strong></div>
        <div><span>Roblox</span><strong>${escapeHtml(order.delivery_username || "Não informado")}</strong></div>
        <div><span>Quantidade</span><strong>${escapeHtml(String(order._itemCount || "—"))}</strong></div>
      </div>
      <div class="delivery-bot-box">
        <span>🤖 Bot de entrega</span>
        <strong class="delivery-bot-username">${escapeHtml(botName)}</strong>
        <button type="button" class="secondary-button delivery-copy-bot" data-copy-bot="${escapeHtml(botName)}">📋 Copiar nome</button>
        ${storeSettings.join_open ? "<small>🟢 Join aberto</small>" : "<small>🔴 Join fechado</small>"}
        ${botUrl ? `<a class="primary-button delivery-bot-link" href="${escapeHtml(botUrl)}" target="_blank" rel="noopener noreferrer">Abrir perfil do bot</a>` : ""}
      </div>
      <p class="delivery-note">Quando receber suas marretas, confirme abaixo para fechar esta etapa.</p>
      <button type="button" class="secondary-button" data-delivery-read="${escapeHtml(order.id)}">Entendi, aguardar entrega</button>
    </div>
  `;
}

function renderCurrentOrder(order) {
  const content = $("#current-order-content");

  if (!content) return;

  if (!order) {
    content.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhum pedido em andamento.</strong>
        <p>Quando você fizer uma compra, ela aparecerá aqui.</p>
      </div>
    `;

    return;
  }

  const status = order.status;

  content.innerHTML = `
    <div class="current-order-summary">
      <span class="order-number">
        Pedido #${escapeHtml(String(order.id).slice(0, 8))}
      </span>

      <span class="order-status ${getStatusClass(status)}">
        ${escapeHtml(getStatusLabel(status))}
      </span>

      ${
        order.created_at
          ? `<small>${formatDate(order.created_at)}</small>`
          : ""
      }

      ${
        order.total != null
          ? `<strong>${money(order.total)}</strong>`
          : ""
      }

      ${getDeliveryMessage(order)}

      <button
        type="button"
        class="secondary-button"
        data-open-order-details="${escapeHtml(order.id)}"
      >
        Ver detalhes
      </button>
    </div>
  `;
}

function openCurrentOrderPanel() {
  openPanel($("#current-order-panel"));
}

function closeCurrentOrderPanel() {
  closePanel($("#current-order-panel"));
}

async function loadCustomerOrders() {
  const container = $("#orders-list");

  if (!container || !currentUser) {
    return;
  }

  setMessage($("#orders-message"), "Carregando...");

  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("customer_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);

    setMessage(
      $("#orders-message"),
      "Não foi possível carregar seus pedidos.",
      "error"
    );

    return;
  }

  setMessage($("#orders-message"), "");

  if (!data?.length) {
    container.innerHTML = `
      <div class="empty-panel">
        <strong>Você ainda não fez nenhum pedido.</strong>
      </div>
    `;

    return;
  }

  container.innerHTML = data.map(order => `
    <article class="order-card">
      <div class="order-card-top">
        <strong>
          Pedido #${escapeHtml(String(order.id).slice(0, 8))}
        </strong>

        <span class="order-status ${getStatusClass(order.status)}">
          ${escapeHtml(getStatusLabel(order.status))}
        </span>
      </div>

      <div class="order-card-info">
        ${
          order.total != null
            ? `<span>Total: <strong>${money(order.total)}</strong></span>`
            : ""
        }

        ${
          order.created_at
            ? `<span>${formatDate(order.created_at)}</span>`
            : ""
        }
      </div>

    </article>
  `).join("");
}

async function openOrderDetails(orderId) {
  const order = await fetchOrder(orderId);
  if (!order) { toast("Não foi possível encontrar esse pedido."); return; }
  const modal = $("#order-details-modal"), title = $("#order-details-title"), content = $("#order-details-content");
  if (!modal || !content) return;
  if (title) title.textContent = `Pedido #${String(order.id).slice(0,8)}`;
  const { data: items } = await supabaseClient.from("order_items").select("*").eq("order_id", order.id);
  const itemList = Array.isArray(items) ? items : [];
  order._itemCount = itemList.reduce((sum,item)=>sum+Number(item.quantity||1),0);
  content.innerHTML = `
    <div class="order-detail-status"><span class="order-status ${getStatusClass(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span>${order.created_at ? `<small>${formatDate(order.created_at)}</small>` : ""}</div>
    <div class="order-detail-items"><div class="order-detail-items-title">Suas marretas</div>${itemList.length ? itemList.map(item=>{ const name=item.product_name||item.name||"Produto"; const quantity=Number(item.quantity||item.qty||1); const price=Number(item.product_price??item.price??0); return `<div class="order-detail-item"><span>${escapeHtml(name)} ×${quantity}</span><strong>${money(price*quantity)}</strong></div>`; }).join("") : "<p>Itens do pedido não disponíveis.</p>"}</div>
    ${order.total!=null ? `<div class="order-detail-total"><span>Total</span><strong>${money(order.total)}</strong></div>` : ""}
    ${order.status==="awaiting_payment" ? `<div class="order-flow-box payment-waiting-box"><strong>💳 Aguardando pagamento</strong><p>Faça o Pix e depois toque no botão abaixo.</p><button type="button" class="primary-button" data-order-verify="${escapeHtml(order.id)}">Já paguei — verificar pagamento</button></div>` : ""}
    ${order.status==="awaiting_verification" ? `<div class="order-flow-box verification-box"><strong>⏳ Aguardando verificação</strong><p>Recebemos sua solicitação. O pagamento será conferido no painel administrativo.</p></div>` : ""}
    ${order.status==="awaiting_delivery" ? getDeliveryMessage(order) : ""}
    ${order.status==="payment_confirmed" ? `<div class="order-flow-box confirmed-box"><strong>✅ Pagamento confirmado</strong><p>Seu pagamento foi confirmado. Abrindo as informações de entrega…</p></div>` : ""}
    ${order.status==="delivered" ? `<div class="order-flow-box delivered-box"><strong>🎉 Parabéns! Sua entrega foi concluída!</strong><p>Obrigado por comprar na Thoune Store e por confiar no nosso trabalho. Esperamos que tenha gostado das suas marretas e será um prazer receber você novamente.</p><p>💙 Sua opinião é importante para nós. Conte como foi sua experiência.</p><button type="button" class="primary-button" id="open-review-after-delivery">⭐ Avaliar minha compra</button></div>` : ""}
  `;
  openPanel(modal);
  content.querySelector("[data-order-verify]")?.addEventListener("click", ()=>requestPaymentVerification(order.id));
  content.querySelector("[data-delivery-read]")?.addEventListener("click", () => {
    localStorage.setItem(`thoune-delivery-read-${order.id}`, "1");
    closePanel(modal);
    toast("Tudo certo! Vamos acompanhar seu pedido até a entrega.");
  });
  content.querySelector("[data-copy-bot]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const botUsername = button.dataset.copyBot || "";
    if (!botUsername) {
      toast("O nome do bot não está configurado.", "error");
      return;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(botUsername);
      } else {
        const helper = document.createElement("textarea");
        helper.value = botUsername;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand("copy");
        helper.remove();
        if (!copied) throw new Error("Cópia não permitida pelo navegador");
      }
      const originalText = button.textContent;
      button.textContent = "✅ Nome copiado!";
      toast("Nome do bot copiado. Agora é só colar no Roblox.");
      window.setTimeout(() => { if (button.isConnected) button.textContent = originalText; }, 1800);
    } catch (error) {
      console.error("Não foi possível copiar o nome do bot:", error);
      toast("Não foi possível copiar automaticamente. Pressione e segure o nome do bot para copiá-lo.", "error");
    }
  });
  content.querySelector("#open-review-after-delivery")?.addEventListener("click", ()=>openReviewPanel(order));
}

async function openReviewPanel(order) {
  const modal=$("#review-modal"); if(!modal) return; const form=$("#review-form"); if(form) form.dataset.orderId=order?.id||""; openPanel(modal);
}

function startOrderMonitor() {
  if(orderMonitorTimer) clearInterval(orderMonitorTimer);
  orderMonitorTimer=window.setInterval(async()=>{
    if(!currentUser) return;
    const before=lastKnownOrderStatus; await loadCurrentOrder(); const after=lastKnownOrderStatus;
    if(after && before && after!==before && (after==="payment_confirmed" || after==="awaiting_delivery" || after==="delivered")){
      await openOrderDetails(currentOrderId);
      if(after==="delivered") await openReviewPanel(await fetchOrder(currentOrderId));
    }
  },5000);
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================

async function loadNotifications() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("customer_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error(error);

    setMessage(
      $("#notifications-message"),
      "Não foi possível carregar suas notificações.",
      "error"
    );

    return;
  }

  const container = $("#notifications-list");

  if (!container) return;

  setMessage($("#notifications-message"), "");

  if (!data?.length) {
    container.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhuma notificação.</strong>
      </div>
    `;

    return;
  }

  container.innerHTML = data.map(notification => `
    <article class="notification-item">
      <strong>
        ${escapeHtml(
          notification.title ||
          notification.type ||
          "Notificação"
        )}
      </strong>

      ${
        notification.message
          ? `<p>${escapeHtml(notification.message)}</p>`
          : ""
      }

      ${
        notification.created_at
          ? `<small>${formatDate(notification.created_at)}</small>`
          : ""
      }
    </article>
  `).join("");
}

async function loadGlobalNotifications() {
  const container = $("#global-notifications-list");

  if (!container) return;

  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-panel">
        <strong>Não foi possível carregar as novidades.</strong>
      </div>
    `;

    return;
  }

  if (!data?.length) {
    container.innerHTML = `
      <div class="empty-panel">
        <strong>Nenhuma novidade no momento.</strong>
      </div>
    `;

    return;
  }

  container.innerHTML = data.map(notification => `
    <article class="notification-item">
      <strong>
        ${escapeHtml(
          notification.title ||
          "Novidade"
        )}
      </strong>

      ${
        notification.message
          ? `<p>${escapeHtml(notification.message)}</p>`
          : ""
      }

      ${
        notification.created_at
          ? `<small>${formatDate(notification.created_at)}</small>`
          : ""
      }
    </article>
  `).join("");
}

// ============================================================
// AVALIAÇÕES
// ============================================================

async function loadPublicReviews() {
  const container = $("#reviews-grid");
  const empty = $("#reviews-empty");
  if (!container) return;

  const { data, error } = await supabaseClient
    .from("reviews")
    .select("id, rating, text, created_at, tiktok_username, tiktok_avatar")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.error("Erro ao carregar avaliações:", error);
    return;
  }

  if (!data?.length) {
    container.innerHTML = "";
    setHidden(empty, false);
    return;
  }

  setHidden(empty, true);

  let helpfulMap = {};
  try {
    const ids = data.map(review => review.id);
    const { data: helpfulData, error: helpfulError } =
      await supabaseClient.rpc("get_review_helpfulness", { p_review_ids: ids });
    if (!helpfulError && Array.isArray(helpfulData)) {
      helpfulMap = Object.fromEntries(
        helpfulData.map(row => [String(row.review_id), {
          count: Number(row.helpful_count) || 0,
          voted: Boolean(row.user_voted)
        }])
      );
    }
  } catch (error) {
    console.warn("Sistema de utilidade das avaliações ainda não configurado.", error);
  }

  const enriched = data.map(review => ({
    ...review,
    helpfulCount: helpfulMap[String(review.id)]?.count || 0,
    userVoted: helpfulMap[String(review.id)]?.voted || false
  }));

  if (currentReviewSort === "recent") {
    enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (currentReviewSort === "rating") {
    enriched.sort((a, b) => Number(b.rating) - Number(a.rating) || b.helpfulCount - a.helpfulCount);
  } else {
    enriched.sort((a, b) => b.helpfulCount - a.helpfulCount || new Date(b.created_at) - new Date(a.created_at));
  }

  container.innerHTML = enriched.map(review => {
    const rating = Math.min(5, Math.max(1, Number(review.rating) || 0));
    const username = review.tiktok_username
      ? `@${String(review.tiktok_username).replace(/^@/, "")}`
      : "Cliente Thoune Store";
    const avatar = review.tiktok_avatar
      ? `<img src="${escapeHtml(review.tiktok_avatar)}" alt="" loading="lazy">`
      : `<span class="review-avatar-fallback"><span class="ui-icon ui-icon-user" aria-hidden="true"></span></span>`;

    return `
      <article class="review-card" data-review-id="${escapeHtml(review.id)}">
        <div class="review-card-top">
          <div class="review-author">
            <span class="review-avatar">${avatar}</span>
            <div><strong>${escapeHtml(username)}</strong><small>${formatDate(review.created_at)}</small></div>
          </div>
          <div class="review-rating" aria-label="${rating} de 5 estrelas">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
        </div>
        <p class="review-text">${escapeHtml(review.text || "Sem comentário.")}</p>
        <button type="button" class="review-helpful ${review.userVoted ? "active" : ""}" data-review-helpful="${escapeHtml(review.id)}" aria-pressed="${review.userVoted ? "true" : "false"}">
          <span class="review-helpful-icon"><span class="ui-icon ui-icon-like" aria-hidden="true"></span></span>
          <span>Achou útil</span>
          <b>${review.helpfulCount}</b>
        </button>
      </article>
    `;
  }).join("");
}

async function toggleReviewHelpful(reviewId) {
  if (!currentUser) {
    toast("Entre na sua conta para marcar uma avaliação como útil.");
    await openAccountPanel();
    return;
  }

  const { error } = await supabaseClient.rpc("toggle_review_helpful", {
    p_review_id: reviewId
  });

  if (error) {
    console.error("Erro ao marcar avaliação como útil:", error);
    toast("Não foi possível registrar seu voto. Verifique se a função foi criada no Supabase.", "error");
    return;
  }

  await loadPublicReviews();
}

// ============================================================
// SUBPAINÉIS DA CONTA
// ============================================================

function closeAccountSubpanels() {
  closePanel($("#orders-panel"));
  closePanel($("#notifications-panel"));
  closePanel($("#favorites-account-panel"));
}

function openAccountHome() {
  closeAccountSubpanels();
  $("#account-details")?.classList.remove("subpanel-open");
}

async function openOrdersPanel() {
  closeAccountSubpanels();
  $("#account-details")?.classList.add("subpanel-open");
  openPanel($("#orders-panel"));
  await loadCustomerOrders();
}

async function openNotificationsPanel() {
  closeAccountSubpanels();
  $("#account-details")?.classList.add("subpanel-open");
  openPanel($("#notifications-panel"));
  await loadNotifications();
}

function openAccountFavoritesPanel() {
  closeAccountSubpanels();
  $("#account-details")?.classList.add("subpanel-open");
  renderAccountFavorites();
  openPanel($("#favorites-account-panel"));
}

// ============================================================
// FECHAMENTO GLOBAL
// ============================================================

function closeAllPanels() {
  closePanel($("#account-panel-modal"));
  $("#account-details")?.classList.remove("subpanel-open");
  closePanel($("#orders-panel"));
  closePanel($("#notifications-panel"));
  closePanel($("#favorites-account-panel"));

  closePanel($("#favorites-panel"));
  closePanel($("#product-modal"));
  closePanel($("#notifications-global-panel"));

  closePanel($("#cart-drawer"));
  closePanel($("#checkout-section"));
  closePanel($("#order-details-modal"));
  closePanel($("#terms-modal"));
  closePanel($("#review-modal"));

  closeCurrentOrderPanel();
}

// ============================================================
// MENU MOBILE
// ============================================================

function toggleMobileMenu() {
  const menu = $("#mobile-nav");

  if (!menu) return;

  const isOpen = menu.classList.contains("open");

  menu.classList.toggle("open", !isOpen);
  menu.setAttribute(
    "aria-hidden",
    isOpen ? "true" : "false"
  );
}

function closeMobileMenu() {
  const menu = $("#mobile-nav");

  if (!menu) return;

  menu.classList.remove("open");
  menu.setAttribute("aria-hidden", "true");
}

// ============================================================
// EVENTOS
// ============================================================

function setupEvents() {
  $("#open-terms-button")?.addEventListener("click", openTerms);
  $("#close-terms")?.addEventListener("click", closeTerms);
  $("#terms-backdrop")?.addEventListener("click", closeTerms);

  // Conta
  $("#open-account-button")
    ?.addEventListener("click", openAccountPanel);

  $("#mobile-account-button")
    ?.addEventListener("click", async () => {
      closeMobileMenu();
      await openAccountPanel();
    });

  $("#close-account-panel")
    ?.addEventListener("click", closeAccountPanel);

  $("#login-button")
    ?.addEventListener("click", login);

  $("#signup-button")
    ?.addEventListener("click", signup);

  $("#logout-button")
    ?.addEventListener("click", logout);

  $("#save-profile-button")
    ?.addEventListener("click", () => saveProfile());

  $("#profile-panel-save")
    ?.addEventListener(
      "click",
      saveProfileFromProfilePanel
    );

  // Voltar do histórico/notificações/favoritos para o início da conta
  $$('[data-account-back]').forEach(button => {
    button.addEventListener('click', openAccountHome);
  });

  // Subpainéis
  $("#open-orders-panel")
    ?.addEventListener("click", openOrdersPanel);

  $("#open-notifications-panel")
    ?.addEventListener(
      "click",
      openNotificationsPanel
    );

  $("#open-favorites-account")
    ?.addEventListener(
      "click",
      openAccountFavoritesPanel
    );

  // Favoritos
  $("#open-favorites-panel")
    ?.addEventListener("click", () => {
      renderFavoritesPanel();
      openPanel($("#favorites-panel"));
    });

  $("#close-favorites-panel")
    ?.addEventListener(
      "click",
      () => closePanel($("#favorites-panel"))
    );

  // Carrinho
  $("#open-cart")
    ?.addEventListener("click", openCart);

  $("#close-cart-button")
    ?.addEventListener("click", closeCart);

  $("#close-cart")
    ?.addEventListener("click", closeCart);

  $("#copy-order-button")
    ?.addEventListener("click", copyOrderText);

  $("#clear-cart-button")
    ?.addEventListener(
      "click",
      clearShoppingCart
    );

  $("#checkout-button")
    ?.addEventListener("click", openCheckout);

  // Checkout
  $("#close-checkout")
    ?.addEventListener(
      "click",
      () => closePanel($("#checkout-section"))
    );

  $("#checkout-backdrop")
    ?.addEventListener(
      "click",
      () => closePanel($("#checkout-section"))
    );

  $("#checkout-back")
    ?.addEventListener(
      "click",
      () => closePanel($("#checkout-section"))
    );

  $("#copy-pix-key-button")
    ?.addEventListener("click", copyPixKey);

  $("#confirm-order-button")
    ?.addEventListener("click", createOrder);

  $("#verify-payment-button")
    ?.addEventListener(
      "click",
      () => requestPaymentVerification()
    );

  // Pedido flutuante
  $("#close-current-order-panel")
    ?.addEventListener(
      "click",
      closeCurrentOrderPanel
    );

  $("#open-orders-from-floating")
  ?.addEventListener("click", async () => {
    try {
      await openAccountPanel();
      await openOrdersPanel();
    } catch (error) {
      console.error("Erro ao abrir pedidos:", error);
      toast("Não foi possível abrir seus pedidos.", "error");
    }
  });

  // Modal produto
  $("#close-product-modal")
    ?.addEventListener(
      "click",
      () => closePanel($("#product-modal"))
    );

  $$("[data-close-product-modal]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => closePanel($("#product-modal"))
      );
    });

  // Modal pedido
  $("#close-order-details")
    ?.addEventListener(
      "click",
      () => closePanel($("#order-details-modal"))
    );

  $$("[data-close-order-details]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => closePanel($("#order-details-modal"))
      );
    });

  // Notificações globais
  $("#close-notifications-global-panel")
    ?.addEventListener(
      "click",
      () =>
        closePanel(
          $("#notifications-global-panel")
        )
    );

  // Menu mobile
  $("#menu-toggle")
    ?.addEventListener(
      "click",
      toggleMobileMenu
    );

  // Busca
  $("#search-input")
    ?.addEventListener("input", event => {
      currentSearch =
        normalizeText(event.target.value);

      renderCatalog();
    });

  $("#sort-select")
    ?.addEventListener("change", event => {
      currentSort = event.target.value;
      renderCatalog();
    });

  // Ordenação personalizada: evita o seletor nativo do Android, que
  // aparecia como uma janela do sistema sobre o catálogo.
  const sortControl = $("#sort-control");
  const sortTrigger = $("#sort-trigger");
  const sortOptions = $("#sort-options");
  const sortSelect = $("#sort-select");
  const sortLabels = { popular: "Mais populares", low: "Menor preço", high: "Maior preço" };
  const closeSortOptions = () => {
    if (!sortOptions || !sortTrigger) return;
    sortOptions.hidden = true;
    sortTrigger.setAttribute("aria-expanded", "false");
    sortControl?.classList.remove("is-open");
  };
  sortTrigger?.addEventListener("click", event => {
    event.preventDefault();
    const opening = sortOptions?.hidden;
    if (!sortOptions) return;
    sortOptions.hidden = !opening;
    sortTrigger.setAttribute("aria-expanded", String(Boolean(opening)));
    sortControl?.classList.toggle("is-open", Boolean(opening));
  });
  sortOptions?.querySelectorAll("[data-sort-value]").forEach(option => {
    option.addEventListener("click", () => {
      const value = option.dataset.sortValue || "popular";
      if (sortSelect) sortSelect.value = value;
      currentSort = value;
      if (sortTrigger) sortTrigger.textContent = sortLabels[value] || sortLabels.popular;
      sortOptions.querySelectorAll("[data-sort-value]").forEach(item => item.classList.toggle("active", item === option));
      closeSortOptions();
      renderCatalog();
    });
  });
  document.addEventListener("click", event => {
    if (sortControl && !sortControl.contains(event.target)) closeSortOptions();
  });

  $("#clear-search-button")
    ?.addEventListener(
      "click",
      resetCatalogFilters
    );

  // Categorias
  $$(".category")
    .forEach(button => {
      button.addEventListener("click", () => {
        currentCategory =
          button.dataset.category || "Todas";

        $$(".category").forEach(item => {
          item.classList.toggle(
            "active",
            item === button
          );
        });

        renderCatalog();
      });
    });

  // Delegação para elementos dinâmicos
  document.addEventListener("click", async event => {
    const addButton =
      event.target.closest("[data-product-add]");

    if (addButton) {
      const id = addButton.dataset.productAdd;

      const product = products.find(
        item => String(item.id) === String(id)
      );

      if (!product) return;

      const cart = loadCart();

      const existing =
        cart.find(
          item => String(item.id) === String(id)
        );

      if (existing) {
        existing.qty += 1;

        localStorage.setItem(
          "thoune-cart-v2",
          JSON.stringify(cart)
        );
      } else {
        const next = [
          ...cart,
          {
            id: product.id,
            name: product.name,
            price: getProductPrice(product),
            original_price:
              Number(product.price) || 0,
            discount_percent: getDiscountPercent(product),
            image: product.image || "",
            qty: 1
          }
        ];

        localStorage.setItem(
          "thoune-cart-v2",
          JSON.stringify(next)
        );
      }

      syncCartUI();
      toast("Marreta adicionada ao carrinho.");

      return;
    }

    const favoriteButton =
      event.target.closest("[data-favorite]");

    if (favoriteButton) {
      toggleFavorite(
        favoriteButton.dataset.favorite
      );

      return;
    }

    const favoriteRemove =
      event.target.closest("[data-favorite-remove]");

    if (favoriteRemove) {
      localStorage.removeItem(
        favoriteKey(
          favoriteRemove.dataset.favoriteRemove
        )
      );

      renderFavoritesPanel();
      renderAccountFavorites();
      renderCatalog();

      return;
    }


    const orderButton =
      event.target.closest(
        "[data-open-order-details]"
      );

    if (orderButton) {
      await openOrderDetails(
        orderButton.dataset.openOrderDetails
      );

      return;
    }

    const verifyButton =
      event.target.closest(
        "[data-order-verify]"
      );

    if (verifyButton) {
      await requestPaymentVerification(
        verifyButton.dataset.orderVerify
      );

      return;
    }
  });

  // Avaliações
  $$("[data-review-sort]").forEach(button => {
    button.addEventListener("click", async () => {
      currentReviewSort = button.dataset.reviewSort || "helpful";
      $$("[data-review-sort]").forEach(item => item.classList.toggle("active", item === button));
      await loadPublicReviews();
    });
  });

  $("#reviews-grid")?.addEventListener("click", async event => {
    const button = event.target.closest("[data-review-helpful]");
    if (!button) return;
    button.disabled = true;
    try {
      await toggleReviewHelpful(button.dataset.reviewHelpful);
    } catch (error) {
      console.error("Erro no voto da avaliação:", error);
      toast("Não foi possível registrar o voto.", "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#close-review")?.addEventListener("click", () => closePanel($("#review-modal")));
  $$('[data-close-review]').forEach(b => b.addEventListener("click", () => closePanel($("#review-modal"))));
  $("#review-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    if(!currentUser) return toast("Entre na sua conta para avaliar.","error");
    const message=$("#review-form-message"), form=event.currentTarget, rating=Number($("#review-rating")?.value||5), textValue=normalizeText($("#review-text")?.value||"");
    if(!textValue) return setMessage(message,"Escreva um comentário antes de enviar.","error");
    const submit=form.querySelector('button[type="submit"]'); if(submit){submit.disabled=true;submit.textContent="Enviando…";}
    const {error}=await supabaseClient.rpc("submit_customer_review",{p_rating:rating,p_text:textValue});
    if(submit){submit.disabled=false;submit.textContent="Enviar avaliação";}
    if(error){console.error(error);return setMessage(message,error.message||"Não foi possível enviar a avaliação.","error");}
    setMessage(message,"Avaliação enviada para análise. Obrigado!","success");
    setTimeout(()=>closePanel($("#review-modal")),1200);
  });

  // ESC
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllPanels();
      closeMobileMenu();
    }
  });

  // Backdrop global
  $("#global-panel-backdrop")
    ?.addEventListener("click", closeAllPanels);
}

window.addEventListener("error", event => {
  console.error("Thoune Store error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", event => {
  console.error("Thoune Store promise error:", event.reason);
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function initialize() {
  initializeTheme();
  playOpeningEffect();
  setupEvents();

  syncCartUI();

  await loadStoreSettings();

  await initializeAuth();

  await loadProducts();

  renderFavoritesPanel();
  renderAccountFavorites();

  await loadCurrentOrder();
  startOrderMonitor();

  await loadPublicReviews();
}

initialize().catch(error => {
  console.error(
    "Erro durante a inicialização da Thoune Store:",
    error
  );
});
