import { loadCart, orderText, clearCart, cartTotal, money } from "./cart.js";
import { renderProducts, renderCart, updateCartBadge, toast } from "./ui.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===============================
// ELEMENTOS DA CONTA
// ===============================

const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const loginButton = document.querySelector("#login-button");
const signupButton = document.querySelector("#signup-button");
const logoutButton = document.querySelector("#logout-button");

const accountMessage = document.querySelector("#account-message");
const accountDetails = document.querySelector("#account-details");
const accountEmail = document.querySelector("#account-email");
const ordersMessage = document.querySelector("#orders-message");
const ordersList = document.querySelector("#orders-list");

const profileFields = document.querySelector("#profile-fields");
const tiktokUsername = document.querySelector("#tiktok-username");
const robloxUsername = document.querySelector("#roblox-username");
const saveProfileButton = document.querySelector("#save-profile-button");
const profileMessage = document.querySelector("#profile-message");

// ===============================
// PERFIL
// ===============================

async function loadProfile(userId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("tiktok_username, roblox_username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar perfil:", error);
    return;
  }

  if (data) {
    tiktokUsername.value = data.tiktok_username || "";
    robloxUsername.value = data.roblox_username || "";
  }
}

// ===============================
// STATUS DO ATENDIMENTO
// ===============================

async function loadStoreStatus() {
  const statusElement = document.querySelector("#service-status");

  if (!statusElement) return;

  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("online")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar status:", error);
    return;
  }

  const online = Boolean(data?.online);

  statusElement.innerHTML = online
    ? "<span></span> Atendimento online"
    : "<span></span> Atendimento offline";

  statusElement.classList.toggle("online", online);
  statusElement.classList.toggle("offline", !online);
}

loadStoreStatus();

// ===============================
// CONFIGURAÇÃO DO BOT
// ===============================

async function loadDeliverySettings() {
  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("delivery_bot_username, join_open")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao carregar configuração do bot:", error);
    return {
      bot_username: "",
      join_open: false
    };
  }

  return {
    bot_username: data?.delivery_bot_username || "",
    join_open: Boolean(data?.join_open)
  };
}

// ===============================
// MENSAGEM DE ENTREGA
// ===============================

function getOrderNumber(orderId) {
  return orderId ? orderId.slice(0, 8).toUpperCase() : "--------";
}

function createDeliveryMessage(order, items, settings) {
  const orderNumber = getOrderNumber(order.id);

  const itemLines = items.length
    ? items
        .map(item => `${item.product_name} × ${item.quantity}`)
        .join("\n")
    : "Itens do pedido";

  const botName = settings.bot_username
    ? `@${settings.bot_username.replace(/^@/, "")}`
    : "Bot da Thoune Store";

  const joinText = settings.join_open
    ? "🔓 O perfil está com Join Aberto. Entre no mesmo servidor que o bot e aguarde a entrega."
    : "🔎 Pesquise pelo perfil do nosso bot no Roblox e siga as instruções de entrega.";

  return `📦 Seu pedido está pronto para entrega!

🛒 Pedido: #${orderNumber}

📋 Itens do pedido:
${itemLines}

🤖 Bot de entrega: ${botName}

🔎 Para receber sua entrega, pesquise pelo perfil do nosso bot no Roblox e entre no mesmo servidor que ele.

${joinText}

🐬🌊 Thoune Store`;
}

// ===============================
// PEDIDOS DO CLIENTE
// ===============================

function statusLabel(status) {
  const labels = {
    awaiting_payment: "Aguardando pagamento",
    awaiting_verification: "Aguardando verificação",
    payment_confirmed: "Pagamento confirmado",
    awaiting_delivery: "Aguardando entrega",
    delivered: "Entregue",
    cancelled: "Cancelado"
  };

  return labels[status] || status;
}

function statusClass(status) {
  return `order-status-${status}`;
}

async function requestPaymentVerification(orderId, button) {
  button.disabled = true;
  button.textContent = "Enviando...";

  try {
    const { error } = await supabaseClient.rpc(
      "request_payment_verification",
      {
        p_order_id: orderId
      }
    );

    if (error) {
      console.error(error);
      toast("Não foi possível solicitar a verificação.");
      return;
    }

    localStorage.removeItem("thoune_current_order");

    toast("Pagamento informado! Aguardando verificação. ✅");

    await loadCustomerOrders();
  } finally {
    button.disabled = false;
    button.textContent = "🔎 Verificar pagamento";
  }
}

async function loadCustomerOrders() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session?.user || !ordersList) return;

  ordersList.innerHTML = "";

  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select("id, status, total, created_at")
    .eq("customer_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar pedidos:", error);
    ordersMessage.textContent = "Não foi possível carregar seus pedidos.";
    return;
  }

  if (!orders || !orders.length) {
    ordersMessage.textContent = "Você ainda não possui pedidos.";
    ordersMessage.classList.remove("hidden");
    return;
  }

  ordersMessage.classList.add("hidden");

  const settings = await loadDeliverySettings();

  for (const order of orders) {
    const card = document.createElement("article");
    card.className = "customer-order";

    const header = document.createElement("div");
    header.className = "customer-order-header";

    const title = document.createElement("strong");
    title.textContent = `Pedido #${getOrderNumber(order.id)}`;

    const status = document.createElement("span");
    status.className = `order-status ${statusClass(order.status)}`;
    status.textContent = statusLabel(order.status);

    header.appendChild(title);
    header.appendChild(status);

    const date = document.createElement("small");
    date.textContent = new Date(order.created_at).toLocaleString("pt-BR");

    const { data: items, error: itemsError } = await supabaseClient
      .from("order_items")
      .select("product_name, quantity, product_price")
      .eq("order_id", order.id);

    if (itemsError) {
      console.error("Erro ao carregar itens:", itemsError);
    }

    const itemList = document.createElement("div");
    itemList.className = "customer-order-items";

    for (const item of items || []) {
      const itemRow = document.createElement("div");

      const itemName = document.createElement("span");
      itemName.textContent = `${item.product_name} × ${item.quantity}`;

      itemRow.appendChild(itemName);
      itemList.appendChild(itemRow);
    }

    card.appendChild(header);
    card.appendChild(date);
    card.appendChild(itemList);

    // ===============================
    // PAGAMENTO
    // ===============================

    if (order.status === "awaiting_payment") {
      const paymentBox = document.createElement("div");
      paymentBox.className = "order-action-box";

      const text = document.createElement("p");
      text.textContent =
        "Realize o Pix mostrado no checkout e depois informe que o pagamento foi realizado.";

      const button = document.createElement("button");
      button.className = "secondary-button full";
      button.textContent = "🔎 Verificar pagamento";

      button.addEventListener("click", () => {
        requestPaymentVerification(order.id, button);
      });

      paymentBox.appendChild(text);
      paymentBox.appendChild(button);
      card.appendChild(paymentBox);
    }

    // ===============================
    // AGUARDANDO VERIFICAÇÃO
    // ===============================

    if (order.status === "awaiting_verification") {
      const info = document.createElement("div");
      info.className = "order-info-box";
      info.textContent =
        "⏳ Seu pagamento foi informado e está aguardando a confirmação da loja.";
      card.appendChild(info);
    }

    // ===============================
    // PAGAMENTO CONFIRMADO
    // ===============================

    if (order.status === "payment_confirmed") {
      const info = document.createElement("div");
      info.className = "order-info-box";
      info.textContent =
        "✅ Pagamento confirmado! Sua entrega está sendo preparada.";
      card.appendChild(info);
    }

    // ===============================
    // ENTREGA
    // ===============================

    if (order.status === "awaiting_delivery") {
      const deliveryBox = document.createElement("div");
      deliveryBox.className = "delivery-instructions";

      const title = document.createElement("h4");
      title.textContent = "📦 Seu pedido está pronto para entrega!";

      const message = document.createElement("pre");
      message.className = "delivery-message";
      message.textContent = createDeliveryMessage(
        order,
        items || [],
        settings
      );

      const copyButton = document.createElement("button");
      copyButton.className = "secondary-button full";
      copyButton.textContent = "📋 Copiar instruções";

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(message.textContent);
          toast("Instruções copiadas! ✅");
        } catch {
          toast("Não foi possível copiar automaticamente.");
        }
      });

      deliveryBox.appendChild(title);
      deliveryBox.appendChild(message);
      deliveryBox.appendChild(copyButton);

      card.appendChild(deliveryBox);
    }

    // ===============================
    // ENTREGUE
    // ===============================

    if (order.status === "delivered") {
      const info = document.createElement("div");
      info.className = "order-success-box";
      info.textContent = "✅ Pedido entregue com sucesso!";
      card.appendChild(info);
    }

    ordersList.appendChild(card);
  }
}

// ===============================
// UI DA CONTA
// ===============================

async function updateAccountUI() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    accountDetails.classList.remove("hidden");
    accountEmail.textContent = session.user.email || "";

    profileFields.classList.remove("hidden");
    profileFields.style.display = "block";

    accountMessage.textContent =
      "Você está conectado à sua conta.";

    loginButton.classList.add("hidden");
    signupButton.classList.add("hidden");
    logoutButton.classList.remove("hidden");

    authEmail.value = session.user.email || "";
    authEmail.disabled = true;
    authPassword.classList.add("hidden");

    await loadProfile(session.user.id);
    await loadCustomerOrders();

  } else {
    profileFields.classList.add("hidden");
    accountDetails.classList.add("hidden");

    accountEmail.textContent = "";
    ordersMessage.textContent =
      "Você ainda não possui pedidos.";

    accountMessage.textContent =
      "Entre ou crie sua conta para acompanhar seus pedidos.";

    loginButton.classList.remove("hidden");
    signupButton.classList.remove("hidden");
    logoutButton.classList.add("hidden");

    authEmail.disabled = false;
    authPassword.classList.remove("hidden");
  }
}

// ===============================
// LOGIN
// ===============================

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

  toast("Login realizado com sucesso! ✅");
  await updateAccountUI();
});

// ===============================
// CADASTRO
// ===============================

signupButton.addEventListener("click", async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    toast("Preencha seu e-mail e sua senha.");
    return;
  }

  if (password.length < 6) {
    toast("A senha precisa ter pelo menos 6 caracteres.");
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

  toast("Conta criada com sucesso! ✅");
  await updateAccountUI();
});

// ===============================
// LOGOUT
// ===============================

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

// ===============================
// SALVAR PERFIL
// ===============================

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

  profileMessage.textContent =
    "Informações salvas com sucesso! ✅";

  toast("Perfil atualizado!");
});

// ===============================
// PRODUTOS
// ===============================

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

loadProducts();

const menuToggle = document.querySelector("#menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");

menuToggle.addEventListener("click", () => {
  mobileNav.classList.toggle("open");
});

mobileNav.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", () => {
    mobileNav.classList.remove("open");
  });
});

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

function filtered() {
  let result = products.filter(product => {
    const categoryMatch =
      selectedCategory === "Todas" ||
      product.category === selectedCategory;

    const searchMatch =
      product.name.toLowerCase().includes(search);

    return product.active && categoryMatch && searchMatch;
  });

  if (sort === "low") {
    result.sort((a, b) => a.price - b.price);
  }

  if (sort === "high") {
    result.sort((a, b) => b.price - a.price);
  }

  // Não usa mais uma coluna popularity inexistente.
  if (sort === "popular") {
    result.sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );
  }

  return result;
}

function refresh() {
  renderProducts(filtered());
}

// ===============================
// CARRINHO
// ===============================

const drawer = document.querySelector("#cart-drawer");
const checkoutSection = document.querySelector("#checkout-section");
const checkoutItems = document.querySelector("#checkout-items");
const checkoutTiktok = document.querySelector("#checkout-tiktok");
const checkoutRoblox = document.querySelector("#checkout-roblox");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutBack = document.querySelector("#checkout-back");

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
  if (e.key === "Escape") closeCart();
});

// ===============================
// COPIAR PEDIDO
// ===============================

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
      toast("Pedido copiado! ✅");
    } catch {
      toast("Não foi possível copiar automaticamente.");
    }
  });

// ===============================
// CHECKOUT
// ===============================

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

// ===============================
// CRIAR PEDIDO
// ===============================

let currentOrderId =
  localStorage.getItem("thoune_current_order") || null;

const verifyPaymentButton = document.querySelector(
  "#verify-payment-button"
);

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

  const pixName = document
    .getElementById("checkout-pix-name")
    .value
    .trim();

  const robloxName = checkoutRoblox.value.trim();

  if (!robloxName) {
    toast("Informe seu usuário do Roblox.");
    return;
  }

  if (!pixName) {
    toast("Informe o nome do remetente do Pix.");
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
        p_items: items,
        p_pix_name: pixName,
        p_delivery_username: robloxName
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

    currentOrderId = data.order_id;

    localStorage.setItem(
      "thoune_current_order",
      currentOrderId
    );

    clearCart();
    updateCartBadge(loadCart());

    toast("Pedido criado com sucesso! ✅");

    confirmOrderButton.classList.add("hidden");
    verifyPaymentButton.classList.remove("hidden");

    await loadCustomerOrders();

  } finally {
    confirmOrderButton.disabled = false;
    confirmOrderButton.textContent = "Confirmar pedido";
  }
});

// ===============================
// VERIFICAR PAGAMENTO
// ===============================

verifyPaymentButton.addEventListener("click", async () => {
  if (!currentOrderId) {
    toast("Nenhum pedido aguardando verificação.");
    return;
  }

  verifyPaymentButton.disabled = true;
  verifyPaymentButton.textContent = "Enviando...";

  try {
    const { error } = await supabaseClient.rpc(
      "request_payment_verification",
      {
        p_order_id: currentOrderId
      }
    );

    if (error) {
      console.error(
        "Erro ao solicitar verificação:",
        error
      );

      toast(
        "Não foi possível enviar a verificação: " +
          error.message
      );

      return;
    }

    verifyPaymentButton.classList.add("hidden");

    localStorage.removeItem("thoune_current_order");
    currentOrderId = null;

    toast(
      "Pagamento informado! Aguardando verificação. ✅"
    );

    await loadCustomerOrders();

  } finally {
    verifyPaymentButton.disabled = false;
    verifyPaymentButton.textContent =
      "🔎 Verificar pagamento";
  }
});

// ===============================
// INICIALIZAÇÃO
// ===============================

refresh();
updateCartBadge(loadCart());
updateAccountUI();
