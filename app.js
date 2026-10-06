import { loadCart, orderText, clearCart, money } from "./cart.js";
import { renderProducts, renderCart, updateCartBadge, toast } from "./ui.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let products = [];
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
let currentReviewSort = "recent";
const GUEST_VOTER_KEY = "thoune-review-voter-v1040";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setHidden(element, hidden) {
  if (!element) return;
  element.classList.toggle("hidden", hidden);
  element.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function syncOverlayLock() {
  const overlays = document.querySelectorAll(
    "#cart-drawer, #checkout-section, #favorites-panel, #product-modal, #terms-modal"
  );
  const open = Array.from(overlays).some(el => el.classList.contains("open"));
  document.body.classList.toggle("overlay-lock", open);
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

function closeAllPanels() {
  ["#cart-drawer", "#checkout-section", "#favorites-panel", "#product-modal", "#terms-modal"]
    .forEach(id => closePanel($(id)));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(element, message = "", type = "") {
  if (!element) return;
  element.textContent = message;
  element.className = "message";
  if (type) element.classList.add(type);
  setHidden(element, !message);
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return ""; }
}

function playOpeningEffect() {
  if (sessionStorage.getItem("thoune-opening-effect-v1040")) return;
  sessionStorage.setItem("thoune-opening-effect-v1040", "1");
  const layer = document.createElement("div");
  layer.className = "opening-effect";
  layer.innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="opening-bubble b${i + 1}"></span>`).join("");
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1800);
}

function initializeTheme() {
  document.body.classList.remove("theme-light");
  localStorage.removeItem("thoune-theme");
}

function openTerms() {
  const modal = $("#terms-modal");
  if (!modal) return;
  openPanel(modal);
  const card = modal.querySelector(".terms-card");
  if (card) card.scrollTop = 0;
}

async function loadStoreSettings() {
  const { data, error } = await supabaseClient
    .from("public_store_settings")
    .select("id, online, pix_key, delivery_bot_username, delivery_bot_url, join_open, discount_percent, discount_active, updated_at")
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar configurações da loja:", error);
    storeSettings = { ...storeSettings, online: false, pix_key: "" };
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
  const text = online ? "Atendimento online" : "Atendimento offline";
  const serviceStatus = $("#service-status");
  if (serviceStatus) {
    const dot = serviceStatus.querySelector("span");
    const label = serviceStatus.querySelector("strong");
    if (label) label.textContent = text;
    if (dot) dot.classList.toggle("offline-dot", !online);
    serviceStatus.classList.toggle("offline", !online);
  }
  const headerStatus = $("#header-store-status");
  if (headerStatus) {
    const dot = headerStatus.querySelector(".status-dot");
    const label = headerStatus.querySelector(".status-text");
    if (label) label.textContent = text;
    if (dot) dot.classList.toggle("offline", !online);
    headerStatus.classList.toggle("offline", !online);
  }
}

function getDiscountPercent(product) {
  const individual = Number(product?.discount_percent) || 0;
  if (product?.discount_active && individual > 0) return Math.min(100, individual);
  if (storeSettings.discount_active) return Math.min(100, Number(storeSettings.discount_percent) || 0);
  return 0;
}

function getEffectivePrice(price, discount = 0) {
  const value = Number(price) || 0;
  const pct = Math.min(100, Math.max(0, Number(discount) || 0));
  if (!pct) return value;
  return Math.max(0, Math.round(value * (1 - pct / 100) * 100) / 100);
}

function getProductPrice(product) {
  return getEffectivePrice(product?.price, getDiscountPercent(product));
}

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
    if ($("#catalog-count")) $("#catalog-count").textContent = "Não foi possível carregar o catálogo.";
    setHidden($("#empty-state"), false);
    return;
  }
  products = Array.isArray(data) ? data : [];
  renderCatalog();
}

function getFilteredProducts() {
  let result = [...products];
  if (currentCategory !== "Todas") {
    result = result.filter(p => String(p.category || "").toLowerCase() === currentCategory.toLowerCase());
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    result = result.filter(p => String(p.name || "").toLowerCase().includes(q) || String(p.category || "").toLowerCase().includes(q));
  }
  if (currentSort === "low") result.sort((a,b) => getProductPrice(a) - getProductPrice(b));
  else if (currentSort === "high") result.sort((a,b) => getProductPrice(b) - getProductPrice(a));
  else result.sort((a,b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  return result;
}

function renderCatalog() {
  const filtered = getFilteredProducts();
  if ($("#catalog-count")) $("#catalog-count").textContent = `${filtered.length} ${filtered.length === 1 ? "item" : "itens"}`;
  const display = filtered.map(product => ({
    ...product,
    price: getProductPrice(product),
    original_price: Number(product.price) || 0,
    discount_percent: getDiscountPercent(product)
  }));
  renderProducts(display);
  setHidden($("#empty-state"), filtered.length !== 0);
}

function resetCatalogFilters() {
  currentCategory = "Todas";
  currentSearch = "";
  currentSort = "popular";
  if ($("#search-input")) $("#search-input").value = "";
  if ($("#sort-select")) $("#sort-select").value = "popular";
  if ($("#sort-trigger")) $("#sort-trigger").textContent = "Mais populares";
  $("#sort-options")?.querySelectorAll("[data-sort-value]").forEach(item => item.classList.toggle("active", item.dataset.sortValue === "popular"));
  $$(".category").forEach(b => b.classList.toggle("active", b.dataset.category === "Todas"));
  renderCatalog();
}

function favoriteKey(id) { return `thoune-fav-${id}`; }
function isFavorite(id) { return localStorage.getItem(favoriteKey(id)) === "1"; }

function toggleFavorite(id) {
  const key = favoriteKey(id);
  if (isFavorite(id)) localStorage.removeItem(key); else localStorage.setItem(key, "1");
  renderCatalog();
  renderFavoritesPanel();
}

function renderFavoritesPanel() {
  const container = $("#favorites-list");
  if (!container) return;
  const favorites = products.filter(p => isFavorite(p.id));
  if (!favorites.length) {
    container.innerHTML = `<div class="empty-panel"><strong>Nenhum favorito ainda.</strong><p>Toque no coração de uma marreta para adicioná-la aos favoritos.</p></div>`;
    return;
  }
  container.innerHTML = favorites.map(product => `
    <article class="favorite-item">
      <div class="favorite-item-image">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : ""}</div>
      <div class="favorite-item-info"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.category || "")}</span><b>${money(getProductPrice(product))}</b></div>
      <button type="button" class="favorite-remove" data-favorite-remove="${escapeHtml(product.id)}" aria-label="Remover dos favoritos"><span class="ui-icon ui-icon-heart" aria-hidden="true"></span></button>
    </article>`).join("");
}

function openProductModal(productId) {
  const product = products.find(p => String(p.id) === String(productId));
  const modal = $("#product-modal");
  const content = $("#product-modal-content");
  if (!product || !modal || !content) return;
  const price = getProductPrice(product);
  const original = Number(product.price) || 0;
  content.innerHTML = `
    <div class="product-detail">
      ${product.image ? `<div class="product-detail-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"></div>` : ""}
      <div class="product-detail-info">
        <span class="product-detail-category">${escapeHtml(product.category || "")}</span>
        <h2>${escapeHtml(product.name)}</h2>
        <div class="product-detail-price"><strong>${money(price)}</strong>${price < original ? `<span class="product-detail-original">${money(original)}</span>` : ""}</div>
        ${product.description ? `<p>${escapeHtml(product.description)}</p>` : ""}
        <button type="button" class="primary-button" data-product-add="${escapeHtml(product.id)}">Adicionar ao carrinho</button>
      </div>
    </div>`;
  openPanel(modal);
}

function syncCartUI() {
  const cart = loadCart();
  updateCartBadge(cart);
  if ($("#cart-count")) $("#cart-count").textContent = String(cart.reduce((s,i) => s + Math.max(0, Number(i.qty)||0), 0));
}

function openCart() { renderCart(loadCart()); syncCartUI(); openPanel($("#cart-drawer")); }
function closeCart() { closePanel($("#cart-drawer")); }

function copyOrderText() {
  const cart = loadCart();
  if (!cart.length) return toast("O carrinho está vazio.");
  navigator.clipboard?.writeText(orderText(cart)).then(() => toast("Pedido copiado.")).catch(() => toast("Não foi possível copiar."));
}

function clearShoppingCart() {
  clearCart();
  renderCart([]);
  syncCartUI();
  toast("Carrinho limpo.");
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
    const pct = Number(item.discount_percent) || (hasDiscount ? Math.round((1 - price/original)*100) : 0);
    return `<div class="checkout-item"><span>${escapeHtml(item.name)} ×${qty}${hasDiscount ? `<small class="checkout-discount">-${pct}% OFF</small>` : ""}</span><strong>${hasDiscount ? `<del>${money(original*qty)}</del> ` : ""}${money(price*qty)}</strong></div>`;
  }).join("");
  const total = cart.reduce((sum,item) => sum + (Number(item.price)||0)*(Number(item.qty)||0), 0);
  if ($("#checkout-total")) $("#checkout-total").textContent = money(total);
  if ($("#checkout-pix-key")) $("#checkout-pix-key").textContent = storeSettings.pix_key || "Pix indisponível";
  if ($("#checkout-tiktok")) $("#checkout-tiktok").value = "";
  if ($("#checkout-roblox")) $("#checkout-roblox").value = "";
  setMessage($("#checkout-message"), "");
}

async function openCheckout() {
  const cart = loadCart();
  if (!cart.length) return toast("Adicione pelo menos uma marreta ao carrinho.");
  if (!storeSettings.online) return toast("O atendimento está offline no momento.");
  renderCheckout();
  openPanel($("#checkout-section"));
}

async function createGuestOrder() {
  if (!storeSettings.online) return setMessage($("#checkout-message"), "A loja está offline no momento.", "error");
  const cart = loadCart();
  if (!cart.length) return setMessage($("#checkout-message"), "Seu carrinho está vazio.", "error");

  const accepted = window.confirm("Atenção: a Thoune Store não usa bot automático. Eu mesmo faço as entregas, seguindo a ordem dos pedidos, e pode ser necessário aguardar. Deseja continuar com o pedido?");
  if (!accepted) return;

  const tiktokUsername = normalizeText($("#checkout-tiktok")?.value);
  const robloxUsername = normalizeText($("#checkout-roblox")?.value);
  const pixSenderName = normalizeText($("#checkout-pix-name")?.value);
  if (!tiktokUsername || !robloxUsername || !pixSenderName) {
    return setMessage($("#checkout-message"), "Preencha seu usuário do TikTok, seu usuário do Roblox e o nome do remetente do Pix.", "error");
  }

  const items = cart.map(item => ({ product_id: item.id, quantity: Math.max(1, Math.floor(Number(item.qty)||1)) }));
  const button = $("#confirm-order-button");
  if (button) { button.disabled = true; button.textContent = "Criando pedido..."; }
  setMessage($("#checkout-message"), "Criando seu pedido...");

  const { data, error } = await supabaseClient.rpc("create_guest_order", {
    p_items: items,
    p_tiktok_username: tiktokUsername,
    p_delivery_username: robloxUsername,
    p_pix_name: pixSenderName
  });

  if (button) { button.disabled = false; button.textContent = "Criar pedido e pagar via Pix"; }
  if (error) {
    console.error("create_guest_order:", error);
    return setMessage($("#checkout-message"), error.message || "Não foi possível criar o pedido.", "error");
  }

  const orderId = typeof data === "string" ? data : data?.order_id || data?.id;
  const total = Number(data?.total);
  if (!orderId) return setMessage($("#checkout-message"), "Não foi possível identificar o pedido. Tente novamente.", "error");

  clearCart();
  syncCartUI();
  renderCart([]);

  const orderShort = String(orderId).slice(0, 8).toUpperCase();
  $("#checkout-content")?.scrollTo({ top: 0, behavior: "smooth" });
  const content = $("#checkout-section .checkout-content");
  if (content) {
    content.innerHTML = `
      <div class="checkout-success-card" style="padding:24px;text-align:center;">
        <div style="font-size:42px;margin-bottom:10px;">✓</div>
        <p class="eyebrow">PEDIDO CRIADO</p>
        <h2 style="margin:8px 0;">Pedido #${escapeHtml(orderShort)}</h2>
        <p>Seu pedido foi criado sem conta e sem e-mail. O nome informado no Pix ficará vinculado ao pedido para a conferência do pagamento.</p>
        <div class="checkout-total" style="margin:18px 0;"><span>Total</span><strong>${money(Number.isFinite(total) ? total : cart.reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.qty)||0),0))}</strong></div>
        <div class="manual-delivery-notice" style="text-align:left;border:1px solid #7950d8;background:rgba(121,80,216,.12);border-radius:14px;padding:14px;margin:16px 0;">
          <strong>🚚 Entrega manual</strong>
          <p style="margin:8px 0 0;">Faça o Pix no valor exato acima. Depois clique em “Já fiz o Pix” para avisar a loja. Não precisa criar conta nem informar e-mail.</p>
        </div>
        <div class="pix-key-box"><span class="pix-key-label">Chave Pix</span><div class="pix-key-row"><strong class="pix-key-value">${escapeHtml(storeSettings.pix_key || "Pix indisponível")}</strong><button type="button" class="secondary-button" id="copy-pix-key-success">▤ Copiar</button></div></div>
        <button type="button" class="primary-button full" id="guest-payment-done" data-order-id="${escapeHtml(orderId)}" style="margin-top:16px;">Já fiz o Pix</button>
        <button type="button" class="secondary-button full" id="guest-finish" style="margin-top:8px;">Fechar</button>
        <p class="checkout-message" id="guest-order-message" aria-live="polite"></p>
      </div>`;
    $("#copy-pix-key-success")?.addEventListener("click", copyPixKey);
    $("#guest-payment-done")?.addEventListener("click", () => requestGuestPaymentVerification(orderId));
    $("#guest-finish")?.addEventListener("click", () => closePanel($("#checkout-section")));
  }
  toast(`Pedido #${orderShort} criado.`);
}

async function requestGuestPaymentVerification(orderId) {
  const button = $("#guest-payment-done");
  const message = $("#guest-order-message");
  if (button) { button.disabled = true; button.textContent = "Enviando aviso..."; }
  const { error } = await supabaseClient.rpc("request_guest_payment_verification", { p_order_id: orderId });
  if (error) {
    console.error("request_guest_payment_verification:", error);
    if (button) { button.disabled = false; button.textContent = "Já fiz o Pix"; }
    return setMessage(message, error.message || "Não foi possível avisar a loja.", "error");
  }
  if (button) { button.disabled = true; button.textContent = "Pix avisado ✓"; }
  setMessage(message, "Pronto! A loja foi avisada e vai conferir o pagamento. A entrega é manual e segue a ordem dos pedidos.", "success");
  toast("Pagamento enviado para verificação.");
}

function copyPixKey() {
  const key = storeSettings.pix_key;
  if (!key) return toast("A chave Pix não está disponível.");
  navigator.clipboard?.writeText(key).then(() => toast("Chave Pix copiada.")).catch(() => toast("Não foi possível copiar."));
}

// Reviews: public-only. Helpful votes use a browser token, not an account.
function getGuestVoterToken() {
  let token = localStorage.getItem(GUEST_VOTER_KEY);
  if (!token) {
    token = (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).toString();
    localStorage.setItem(GUEST_VOTER_KEY, token);
  }
  return token;
}

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
  if (error) { console.error("Erro ao carregar avaliações:", error); return; }
  if (!data?.length) { container.innerHTML = ""; setHidden(empty, false); return; }
  setHidden(empty, true);
  let helpfulMap = {};
  try {
    const ids = data.map(r => r.id);
    const { data: helpfulData, error: helpfulError } = await supabaseClient.rpc("get_guest_review_helpfulness", { p_review_ids: ids, p_voter_token: getGuestVoterToken() });
    if (!helpfulError && Array.isArray(helpfulData)) {
      helpfulMap = Object.fromEntries(helpfulData.map(row => [String(row.review_id), { count: Number(row.helpful_count)||0, voted: Boolean(row.user_voted) }]));
    }
  } catch (e) { console.warn("Votos públicos indisponíveis:", e); }
  const enriched = data.map(r => ({...r, helpfulCount: helpfulMap[String(r.id)]?.count || 0, userVoted: helpfulMap[String(r.id)]?.voted || false}));
  if (currentReviewSort === "rating") enriched.sort((a,b) => Number(b.rating)-Number(a.rating) || b.helpfulCount-a.helpfulCount);
  else if (currentReviewSort === "helpful") enriched.sort((a,b) => b.helpfulCount-a.helpfulCount || new Date(b.created_at)-new Date(a.created_at));
  else enriched.sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
  container.innerHTML = enriched.map(review => {
    const rating = Math.min(5, Math.max(1, Number(review.rating)||0));
    const username = review.tiktok_username ? `@${String(review.tiktok_username).replace(/^@/, "")}` : "Cliente Thoune Store";
    const avatar = review.tiktok_avatar ? `<img src="${escapeHtml(review.tiktok_avatar)}" alt="" loading="lazy">` : `<span class="review-avatar-fallback"><span class="ui-icon ui-icon-user" aria-hidden="true"></span></span>`;
    return `<article class="review-card"><div class="review-card-top"><div class="review-author"><span class="review-avatar">${avatar}</span><div><strong>${escapeHtml(username)}</strong><small>${formatDate(review.created_at)}</small></div></div><div class="review-rating" aria-label="${rating} de 5 estrelas">${"★".repeat(rating)}${"☆".repeat(5-rating)}</div></div><p class="review-text">${escapeHtml(review.text || "Sem comentário.")}</p><button type="button" class="review-helpful ${review.userVoted ? "active" : ""}" data-review-helpful="${escapeHtml(review.id)}" aria-pressed="${review.userVoted ? "true" : "false"}><span class="review-helpful-icon"><span class="ui-icon ui-icon-like" aria-hidden="true"></span></span><span>Achou útil</span><b>${review.helpfulCount}</b></button></article>`;
  }).join("");
}

async function toggleReviewHelpful(reviewId) {
  const { data, error } = await supabaseClient.rpc("toggle_guest_review_helpful", { p_review_id: reviewId, p_voter_token: getGuestVoterToken() });
  if (error) { console.error(error); toast(error.message || "Não foi possível registrar o voto.", "error"); return; }
  if (data?.success === false) { toast(data.message || "Não foi possível registrar o voto.", "error"); return; }
  await loadPublicReviews();
}

function setupSortControl() {
  const sortControl = $("#sort-control"), trigger = $("#sort-trigger"), options = $("#sort-options"), select = $("#sort-select");
  const labels = { popular:"Mais populares", low:"Menor preço", high:"Maior preço" };
  const close = () => { if (!options || !trigger) return; options.hidden = true; trigger.setAttribute("aria-expanded", "false"); sortControl?.classList.remove("is-open"); };
  trigger?.addEventListener("click", e => { e.preventDefault(); if (!options) return; const opening = options.hidden; options.hidden = !opening; trigger.setAttribute("aria-expanded", String(Boolean(opening))); sortControl?.classList.toggle("is-open", Boolean(opening)); });
  options?.querySelectorAll("[data-sort-value]").forEach(option => option.addEventListener("click", () => { const value=option.dataset.sortValue||"popular"; if(select) select.value=value; currentSort=value; if(trigger) trigger.textContent=labels[value]; options.querySelectorAll("[data-sort-value]").forEach(item=>item.classList.toggle("active", item===option)); close(); renderCatalog(); }));
  document.addEventListener("click", e => { if(sortControl && !sortControl.contains(e.target)) close(); });
}

function setupEvents() {
  $("#open-cart")?.addEventListener("click", openCart);
  $("#close-cart")?.addEventListener("click", closeCart);
  $("#close-cart-button")?.addEventListener("click", closeCart);
  $("#copy-order-button")?.addEventListener("click", copyOrderText);
  $("#clear-cart-button")?.addEventListener("click", clearShoppingCart);
  $("#checkout-button")?.addEventListener("click", openCheckout);
  $("#close-checkout")?.addEventListener("click", () => closePanel($("#checkout-section")));
  $("#checkout-backdrop")?.addEventListener("click", () => closePanel($("#checkout-section")));
  $("#checkout-back")?.addEventListener("click", () => { closePanel($("#checkout-section")); openCart(); });
  $("#copy-pix-key-button")?.addEventListener("click", copyPixKey);
  $("#confirm-order-button")?.addEventListener("click", createGuestOrder);
  $("#close-product-modal")?.addEventListener("click", () => closePanel($("#product-modal")));
  $$('[data-close-product-modal]').forEach(b => b.addEventListener("click", () => closePanel($("#product-modal"))));
  $("#open-favorites-panel")?.addEventListener("click", () => { renderFavoritesPanel(); openPanel($("#favorites-panel")); });
  $("#close-favorites-panel")?.addEventListener("click", () => closePanel($("#favorites-panel")));
  $("#close-terms")?.addEventListener("click", () => closePanel($("#terms-modal")));
  $("#terms-backdrop")?.addEventListener("click", () => closePanel($("#terms-modal")));
  $$('[data-open-terms]').forEach(b => b.addEventListener("click", openTerms));
  $("#menu-toggle")?.addEventListener("click", () => { const nav=$("#mobile-nav"); const open=nav?.classList.toggle("open"); $("#menu-toggle")?.setAttribute("aria-expanded", String(Boolean(open))); });
  $("#search-input")?.addEventListener("input", e => { currentSearch=normalizeText(e.target.value); renderCatalog(); });
  $("#sort-select")?.addEventListener("change", e => { currentSort=e.target.value; renderCatalog(); });
  $("#clear-search-button")?.addEventListener("click", resetCatalogFilters);
  $$(".category").forEach(button => button.addEventListener("click", () => { currentCategory=button.dataset.category||"Todas"; $$(".category").forEach(b=>b.classList.toggle("active", b===button)); renderCatalog(); }));
  setupSortControl();

  document.addEventListener("click", async event => {
    const add = event.target.closest("[data-product-add]");
    if (add) {
      const product = products.find(p => String(p.id) === String(add.dataset.productAdd));
      if (!product) return;
      const cart=loadCart(); const found=cart.find(i=>String(i.id)===String(product.id));
      if(found) found.qty+=1;
      else cart.push({id:product.id,name:product.name,price:getProductPrice(product),original_price:Number(product.price)||0,discount_percent:getDiscountPercent(product),image:product.image||"",qty:1});
      localStorage.setItem("thoune-cart-v2", JSON.stringify(cart));
      syncCartUI(); toast("Marreta adicionada ao carrinho.");
      if (add.closest("#product-modal")) closePanel($("#product-modal"));
      return;
    }
    const favorite = event.target.closest("[data-favorite]");
    if (favorite) { toggleFavorite(favorite.dataset.favorite); return; }
    const removeFav = event.target.closest("[data-favorite-remove]");
    if (removeFav) { localStorage.removeItem(favoriteKey(removeFav.dataset.favoriteRemove)); renderFavoritesPanel(); renderCatalog(); return; }
  });

  $("#reviews-grid")?.addEventListener("click", async event => {
    const button=event.target.closest("[data-review-helpful]");
    if(!button) return;
    button.disabled=true;
    try { await toggleReviewHelpful(button.dataset.reviewHelpful); }
    finally { button.disabled=false; }
  });
  $$('[data-review-sort]').forEach(button => button.addEventListener("click", async () => { currentReviewSort=button.dataset.reviewSort||"recent"; $$('[data-review-sort]').forEach(b=>b.classList.toggle("active", b===button)); await loadPublicReviews(); }));

  document.addEventListener("keydown", e => { if(e.key === "Escape") { closeAllPanels(); $("#mobile-nav")?.classList.remove("open"); } });
  $("#global-panel-backdrop")?.addEventListener("click", closeAllPanels);
}

window.addEventListener("error", e => console.error("Thoune Store error:", e.error || e.message));
window.addEventListener("unhandledrejection", e => console.error("Thoune Store promise error:", e.reason));

async function initialize() {
  initializeTheme();
  playOpeningEffect();
  setupEvents();
  syncCartUI();
  await loadStoreSettings();
  await loadProducts();
  renderFavoritesPanel();
  await loadPublicReviews();
}

initialize().catch(error => console.error("Erro durante a inicialização da Thoune Store:", error));
