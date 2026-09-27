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
  join_open: false,
  discount_percent: 0,
  discount_active: false
};

let currentCategory = "Todas";
let currentSearch = "";
let currentSort = "popular";

let currentOrderId =
  localStorage.getItem("thoune-current-order-id") || null;

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

function openPanel(element) {
  if (!element) return;

  element.classList.add("open");
  element.classList.remove("hidden");
  element.setAttribute("aria-hidden", "false");
}

function closePanel(element) {
  if (!element) return;

  element.classList.remove("open");
  element.classList.add("hidden");
  element.setAttribute("aria-hidden", "true");
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

function getEffectivePrice(price) {
  const value = Number(price) || 0;

  if (!storeSettings.discount_active) {
    return value;
  }

  const discount = Number(storeSettings.discount_percent) || 0;

  if (discount <= 0) {
    return value;
  }

  return Math.max(
    0,
    value * (1 - discount / 100)
  );
}

function getProductPrice(product) {
  return getEffectivePrice(product?.price);
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
    serviceStatus.textContent = statusText;
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

    $("#profile-panel-tiktok").value =
      currentProfile.tiktok_username || "";

    $("#profile-panel-roblox").value =
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

  const email = $("#account-email");

  if (email) {
    email.textContent = currentUser.email || "";
  }

  $("#tiktok-username").value =
    currentProfile?.tiktok_username || "";

  $("#roblox-username").value =
    currentProfile?.roblox_username || "";

  $("#profile-panel-tiktok").value =
    currentProfile?.tiktok_username || "";

  $("#profile-panel-roblox").value =
    currentProfile?.roblox_username || "";
}

async function openAccountPanel() {
  openPanel($("#account-panel-modal"));

  if (currentUser) {
    await loadProfile();
    updateAccountUI();
  }
}

function closeAccountPanel() {
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
    .select("*");

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

  if (currentSort === "price-low") {
    result.sort(
      (a, b) =>
        getProductPrice(a) - getProductPrice(b)
    );
  } else if (currentSort === "price-high") {
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

  renderProducts(filtered);

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
          ♥
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
      <span>${escapeHtml(product.name)}</span>
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
              ? `<span>${money(original)}</span>`
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

  container.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <span>
        ${escapeHtml(item.name)} ×${Number(item.qty) || 1}
      </span>

      <strong>
        ${money(
          (Number(item.price) || 0) *
          (Number(item.qty) || 0)
        )}
      </strong>
    </div>
  `).join("");

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
    "Pedido criado! Faça o pagamento via Pix e depois solicite a verificação.",
    "success"
  );

  await loadCurrentOrder();
  await loadCustomerOrders();

  toast("Pedido criado com sucesso.");
}

async function requestPaymentVerification(orderId = currentOrderId) {
  if (!orderId) {
    toast("Nenhum pedido selecionado.");
    return;
  }

  const button = $("#verify-payment-button");

  if (button) {
    button.disabled = true;
  }

  const { error } =
    await supabaseClient.rpc(
      "request_payment_verification",
      {
        p_order_id: orderId
      }
    );

  if (button) {
    button.disabled = false;
  }

  if (error) {
    console.error(error);

    setMessage(
      $("#checkout-message"),
      error.message || "Não foi possível solicitar a verificação.",
      "error"
    );

    return;
  }

  // IMPORTANTE:
  // NÃO apagamos currentOrderId aqui.
  // O pedido ainda está ativo e precisa continuar sendo acompanhado.

  saveCurrentOrderId(orderId);

  setMessage(
    $("#checkout-message"),
    "Pagamento enviado para verificação. Agora aguarde a confirmação.",
    "success"
  );

  await loadCurrentOrder();
  await loadCustomerOrders();

  toast("Pagamento enviado para verificação.");
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
          "awaiting_delivery"
        ].includes(item.status)
      );

      if (active) {
        order = active;
        saveCurrentOrderId(active.id);
      }
    }
  }

  if (
    order &&
    ["delivered", "cancelled"].includes(order.status)
  ) {
    clearCurrentOrderStorage();
    closeCurrentOrderPanel();
    return;
  }

  renderCurrentOrder(order);
}

function getDeliveryMessage(order) {
  if (!order) return "";

  if (order.status === "awaiting_delivery") {
    if (storeSettings.delivery_bot_username) {
      return `
        <div class="delivery-message">
          <strong>Seu pedido está aguardando entrega.</strong>
          <p>
            Entre em contato pelo bot
            <strong>${escapeHtml(storeSettings.delivery_bot_username)}</strong>.
          </p>

          ${
            storeSettings.join_open
              ? "<p>O Join está aberto para a entrega.</p>"
              : ""
          }
        </div>
      `;
    }

    return `
      <div class="delivery-message">
        <strong>Seu pedido está aguardando entrega.</strong>
      </div>
    `;
  }

  return "";
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

      <button
        type="button"
        class="secondary-button"
        data-open-order-details="${escapeHtml(order.id)}"
      >
        Ver pedido
      </button>
    </article>
  `).join("");
}

async function openOrderDetails(orderId) {
  const order = await fetchOrder(orderId);

  if (!order) {
    toast("Não foi possível encontrar esse pedido.");
    return;
  }

  const modal = $("#order-details-modal");
  const title = $("#order-details-title");
  const content = $("#order-details-content");

  if (!modal || !content) return;

  if (title) {
    title.textContent =
      `Pedido #${String(order.id).slice(0, 8)}`;
  }

  const { data: items } = await supabaseClient
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  const itemList = Array.isArray(items)
    ? items
    : [];

  content.innerHTML = `
    <div class="order-detail-status">
      <span class="order-status ${getStatusClass(order.status)}">
        ${escapeHtml(getStatusLabel(order.status))}
      </span>

      ${
        order.created_at
          ? `<small>${formatDate(order.created_at)}</small>`
          : ""
      }
    </div>

    <div class="order-detail-items">
      ${
        itemList.length
          ? itemList.map(item => {
              const name =
                item.product_name ||
                item.name ||
                "Produto";

              const quantity =
                Number(item.quantity || item.qty || 1);

              const price =
                Number(
                  item.product_price ??
                  item.price ??
                  0
                );

              return `
                <div class="order-detail-item">
                  <span>
                    ${escapeHtml(name)} ×${quantity}
                  </span>

                  <strong>
                    ${money(price * quantity)}
                  </strong>
                </div>
              `;
            }).join("")
          : `
            <p>Itens do pedido não disponíveis.</p>
          `
      }
    </div>

    ${
      order.total != null
        ? `
          <div class="order-detail-total">
            <span>Total</span>
            <strong>${money(order.total)}</strong>
          </div>
        `
        : ""
    }

    ${getDeliveryMessage(order)}

    ${
      order.status === "awaiting_payment"
        ? `
          <div class="order-detail-actions">
            <button
              type="button"
              class="primary-button"
              data-order-verify="${escapeHtml(order.id)}"
            >
              Já paguei — verificar pagamento
            </button>
          </div>
        `
        : ""
    }

    ${
      order.status === "awaiting_verification"
        ? `
          <p class="order-help-text">
            Seu pagamento foi enviado para verificação.
            Aguarde a confirmação.
          </p>
        `
        : ""
    }

    ${
      order.status === "payment_confirmed"
        ? `
          <div class="order-confirmed-message">
            Pagamento confirmado! Seu pedido está aguardando entrega.
          </div>
        `
        : ""
    }
  `;

  openPanel(modal);
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
    .select("rating, text, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("Erro ao carregar avaliações:", error);
    return;
  }

  if (!data?.length) {
    container.innerHTML = "";

    if (empty) {
      setHidden(empty, false);
    }

    return;
  }

  if (empty) {
    setHidden(empty, true);
  }

  container.innerHTML = data.map(review => {
    const rating = Math.min(
      5,
      Math.max(1, Number(review.rating) || 0)
    );

    return `
      <article class="review-card">
        <div class="review-rating">
          ${"★".repeat(rating)}
          ${"☆".repeat(5 - rating)}
        </div>

        <p>${escapeHtml(review.text || "")}</p>

        <span>Cliente Thoune Store</span>
      </article>
    `;
  }).join("");
}

// ============================================================
// SUBPAINÉIS DA CONTA
// ============================================================

function closeAccountSubpanels() {
  closePanel($("#orders-panel"));
  closePanel($("#notifications-panel"));
  closePanel($("#profile-panel"));
  closePanel($("#favorites-account-panel"));
}

async function openOrdersPanel() {
  closeAccountSubpanels();
  openPanel($("#orders-panel"));
  await loadCustomerOrders();
}

async function openNotificationsPanel() {
  closeAccountSubpanels();
  openPanel($("#notifications-panel"));
  await loadNotifications();
}

function openProfilePanel() {
  closeAccountSubpanels();

  $("#profile-panel-tiktok").value =
    currentProfile?.tiktok_username || "";

  $("#profile-panel-roblox").value =
    currentProfile?.roblox_username || "";

  openPanel($("#profile-panel"));
}

function openAccountFavoritesPanel() {
  closeAccountSubpanels();
  renderAccountFavorites();
  openPanel($("#favorites-account-panel"));
}

// ============================================================
// FECHAMENTO GLOBAL
// ============================================================

function closeAllPanels() {
  closePanel($("#account-panel-modal"));
  closePanel($("#orders-panel"));
  closePanel($("#notifications-panel"));
  closePanel($("#profile-panel"));
  closePanel($("#favorites-account-panel"));

  closePanel($("#favorites-panel"));
  closePanel($("#product-modal"));
  closePanel($("#notifications-global-panel"));

  closePanel($("#cart-drawer"));
  closePanel($("#checkout-section"));
  closePanel($("#order-details-modal"));

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

  // Subpainéis
  $("#open-orders-panel")
    ?.addEventListener("click", openOrdersPanel);

  $("#open-notifications-panel")
    ?.addEventListener(
      "click",
      openNotificationsPanel
    );

  $("#open-profile-panel")
    ?.addEventListener(
      "click",
      openProfilePanel
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
    await openAccountPanel();
    await openOrdersPanel();
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

    const productButton =
      event.target.closest("[data-product-id]");

    if (
      productButton &&
      !event.target.closest(
        "button[data-product-add], [data-favorite]"
      )
    ) {
      openProductModal(
        productButton.dataset.productId
      );

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

// ============================================================
// INICIALIZAÇÃO
// ============================================================

async function initialize() {
  setupEvents();

  syncCartUI();

  await loadStoreSettings();

  await initializeAuth();

  await loadProducts();

  renderFavoritesPanel();
  renderAccountFavorites();

  await loadCurrentOrder();

  await loadPublicReviews();
}

initialize().catch(error => {
  console.error(
    "Erro durante a inicialização da Thoune Store:",
    error
  );
});
