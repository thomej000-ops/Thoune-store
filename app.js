import { loadCart, orderText, clearCart, cartTotal, money } from "./cart.js";
import {
  renderProducts,
  renderCart,
  updateCartBadge,
  toast
} from "./ui.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* =========================================================
   CONTA
========================================================= */

const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");

const accountMessage = document.querySelector("#account-message");
const accountDetails = document.querySelector("#account-details");
const accountEmail = document.querySelector("#account-email");
const ordersMessage = document.querySelector("#orders-message");

const profileFields = document.querySelector("#profile-fields");
const tiktokUsername = document.querySelector("#tiktok-username");
const robloxUsername = document.querySelector("#roblox-username");
const saveProfileButton = document.querySelector("#save-profile-button");
const profileMessage = document.querySelector("#profile-message");

let currentUser = null;
let currentIsAdmin = false;

/* =========================================================
   PERFIL
========================================================= */

async function loadProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("tiktok_username, roblox_username, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error);
    return null;
  }

  if (data) {
    tiktokUsername.value = data.tiktok_username || "";
    robloxUsername.value = data.roblox_username || "";
  }

  return data;
}

/* =========================================================
   VERIFICA ADMIN
========================================================= */

async function checkAdmin(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar administrador:", error);
    return false;
  }

  return data?.role === "admin";
}

/* =========================================================
   ATUALIZA CONTA
========================================================= */

async function updateAccountUI() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  currentUser = session?.user || null;
  currentIsAdmin = false;

  if (session?.user) {
    accountDetails.classList.remove("hidden");
    accountEmail.textContent = session.user.email || "";

    profileFields.classList.remove("hidden");

    const profile = await loadProfile(session.user.id);

console.log("PERFIL CARREGADO:", profile);
console.log("USUÁRIO LOGADO:", session.user.email);

if (!profile) {
  toast("Não foi possível carregar seu perfil.");
  currentIsAdmin = false;
} else if (profile.role === "admin") {
  currentIsAdmin = true;
  toast("Administrador reconhecido! 🔐");
} else {
  currentIsAdmin = false;
  toast("Perfil reconhecido como: " + profile.role);
}

    accountMessage.textContent =
      currentIsAdmin
        ? "Você está conectado como administrador."
        : "Você está conectado à sua conta.";

    loginButton.classList.add("hidden");
    signupButton.classList.add("hidden");
    logoutButton.classList.remove("hidden");

    authEmail.value = session.user.email || "";
    authEmail.disabled = true;
    authPassword.classList.add("hidden");

    if (currentIsAdmin) {
      createAdminPanel();
      await loadStoreSettings();
      await loadAdminProducts();
    } else {
      removeAdminPanel();
    }
  } else {
    profileFields.classList.add("hidden");
    accountDetails.classList.add("hidden");

    accountEmail.textContent = "";
    ordersMessage.textContent = "Você ainda não possui pedidos.";

    accountMessage.textContent =
      "Entre ou crie sua conta para acompanhar seus pedidos.";

    loginButton.classList.remove("hidden");
    signupButton.classList.remove("hidden");
    logoutButton.classList.add("hidden");

    authEmail.disabled = false;
    authPassword.classList.remove("hidden");

    removeAdminPanel();
  }
}

/* =========================================================
   LOGIN
========================================================= */

loginButton.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    toast("Preencha seu e-mail e sua senha.");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    toast("Não foi possível entrar: " + error.message);
    return;
  }

  toast("Login realizado com sucesso!");
  await updateAccountUI();
});

/* =========================================================
   CADASTRO
========================================================= */

signupButton.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    toast("Preencha seu e-mail e sua senha.");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    toast("Não foi possível criar a conta: " + error.message);
    return;
  }

  toast("Conta criada com sucesso!");
  await updateAccountUI();
});

/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    toast("Não foi possível sair da conta.");
    return;
  }

  toast("Você saiu da conta.");
  await updateAccountUI();
});

supabaseClient.auth.onAuthStateChange(() => {
  updateAccountUI();
});

/* =========================================================
   SALVAR PERFIL
========================================================= */

saveProfileButton.addEventListener("click", async () => {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    toast("Entre na sua conta primeiro.");
    return;
  }

  const tiktok = tiktokUsername.value.trim();
  const roblox = robloxUsername.value.trim();

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      tiktok_username: tiktok || null,
      roblox_username: roblox || null
    })
    .eq("id", session.user.id);

  if (error) {
    console.error("Erro ao salvar perfil:", error);
    toast("Não foi possível salvar suas informações.");
    return;
  }

  profileMessage.textContent = "Informações salvas com sucesso! ✅";
  toast("Perfil atualizado!");
});

/* =========================================================
   PRODUTOS
========================================================= */

let products = [];
let selectedCategory = "Todas";
let search = "";
let sort = "popular";

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Erro ao carregar produtos:", error);
    alert("ERRO SUPABASE: " + error.message);
    return;
  }

  products = data || [];

  refresh();
}

async function loadAdminProducts() {
  if (!currentIsAdmin) return;

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Erro ao carregar produtos do ADM:", error);
    const message = document.querySelector("#admin-product-message");

    if (message) {
      message.textContent =
        "Não foi possível carregar os produtos: " + error.message;
    }

    return;
  }

  const message = document.querySelector("#admin-product-message");

  if (message) {
    message.textContent = `${data.length} produto(s) cadastrado(s).`;
  }

  renderAdminProducts(data || []);
}

function filtered() {
  let result = products.filter(
    p =>
      p.active &&
      (selectedCategory === "Todas" || p.category === selectedCategory) &&
      p.name.toLowerCase().includes(search)
  );

  if (sort === "low") {
    result.sort((a, b) => a.price - b.price);
  }

  if (sort === "high") {
    result.sort((a, b) => b.price - a.price);
  }

  if (sort === "popular") {
    result.sort(
      (a, b) => (b.popularity || 0) - (a.popularity || 0)
    );
  }

  return result;
}

function refresh() {
  renderProducts(filtered());
}

/* =========================================================
   FILTROS
========================================================= */

document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".category")
      .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    selectedCategory = button.dataset.category;

    refresh();
  });
});

document
  .querySelector("#search-input")
  .addEventListener("input", e => {
    search = e.target.value.trim().toLowerCase();
    refresh();
  });

document
  .querySelector("#sort-select")
  .addEventListener("change", e => {
    sort = e.target.value;
    refresh();
  });

/* =========================================================
   MENU
========================================================= */

const menuToggle = document.querySelector("#menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");

menuToggle.addEventListener("click", () =>
  mobileNav.classList.toggle("open")
);

mobileNav.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () =>
    mobileNav.classList.remove("open")
  );
});

/* =========================================================
   CARRINHO
========================================================= */

const drawer = document.querySelector("#cart-drawer");

function openCart() {
  drawer.classList.add("open");
  renderCart(loadCart());
}

function closeCart() {
  drawer.classList.remove("open");
}

document
  .querySelector("#open-cart")
  .addEventListener("click", openCart);

document
  .querySelector("#close-cart")
  .addEventListener("click", closeCart);

document
  .querySelector("#close-cart-button")
  .addEventListener("click", closeCart);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeCart();
  }
});

/* =========================================================
   COPIAR PEDIDO
========================================================= */

document
  .querySelector("#copy-order-button")
  .addEventListener("click", async () => {
    const cart = loadCart();

    if (!cart.length) {
      toast("Seu carrinho está vazio.");
      return;
    }

    try {
      await navigator.clipboard.writeText(orderText(cart));
      toast("Pedido copiado!");
    } catch {
      toast("Não foi possível copiar automaticamente.");
    }
  });

/* =========================================================
   CHECKOUT
========================================================= */

const checkoutSection = document.querySelector("#checkout-section");
const checkoutItems = document.querySelector("#checkout-items");
const checkoutTiktok = document.querySelector("#checkout-tiktok");
const checkoutRoblox = document.querySelector("#checkout-roblox");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutBack = document.querySelector("#checkout-back");

document
  .querySelector("#checkout-button")
  .addEventListener("click", async () => {
    const cart = loadCart();

    if (!cart.length) {
      toast("Adicione uma marreta ao carrinho primeiro.");
      return;
    }

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session?.user) {
      toast("Entre na sua conta antes de realizar a compra.");

      document
        .querySelector("#conta")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    await loadProfile(session.user.id);

    checkoutItems.innerHTML = "";

    for (const item of cart) {
      const row = document.createElement("div");
      row.className = "checkout-item";

      const image = document.createElement("img");
      image.src = item.image || "";
      image.alt = item.name;

      const info = document.createElement("div");

      const name = document.createElement("strong");
      name.textContent = item.name;

      const details = document.createElement("span");

      details.textContent =
        `${item.qty} × ${money(item.price)} = ${money(
          item.price * item.qty
        )}`;

      info.appendChild(name);
      info.appendChild(details);

      row.appendChild(image);
      row.appendChild(info);

      checkoutItems.appendChild(row);
    }

    checkoutTiktok.value = tiktokUsername.value || "";
    checkoutRoblox.value = robloxUsername.value || "";

    checkoutTotal.textContent = money(cartTotal(cart));

    checkoutSection.classList.remove("hidden");

    closeCart();

    checkoutSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });

checkoutBack.addEventListener("click", () => {
  checkoutSection.classList.add("hidden");
  openCart();
});

/* =========================================================
   PEDIDO
========================================================= */

const confirmOrderButton = document.querySelector(
  "#confirm-order-button"
);

confirmOrderButton.addEventListener("click", async () => {
  const cart = loadCart();

  if (!cart.length) {
    toast("Seu carrinho está vazio.");
    return;
  }

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    toast("Entre na sua conta antes de confirmar o pedido.");
    return;
  }

  confirmOrderButton.disabled = true;
  confirmOrderButton.textContent = "Criando pedido...";

  try {
    const items = cart.map(item => ({
      product_id: item.id,
      quantity: item.qty
    }));

    const { data, error } = await supabaseClient.rpc(
      "create_order",
      {
        p_items: items
      }
    );

    if (error) {
      console.error("Erro ao criar pedido:", error);

      toast(
        "Não foi possível criar o pedido: " +
          error.message
      );

      return;
    }

    console.log("Pedido criado:", data);

    clearCart();

    updateCartBadge(loadCart());

    toast("Pedido criado com sucesso! ✅");

    checkoutSection.classList.add("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  } finally {
    confirmOrderButton.disabled = false;
    confirmOrderButton.textContent = "Confirmar pedido";
  }
});

/* =========================================================
   ESTILO DO ADM
========================================================= */

function injectAdminStyles() {
  if (document.querySelector("#admin-styles")) return;

  const style = document.createElement("style");

  style.id = "admin-styles";

  style.textContent = `
    #admin-panel{
      margin:50px auto;
      max-width:1400px;
      padding:0 18px;
    }

    .admin-card{
      background:linear-gradient(160deg,#0b252d,#06171c);
      border:1px solid rgba(57,185,208,.25);
      border-radius:24px;
      padding:25px;
      box-shadow:0 20px 70px rgba(0,0,0,.25);
    }

    .admin-header{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:20px;
      margin-bottom:25px;
    }

    .admin-header h2{
      margin:4px 0;
      font-size:30px;
    }

    .admin-badge{
      background:rgba(57,185,208,.12);
      border:1px solid rgba(57,185,208,.25);
      color:#83dce7;
      padding:8px 12px;
      border-radius:99px;
      font-size:12px;
      font-weight:800;
    }

    .admin-settings{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:15px;
      margin-bottom:25px;
    }

    .admin-setting{
      background:#071a20;
      border:1px solid rgba(117,203,215,.18);
      border-radius:18px;
      padding:18px;
    }

    .admin-setting h3{
      margin:0 0 6px;
    }

    .admin-setting p{
      color:#829ba0;
      margin:0 0 14px;
      font-size:13px;
    }

    .admin-toggle{
      width:100%;
      border:1px solid rgba(117,203,215,.18);
      border-radius:12px;
      padding:12px;
      background:#0b242b;
      color:#d8edef;
      font-weight:800;
    }

    .admin-toggle.online{
      background:#124d43;
      border-color:#55d8a3;
      color:#9ff0ce;
    }

    .admin-form{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      margin-bottom:25px;
    }

    .admin-form label{
      display:flex;
      flex-direction:column;
      gap:6px;
      color:#cce1e4;
      font-weight:700;
      font-size:13px;
    }

    .admin-form input,
    .admin-form select{
      width:100%;
      padding:12px 13px;
      background:#071a20;
      color:#fff;
      border:1px solid rgba(117,203,215,.18);
      border-radius:12px;
      outline:0;
    }

    .admin-form input:focus,
    .admin-form select:focus{
      border-color:#39b9d0;
    }

    .admin-full{
      grid-column:1/-1;
    }

    .admin-form-actions{
      grid-column:1/-1;
      display:flex;
      gap:10px;
    }

    .admin-form-actions button{
      flex:1;
    }

    .admin-products{
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    .admin-product{
      display:grid;
      grid-template-columns:60px 1fr auto;
      gap:14px;
      align-items:center;
      padding:12px;
      border:1px solid rgba(117,203,215,.14);
      background:#07191f;
      border-radius:16px;
    }

    .admin-product img{
      width:60px;
      height:60px;
      object-fit:contain;
      background:#0b2026;
      border-radius:12px;
    }

    .admin-product-info strong{
      display:block;
      margin-bottom:4px;
    }

    .admin-product-info small{
      color:#789399;
    }

    .admin-product-actions{
      display:flex;
      gap:7px;
    }

    .admin-product-actions button{
      border:1px solid rgba(117,203,215,.18);
      background:#0b242b;
      border-radius:10px;
      padding:9px 11px;
      color:#d8edef;
    }

    .admin-product-actions button:hover{
      border-color:#39b9d0;
    }

    .admin-danger:hover{
      border-color:#ff6f91!important;
      color:#ff9ab2!important;
    }

    .admin-message{
      color:#83dce7;
      font-size:13px;
      margin:0 0 15px;
    }

    @media(max-width:700px){
      .admin-settings{
        grid-template-columns:1fr;
      }

      .admin-form{
        grid-template-columns:1fr;
      }

      .admin-product{
        grid-template-columns:50px 1fr;
      }

      .admin-product img{
        width:50px;
        height:50px;
      }

      .admin-product-actions{
        grid-column:1/-1;
      }

      .admin-header{
        align-items:flex-start;
        flex-direction:column;
      }
    }
  `;

  document.head.appendChild(style);
}

/* =========================================================
   CRIA PAINEL ADM
========================================================= */

function createAdminPanel() {
  if (document.querySelector("#admin-panel")) return;

  injectAdminStyles();

  const panel = document.createElement("section");

  panel.id = "admin-panel";

  panel.innerHTML = `
    <div class="admin-card">

      <div class="admin-header">
        <div>
          <p class="eyebrow">ADMINISTRAÇÃO</p>
          <h2>⚙️ Painel da Thoune Store</h2>
        </div>

        <span class="admin-badge">
          🔐 Administrador
        </span>
      </div>

      <div class="admin-settings">

        <div class="admin-setting">
          <h3>🟢 Atendimento</h3>
          <p>
            Controle se a loja está recebendo pedidos.
          </p>

          <button
            class="admin-toggle"
            id="admin-online-button"
          >
            Carregando...
          </button>
        </div>

        <div class="admin-setting">
          <h3>📊 Catálogo</h3>
          <p id="admin-product-message">
            Carregando produtos...
          </p>

          <button
            class="admin-toggle"
            id="admin-refresh-products"
          >
            🔄 Atualizar produtos
          </button>
        </div>

      </div>

      <div>
        <p class="eyebrow">PRODUTO</p>
        <h3 id="admin-form-title">
          ➕ Adicionar marreta
        </h3>

        <form class="admin-form" id="admin-product-form">

          <input
            type="hidden"
            id="admin-product-id"
          >

          <label>
            Nome
            <input
              id="admin-product-name"
              type="text"
              placeholder="Nome da marreta"
              required
            >
          </label>

          <label>
            Preço
            <input
              id="admin-product-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            >
          </label>

          <label>
            Categoria
            <select id="admin-product-category">
              <option value="Lendária">Lendária</option>
              <option value="Épica">Épica</option>
              <option value="Rara">Rara</option>
              <option value="Comum">Comum</option>
              <option value="Exclusiva">Exclusiva</option>
            </select>
          </label>

          <label>
            Estoque
            <input
              id="admin-product-stock"
              type="number"
              min="0"
              step="1"
              value="0"
              required
            >
          </label>

          <label>
            Ordem
            <input
              id="admin-product-order"
              type="number"
              min="0"
              step="1"
              value="0"
            >
          </label>

          <label>
            Popularidade
            <input
              id="admin-product-popularity"
              type="number"
              min="0"
              step="1"
              value="0"
            >
          </label>

          <label class="admin-full">
            URL da imagem
            <input
              id="admin-product-image"
              type="url"
              placeholder="https://..."
            >
          </label>

          <label class="admin-full">
            Descrição
            <input
              id="admin-product-description"
              type="text"
              placeholder="Descrição opcional"
            >
          </label>

          <div class="admin-form-actions">

            <button
              type="submit"
              class="primary-btn"
              id="admin-save-product"
            >
              ➕ Adicionar marreta
            </button>

            <button
              type="button"
              class="secondary-btn"
              id="admin-cancel-edit"
            >
              Cancelar
            </button>

          </div>

        </form>
      </div>

      <div>
        <p class="eyebrow">CATÁLOGO</p>
        <h3>📦 Marretas cadastradas</h3>

        <div
          class="admin-products"
          id="admin-products"
        ></div>
      </div>

    </div>
  `;

  document.querySelector("main").appendChild(panel);

  setupAdminEvents();
}

/* =========================================================
   REMOVE ADM
========================================================= */

function removeAdminPanel() {
  document.querySelector("#admin-panel")?.remove();
}

/* =========================================================
   EVENTOS DO ADM
========================================================= */

function setupAdminEvents() {
  const form = document.querySelector("#admin-product-form");

  form.addEventListener("submit", saveAdminProduct);

  document
    .querySelector("#admin-cancel-edit")
    .addEventListener("click", resetAdminForm);

  document
    .querySelector("#admin-refresh-products")
    .addEventListener("click", async () => {
      await loadAdminProducts();
      await loadProducts();
      toast("Catálogo atualizado.");
    });

  document
    .querySelector("#admin-online-button")
    .addEventListener("click", toggleStoreOnline);
}

/* =========================================================
   FORMULÁRIO ADM
========================================================= */

async function saveAdminProduct(event) {
  event.preventDefault();

  if (!currentIsAdmin) {
    toast("Acesso negado.");
    return;
  }

  const id = document
    .querySelector("#admin-product-id")
    .value
    .trim();

  const name = document
    .querySelector("#admin-product-name")
    .value
    .trim();

  const price = Number(
    document.querySelector("#admin-product-price").value
  );

  const category = document.querySelector(
    "#admin-product-category"
  ).value;

  const stock = Number(
    document.querySelector("#admin-product-stock").value
  );

  const sortOrder = Number(
    document.querySelector("#admin-product-order").value || 0
  );

  const popularity = Number(
    document.querySelector("#admin-product-popularity").value || 0
  );

  const image = document
    .querySelector("#admin-product-image")
    .value.trim();

  const description = document
    .querySelector("#admin-product-description")
    .value.trim();

  if (!name) {
    toast("Digite o nome da marreta.");
    return;
  }

  if (!Number.isFinite(price) || price < 0) {
    toast("Digite um preço válido.");
    return;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    toast("Digite um estoque válido.");
    return;
  }

  const payload = {
    name,
    price,
    category,
    stock,
    sort_order: sortOrder,
    popularity,
    image: image || null,
    description: description || null
  };

  const button = document.querySelector(
    "#admin-save-product"
  );

  button.disabled = true;
  button.textContent = id
    ? "Salvando..."
    : "Adicionando...";

  try {
    let error;

    if (id) {
      ({ error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", id));
    } else {
      ({ error } = await supabaseClient
        .from("products")
        .insert({
          ...payload,
          active: true
        }));
    }

    if (error) {
      console.error("Erro ao salvar produto:", error);
      toast("Erro: " + error.message);
      return;
    }

    toast(
      id
        ? "Marreta atualizada! ✅"
        : "Marreta adicionada! ✅"
    );

    resetAdminForm();

    await loadProducts();
    await loadAdminProducts();

  } finally {
    button.disabled = false;
  }
}

/* =========================================================
   RESET FORM
========================================================= */

function resetAdminForm() {
  const form = document.querySelector("#admin-product-form");

  if (!form) return;

  form.reset();

  document.querySelector("#admin-product-id").value = "";

  document.querySelector("#admin-product-stock").value = "0";
  document.querySelector("#admin-product-order").value = "0";
  document.querySelector("#admin-product-popularity").value = "0";

  document.querySelector("#admin-form-title").textContent =
    "➕ Adicionar marreta";

  document.querySelector("#admin-save-product").textContent =
    "➕ Adicionar marreta";
}

/* =========================================================
   EDITAR PRODUTO
========================================================= */

function editAdminProduct(product) {
  document.querySelector("#admin-product-id").value =
    product.id;

  document.querySelector("#admin-product-name").value =
    product.name || "";

  document.querySelector("#admin-product-price").value =
    product.price ?? "";

  document.querySelector("#admin-product-category").value =
    product.category || "Comum";

  document.querySelector("#admin-product-stock").value =
    product.stock ?? 0;

  document.querySelector("#admin-product-order").value =
    product.sort_order ?? 0;

  document.querySelector("#admin-product-popularity").value =
    product.popularity ?? 0;

  document.querySelector("#admin-product-image").value =
    product.image || "";

  document.querySelector("#admin-product-description").value =
    product.description || "";

  document.querySelector("#admin-form-title").textContent =
    "✏️ Editar marreta";

  document.querySelector("#admin-save-product").textContent =
    "💾 Salvar alterações";

  document
    .querySelector("#admin-panel")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

/* =========================================================
   ATIVAR / DESATIVAR
========================================================= */

async function toggleProduct(product) {
  if (!currentIsAdmin) return;

  const newStatus = !product.active;

  const { error } = await supabaseClient
    .from("products")
    .update({
      active: newStatus
    })
    .eq("id", product.id);

  if (error) {
    console.error("Erro ao alterar produto:", error);
    toast("Não foi possível alterar o produto.");
    return;
  }

  toast(
    newStatus
      ? "Marreta ativada! 🟢"
      : "Marreta desativada! 🔴"
  );

  await loadProducts();
  await loadAdminProducts();
}

/* =========================================================
   EXCLUIR
========================================================= */

async function deleteProduct(product) {
  if (!currentIsAdmin) return;

  const confirmed = confirm(
    `Excluir "${product.name}" permanentemente?`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", product.id);

  if (error) {
    console.error("Erro ao excluir produto:", error);

    toast(
      "Não foi possível excluir: " +
        error.message
    );

    return;
  }

  toast("Marreta excluída.");

  await loadProducts();
  await loadAdminProducts();
}

/* =========================================================
   RENDER ADM
========================================================= */

function renderAdminProducts(list) {
  const container = document.querySelector(
    "#admin-products"
  );

  if (!container) return;

  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `
      <p style="color:#829ba0">
        Nenhuma marreta cadastrada.
      </p>
    `;
    return;
  }

     row.className = "admin-product";

    const image = document.createElement("img");
    image.src = product.image || "";
    image.alt = product.name;

    const info = document.createElement("div");
    info.className = "admin-product-info";

    const name = document.createElement("strong");
    name.textContent = product.name;

    const details = document.createElement("small");
    details.textContent =
      `${product.category} · R$ ${Number(product.price).toFixed(2).replace(".", ",")} · Estoque: ${product.stock}`;

    info.appendChild(name);
    info.appendChild(details);

    const actions = document.createElement("div");
    actions.className = "admin-product-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "✏️ Editar";

    editButton.addEventListener("click", () => {
      editAdminProduct(product);
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.textContent =
      product.active ? "🔴 Desativar" : "🟢 Ativar";

    toggleButton.addEventListener("click", () => {
      toggleProduct(product);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "admin-danger";
    deleteButton.textContent = "🗑️ Excluir";

    deleteButton.addEventListener("click", () => {
      deleteProduct(product);
    });

    actions.appendChild(editButton);
    actions.appendChild(toggleButton);
    actions.appendChild(deleteButton);

    row.appendChild(image);
    row.appendChild(info);
    row.appendChild(actions);

    container.appendChild(row);
  });
}

/* =========================================================
   CONFIGURAÇÕES DA LOJA
========================================================= */

async function loadStoreSettings() {
  const button = document.querySelector("#admin-online-button");

  if (!button || !currentIsAdmin) return;

  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("online")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar configurações:", error);
    button.textContent = "Erro ao carregar";
    return;
  }

  const online = data?.online ?? false;

  updateOnlineButton(online);
}

/* =========================================================
   BOTÃO ONLINE / OFFLINE
========================================================= */

function updateOnlineButton(online) {
  const button = document.querySelector("#admin-online-button");

  if (!button) return;

  button.classList.toggle("online", online);

  button.textContent = online
    ? "🟢 Atendimento online"
    : "⚫ Atendimento offline";

  const status = document.querySelector(".online-pill");

  if (status) {
    status.innerHTML = online
      ? "<span></span> Atendimento online"
      : "<span></span> Atendimento offline";
  }
}

async function toggleStoreOnline() {
  if (!currentIsAdmin) {
    toast("Acesso negado.");
    return;
  }

  const button = document.querySelector("#admin-online-button");

  if (!button) return;

  button.disabled = true;

  const { data: currentSettings, error: readError } =
    await supabaseClient
      .from("store_settings")
      .select("online")
      .eq("id", 1)
      .maybeSingle();

  if (readError) {
    console.error("Erro ao ler atendimento:", readError);
    toast("Não foi possível carregar o atendimento.");
    button.disabled = false;
    return;
  }

  const newStatus = !(currentSettings?.online ?? false);

  const { error } = await supabaseClient
    .from("store_settings")
    .update({
      online: newStatus
    })
    .eq("id", 1);

  if (error) {
    console.error("Erro ao atualizar atendimento:", error);
    toast("Não foi possível alterar o atendimento.");
    button.disabled = false;
    return;
  }

  updateOnlineButton(newStatus);

  toast(
    newStatus
      ? "Atendimento aberto! 🟢"
      : "Atendimento fechado. ⚫"
  );

  button.disabled = false;
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

async function init() {
  try {
    await loadProducts();
  } catch (error) {
    console.error("ERRO AO CARREGAR PRODUTOS:", error);
  }

  try {
    await updateAccountUI();
  } catch (error) {
    console.error("ERRO AO CARREGAR CONTA:", error);
    toast("Erro ao carregar sua conta.");
  }
}

init();
