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


/* =========================================================
   SUPABASE
========================================================= */

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


/* =========================================================
   ELEMENTOS DA CONTA
========================================================= */

const authEmail =
  document.querySelector("#auth-email");

const authPassword =
  document.querySelector("#auth-password");

const loginButton =
  document.querySelector("#login-button");

const signupButton =
  document.querySelector("#signup-button");

const logoutButton =
  document.querySelector("#logout-button");

const accountMessage =
  document.querySelector("#account-message");

const accountDetails =
  document.querySelector("#account-details");

const accountEmail =
  document.querySelector("#account-email");

const ordersMessage =
  document.querySelector("#orders-message");

const ordersList =
  document.querySelector("#orders-list");

const profileFields =
  document.querySelector("#profile-fields");

const tiktokUsername =
  document.querySelector("#tiktok-username");

const robloxUsername =
  document.querySelector("#roblox-username");

const saveProfileButton =
  document.querySelector("#save-profile-button");

const profileMessage =
  document.querySelector("#profile-message");


/* =========================================================
   PAINÉIS DA CONTA
========================================================= */

const ordersPanel =
  document.querySelector("#orders-panel");

const notificationsPanel =
  document.querySelector(
    "#notifications-panel"
  );

const profilePanel =
  document.querySelector(
    "#profile-panel"
  );

const notificationsList =
  document.querySelector(
    "#notifications-list"
  );

const notificationsMessage =
  document.querySelector(
    "#notifications-message"
  );

const openOrdersPanel =
  document.querySelector(
    "#open-orders-panel"
  );

const openNotificationsPanel =
  document.querySelector(
    "#open-notifications-panel"
  );

const openProfilePanel =
  document.querySelector(
    "#open-profile-panel"
  );

const profilePanelTiktok =
  document.querySelector(
    "#profile-panel-tiktok"
  );

const profilePanelRoblox =
  document.querySelector(
    "#profile-panel-roblox"
  );

const profilePanelSave =
  document.querySelector(
    "#profile-panel-save"
  );


/* =========================================================
   PEDIDO ATUAL / PAINEL FLUTUANTE
========================================================= */

const currentOrderPanel =
  document.querySelector(
    "#current-order-panel"
  );

const currentOrderContent =
  document.querySelector(
    "#current-order-content"
  );

const closeCurrentOrderPanel =
  document.querySelector(
    "#close-current-order-panel"
  );

const openOrdersFromFloating =
  document.querySelector(
    "#open-orders-from-floating"
  );


/* =========================================================
   CONFIGURAÇÕES PÚBLICAS
========================================================= */

let storeSettings = {
  online: false,
  pix_key: "",
  delivery_bot_username: "",
  join_open: false,
  discount_percent: 0,
  discount_active: false
};


async function loadPublicStoreSettings() {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("public_store_settings")
      .select(
        "online, pix_key, delivery_bot_username, join_open, discount_percent, discount_active"
      )
      .eq("id", 1)
      .maybeSingle();


  if (error) {
    console.error(
      "Erro ao carregar configurações públicas:",
      error
    );

    return storeSettings;
  }


  storeSettings = {
    online:
      Boolean(data?.online),

    pix_key:
      data?.pix_key || "",

    delivery_bot_username:
      data?.delivery_bot_username || "",

    join_open:
      Boolean(data?.join_open),

    discount_percent:
      Number(
        data?.discount_percent
      ) || 0,

    discount_active:
      Boolean(
        data?.discount_active
      )
  };


  return storeSettings;
}


function getEffectivePrice(price) {
  const basePrice =
    Number(price) || 0;


  if (
    !storeSettings.discount_active ||
    storeSettings.discount_percent <= 0
  ) {
    return basePrice;
  }


  const discount =
    storeSettings.discount_percent /
    100;


  return Number(
    (
      basePrice *
      (1 - discount)
    ).toFixed(2)
  );
}


/* =========================================================
   PERFIL
========================================================= */

async function loadProfile(userId) {
  if (!userId) return;


  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "tiktok_username, roblox_username"
      )
      .eq("id", userId)
      .maybeSingle();


  if (error) {
    console.error(
      "Erro ao carregar perfil:",
      error
    );

    return;
  }


  const tiktok =
    data?.tiktok_username || "";

  const roblox =
    data?.roblox_username || "";


  if (tiktokUsername) {
    tiktokUsername.value =
      tiktok;
  }


  if (robloxUsername) {
    robloxUsername.value =
      roblox;
  }


  if (profilePanelTiktok) {
    profilePanelTiktok.value =
      tiktok;
  }


  if (profilePanelRoblox) {
    profilePanelRoblox.value =
      roblox;
  }
}


/* =========================================================
   STATUS DA LOJA
========================================================= */

async function loadStoreStatus() {
  const statusElement =
    document.querySelector(
      "#service-status"
    );


  if (!statusElement) return;


  await loadPublicStoreSettings();


  const online =
    Boolean(
      storeSettings.online
    );


  statusElement.innerHTML =
    online
      ? "<span></span> Atendimento online"
      : "<span></span> Atendimento offline";


  statusElement.classList.toggle(
    "online",
    online
  );

  statusElement.classList.toggle(
    "offline",
    !online
  );
}


/* =========================================================
   CONFIGURAÇÃO DE ENTREGA
========================================================= */

async function loadDeliverySettings() {
  await loadPublicStoreSettings();


  return {
    bot_username:
      storeSettings.delivery_bot_username,

    join_open:
      storeSettings.join_open
  };
}


/* =========================================================
   NÚMERO DO PEDIDO
========================================================= */

function getOrderNumber(orderId) {
  return orderId
    ? String(orderId)
        .slice(0, 8)
        .toUpperCase()
    : "--------";
}


/* =========================================================
   MENSAGEM DE ENTREGA
========================================================= */

function createDeliveryMessage(
  order,
  items,
  settings
) {
  const orderNumber =
    getOrderNumber(order.id);


  const itemLines =
    items.length
      ? items
          .map(
            item =>
              `${item.product_name} × ${item.quantity}`
          )
          .join("\n")
      : "Itens do pedido";


  const botName =
    settings.bot_username
      ? `@${String(
          settings.bot_username
        ).replace(/^@/, "")}`
      : "Bot da Thoune Store";


  const joinText =
    settings.join_open
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


/* =========================================================
   STATUS DOS PEDIDOS
========================================================= */

function statusLabel(status) {
  const labels = {
    awaiting_payment:
      "Aguardando pagamento",

    awaiting_verification:
      "Aguardando verificação",

    payment_confirmed:
      "Pagamento confirmado",

    awaiting_delivery:
      "Aguardando entrega",

    delivered:
      "Entregue",

    cancelled:
      "Cancelado"
  };


  return (
    labels[status] ||
    status ||
    "Status desconhecido"
  );
}


function statusClass(status) {
  return status || "";
}


/* =========================================================
   PEDIDO ATUAL
========================================================= */

let currentOrderId =
  localStorage.getItem(
    "thoune_current_order"
  ) || null;


function closeCurrentOrder() {
  currentOrderPanel?.classList.add(
    "hidden"
  );
}


function openCurrentOrder() {
  if (!currentOrderPanel) return;

  currentOrderPanel.classList.remove(
    "hidden"
  );
}


function clearCurrentOrderStorage() {
  localStorage.removeItem(
    "thoune_current_order"
  );

  currentOrderId = null;
}


/* =========================================================
   CARREGAR PEDIDO ATUAL
========================================================= */

async function loadCurrentOrder() {
  if (
    !currentOrderPanel ||
    !currentOrderContent ||
    !currentOrderId
  ) {
    return;
  }


  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth.getSession();


  if (!session?.user) {
    closeCurrentOrder();
    return;
  }


  const {
    data: order,
    error
  } =
    await supabaseClient
      .from("orders")
      .select(
        "id, status, total, created_at"
      )
      .eq(
        "id",
        currentOrderId
      )
      .eq(
        "customer_id",
        session.user.id
      )
      .maybeSingle();


  if (error) {
    console.error(
      "Erro ao carregar pedido atual:",
      error
    );

    return;
  }


  if (!order) {
    clearCurrentOrderStorage();
    closeCurrentOrder();
    return;
  }


  const {
    data: items,
    error: itemsError
  } =
    await supabaseClient
      .from("order_items")
      .select(
        "product_name, quantity, product_price"
      )
      .eq(
        "order_id",
        order.id
      );


  if (itemsError) {
    console.error(
      "Erro ao carregar itens do pedido atual:",
      itemsError
    );
  }


  renderCurrentOrder(
    order,
    items || []
  );
}


function renderCurrentOrder(
  order,
  items
) {
  if (
    !currentOrderContent ||
    !currentOrderPanel
  ) {
    return;
  }


  currentOrderContent.innerHTML =
    "";


  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    `Pedido #${getOrderNumber(
      order.id
    )}`;


  const status =
    document.createElement(
      "span"
    );

  status.className =
    `order-status ${statusClass(
      order.status
    )}`;

  status.textContent =
    statusLabel(
      order.status
    );


  const itemBox =
    document.createElement(
      "div"
    );

  itemBox.className =
    "current-order-items";


  for (const item of items) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "current-order-item";


    const name =
      document.createElement(
        "span"
      );

    name.textContent =
      `${item.product_name} × ${item.quantity}`;


    const price =
      document.createElement(
        "strong"
      );

    price.textContent =
      money(
        Number(
          item.product_price
        ) *
        Number(
          item.quantity
        )
      );


    row.appendChild(name);
    row.appendChild(price);

    itemBox.appendChild(row);
  }


  const total =
    document.createElement(
      "strong"
    );

  total.className =
    "current-order-total";

  total.textContent =
    `Total: ${money(
      order.total
    )}`;


  currentOrderContent.appendChild(
    title
  );

  currentOrderContent.appendChild(
    status
  );

  currentOrderContent.appendChild(
    itemBox
  );

  currentOrderContent.appendChild(
    total
  );


  if (
    order.status ===
    "awaiting_payment"
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "Realize o Pix e depois informe o pagamento.";

    currentOrderContent.appendChild(
      message
    );
  }


  if (
    order.status ===
    "awaiting_verification"
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "⏳ Pagamento informado. A loja está verificando.";

    currentOrderContent.appendChild(
      message
    );
  }


  if (
    order.status ===
    "payment_confirmed"
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "✅ Pagamento confirmado! Seu pedido está aguardando entrega.";

    currentOrderContent.appendChild(
      message
    );
  }


  if (
    order.status ===
    "awaiting_delivery"
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "📦 Seu pedido está aguardando entrega.";

    currentOrderContent.appendChild(
      message
    );
  }


  if (
    order.status ===
    "delivered"
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "✅ Pedido entregue com sucesso!";

    currentOrderContent.appendChild(
      message
    );
  }


  if (
    order.status ===
    "cancelled"
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "❌ Este pedido foi cancelado.";

    currentOrderContent.appendChild(
      message
    );
  }


  openCurrentOrder();
}


/* =========================================================
   CONTROLES DO PEDIDO ATUAL
========================================================= */

closeCurrentOrderPanel?.addEventListener(
  "click",
  closeCurrentOrder
);


openOrdersFromFloating?.addEventListener(
  "click",
  async () => {
    closeCurrentOrder();

    openAccountPanel(
      ordersPanel
    );

    await loadCustomerOrders();

    document
      .querySelector(
        "#conta"
      )
      ?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });
  }
);


/* =========================================================
   VERIFICAÇÃO DE PAGAMENTO
========================================================= */

async function requestPaymentVerification(
  orderId,
  button
) {
  if (
    !orderId ||
    !button
  ) {
    return;
  }


  button.disabled =
    true;

  button.textContent =
    "Enviando...";


  try {
    const {
      error
    } =
      await supabaseClient.rpc(
        "request_payment_verification",
        {
          p_order_id:
            orderId
        }
      );


    if (error) {
      console.error(
        "Erro ao solicitar verificação:",
        error
      );

      toast(
        "Não foi possível solicitar a verificação."
      );

      return;
    }


    if (
      currentOrderId ===
      orderId
    ) {
      clearCurrentOrderStorage();
    }


    toast(
      "Pagamento informado! Aguardando verificação. ✅"
    );


    await loadCustomerOrders();

    await loadCurrentOrder();

  } finally {
    button.disabled =
      false;

    button.textContent =
      "🔎 Verificar pagamento";
  }
}


/* =========================================================
   AVALIAÇÕES
========================================================= */

async function checkExistingReview(
  orderId
) {
  const {
    data,
    error
  } =
    await supabaseClient
      .from("reviews")
      .select(
        "id, status, rating, text"
      )
      .eq(
        "order_id",
        orderId
      )
      .maybeSingle();


  if (error) {
    console.error(
      "Erro ao verificar avaliação:",
      error
    );

    return null;
  }


  return data;
}


function createReviewForm(
  order
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "review-form";


  const title =
    document.createElement(
      "h4"
    );

  title.textContent =
    "⭐ Avalie seu pedido";


  const description =
    document.createElement(
      "p"
    );

  description.textContent =
    "Sua avaliação ajuda outros clientes e a Thoune Store.";


  const stars =
    document.createElement(
      "div"
    );

  stars.className =
    "review-stars";


  let selectedRating =
    0;


  for (
    let i = 1;
    i <= 5;
    i++
  ) {
    const star =
      document.createElement(
        "button"
      );

    star.type =
      "button";

    star.className =
      "review-star";

    star.textContent =
      "☆";

    star.setAttribute(
      "aria-label",
      `${i} estrela${
        i > 1
          ? "s"
          : ""
      }`
    );


    star.addEventListener(
      "click",
      () => {
        selectedRating =
          i;


        stars
          .querySelectorAll(
            ".review-star"
          )
          .forEach(
            (
              button,
              index
            ) => {
              button.textContent =
                index < i
                  ? "★"
                  : "☆";

              button.classList.toggle(
                "selected",
                index < i
              );
            }
          );
      }
    );


    stars.appendChild(
      star
    );
  }


  const textarea =
    document.createElement(
      "textarea"
    );

  textarea.className =
    "review-text";

  textarea.placeholder =
    "Conte como foi sua experiência...";

  textarea.maxLength =
    500;

  textarea.rows =
    4;


  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.className =
    "primary-button full";

  button.textContent =
    "⭐ Enviar avaliação";


  const message =
    document.createElement(
      "p"
    );

  message.className =
    "message";


  button.addEventListener(
    "click",
    async () => {
      if (!selectedRating) {
        toast(
          "Escolha uma nota de 1 a 5 estrelas."
        );

        return;
      }


      button.disabled =
        true;

      button.textContent =
        "Enviando...";


      try {
        const {
          error
        } =
          await supabaseClient.rpc(
            "create_review",
            {
              p_order_id:
                order.id,

              p_rating:
                selectedRating,

              p_text:
                textarea.value.trim()
            }
          );


        if (error) {
          console.error(
            "Erro ao enviar avaliação:",
            error
          );

          toast(
            "Não foi possível enviar sua avaliação."
          );

          return;
        }


        message.textContent =
          "Avaliação enviada! Ela ficará aguardando aprovação da loja. ✅";

        message.classList.add(
          "success"
        );


        button.classList.add(
          "hidden"
        );

        textarea.disabled =
          true;


        stars
          .querySelectorAll(
            ".review-star"
          )
          .forEach(
            star => {
              star.disabled =
                true;
            }
          );


        toast(
          "Avaliação enviada com sucesso! ⭐"
        );

      } finally {
        button.disabled =
          false;

        if (
          !button.classList.contains(
            "hidden"
          )
        ) {
          button.textContent =
            "⭐ Enviar avaliação";
        }
      }
    }
  );


  box.appendChild(
    title
  );

  box.appendChild(
    description
  );

  box.appendChild(
    stars
  );

  box.appendChild(
    textarea
  );

  box.appendChild(
    button
  );

  box.appendChild(
    message
  );


  return box;
}


function createReviewStatus(
  review
) {
  const box =
    document.createElement(
      "div"
    );

  box.className =
    "order-info-box";


  if (
    review.status ===
    "pending"
  ) {
    box.textContent =
      "⭐ Sua avaliação foi enviada e está aguardando aprovação da loja.";

  } else if (
    review.status ===
    "approved"
  ) {
    box.textContent =
      "⭐ Sua avaliação foi aprovada e está publicada na comunidade!";

  } else if (
    review.status ===
    "rejected"
  ) {
    box.textContent =
      "Sua avaliação não foi aprovada.";

  } else {
    box.textContent =
      "Sua avaliação está sendo analisada pela loja.";
  }


  return box;
}


/* =========================================================
   CRIAR CARD DO PEDIDO
========================================================= */

function createOrderCard(
  order,
  items,
  settings
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "order-card customer-order";


  /* ---------- Cabeçalho ---------- */

  const header =
    document.createElement(
      "div"
    );

  header.className =
    "order-card-header customer-order-header";


  const titleBox =
    document.createElement(
      "div"
    );


  const title =
    document.createElement(
      "strong"
    );

  title.className =
    "order-card-number";

  title.textContent =
    `Pedido #${getOrderNumber(
      order.id
    )}`;


  const date =
    document.createElement(
      "small"
    );

  date.className =
    "order-card-date";

  date.textContent =
    new Date(
      order.created_at
    ).toLocaleString(
      "pt-BR"
    );


  titleBox.appendChild(
    title
  );

  titleBox.appendChild(
    date
  );


  const status =
    document.createElement(
      "span"
    );

  status.className =
    `order-status ${statusClass(
      order.status
    )}`;

  status.textContent =
    statusLabel(
      order.status
    );


  header.appendChild(
    titleBox
  );

  header.appendChild(
    status
  );

  card.appendChild(
    header
  );


  /* ---------- Itens ---------- */

  const itemList =
    document.createElement(
      "div"
    );

  itemList.className =
    "order-card-items customer-order-items";


  for (
    const item of items || []
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "order-card-item";


    const name =
      document.createElement(
        "span"
      );

    name.textContent =
      `${item.product_name} × ${item.quantity}`;


    const price =
      document.createElement(
        "strong"
      );

    price.textContent =
      money(
        Number(
          item.product_price
        ) *
        Number(
          item.quantity
        )
      );


    row.appendChild(
      name
    );

    row.appendChild(
      price
    );

    itemList.appendChild(
      row
    );
  }


  card.appendChild(
    itemList
  );


  /* ---------- Total ---------- */

  const footer =
    document.createElement(
      "div"
    );

  footer.className =
    "order-card-footer";


  const total =
    document.createElement(
      "strong"
    );

  total.className =
    "order-card-total";

  total.textContent =
    money(order.total);


  footer.appendChild(
    total
  );

  card.appendChild(
    footer
  );


  /* =======================================================
     AGUARDANDO PAGAMENTO
  ======================================================= */

  if (
    order.status ===
    "awaiting_payment"
  ) {
    const box =
      document.createElement(
        "div"
      );

    box.className =
      "order-action-box";


    const text =
      document.createElement(
        "p"
      );

    text.textContent =
      "Seu pedido foi criado. Realize o Pix mostrado no checkout e depois informe o pagamento.";


    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "secondary-button full";

    button.textContent =
      "🔎 Verificar pagamento";


    button.addEventListener(
      "click",
      () => {
        requestPaymentVerification(
          order.id,
          button
        );
      }
    );


    box.appendChild(
      text
    );

    box.appendChild(
      button
    );

    card.appendChild(
      box
    );
  }


  /* =======================================================
     AGUARDANDO VERIFICAÇÃO
  ======================================================= */

  if (
    order.status ===
    "awaiting_verification"
  ) {
    const info =
      document.createElement(
        "div"
      );

    info.className =
      "order-info-box";

    info.textContent =
      "⏳ Pagamento informado. A loja está verificando seu pagamento.";


    card.appendChild(
      info
    );
  }


  /* =======================================================
     PAGAMENTO CONFIRMADO
  ======================================================= */

  if (
    order.status ===
    "payment_confirmed"
  ) {
    const info =
      document.createElement(
        "div"
      );

    info.className =
      "order-confirmed-message";

    info.textContent =
      "✅ Pagamento confirmado! Seu pedido está aguardando entrega.";


    card.appendChild(
      info
    );
  }


  /* =======================================================
     AGUARDANDO ENTREGA
  ======================================================= */

  if (
    order.status ===
    "awaiting_delivery"
  ) {
    const deliveryBox =
      document.createElement(
        "div"
      );

    deliveryBox.className =
      "order-delivery-message delivery-instructions";


    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      "📦 Seu pedido está aguardando entrega.";


    const message =
      document.createElement(
        "pre"
      );

    message.className =
      "delivery-message";

    message.textContent =
      createDeliveryMessage(
        order,
        items || [],
        settings
      );


    const copyButton =
      document.createElement(
        "button"
      );

    copyButton.type =
      "button";

    copyButton.className =
      "secondary-button full";

    copyButton.textContent =
      "📋 Copiar instruções";


    copyButton.addEventListener(
      "click",
      async () => {
        try {
          await navigator.clipboard.writeText(
            message.textContent
          );

          toast(
            "Instruções copiadas! ✅"
          );

        } catch {
          toast(
            "Não foi possível copiar automaticamente."
          );
        }
      }
    );


    deliveryBox.appendChild(
      title
    );

    deliveryBox.appendChild(
      message
    );

    deliveryBox.appendChild(
      copyButton
    );


    card.appendChild(
      deliveryBox
    );
  }


  /* =======================================================
     ENTREGUE
  ======================================================= */

  if (
    order.status ===
    "delivered"
  ) {
    const info =
      document.createElement(
        "div"
      );

    info.className =
      "order-success-box";

    info.textContent =
      "✅ Pedido entregue com sucesso!";


    card.appendChild(
      info
    );


    checkExistingReview(
      order.id
    ).then(
      review => {
        if (review) {
          card.appendChild(
            createReviewStatus(
              review
            )
          );
        } else {
          card.appendChild(
            createReviewForm(
              order
            )
          );
        }
      }
    );
  }


  /* =======================================================
     CANCELADO
  ======================================================= */

  if (
    order.status ===
    "cancelled"
  ) {
    const info =
      document.createElement(
        "div"
      );

    info.className =
      "order-info-box";

    info.textContent =
      "❌ Este pedido foi cancelado.";


    card.appendChild(
      info
    );
  }


  return card;
}


/* =========================================================
   CARREGAR PEDIDOS DO CLIENTE
========================================================= */

async function loadCustomerOrders() {
  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth.getSession();


  if (
    !session?.user ||
    !ordersList
  ) {
    return;
  }


  ordersList.innerHTML =
    "";


  if (ordersMessage) {
    ordersMessage.classList.add(
      "hidden"
    );
  }


  const {
    data: orders,
    error
  } =
    await supabaseClient
      .from("orders")
      .select(
        "id, status, total, created_at"
      )
      .eq(
        "customer_id",
        session.user.id
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {
    console.error(
      "Erro ao carregar pedidos:",
      error
    );


    if (ordersMessage) {
      ordersMessage.textContent =
        "Não foi possível carregar seus pedidos.";

      ordersMessage.classList.remove(
        "hidden"
      );
    }


    return;
  }


  if (
    !orders ||
    !orders.length
  ) {
    if (ordersMessage) {
      ordersMessage.textContent =
        "Você ainda não possui pedidos.";

      ordersMessage.classList.remove(
        "hidden"
      );
    }


    return;
  }


  const settings =
    await loadDeliverySettings();


  for (
    const order of orders
  ) {
    const {
      data: items,
      error: itemsError
    } =
      await supabaseClient
        .from("order_items")
        .select(
          "product_name, quantity, product_price"
        )
        .eq(
          "order_id",
          order.id
        );


    if (itemsError) {
      console.error(
        "Erro ao carregar itens:",
        itemsError
      );
    }


    const card =
      createOrderCard(
        order,
        items || [],
        settings
      );


    ordersList.appendChild(
      card
    );
  }


  await syncCurrentOrderFromOrders(
    orders
  );
}


/* =========================================================
   SINCRONIZAR PEDIDO ATUAL
========================================================= */

async function syncCurrentOrderFromOrders(
  orders
) {
  if (
    !Array.isArray(orders) ||
    !orders.length
  ) {
    return;
  }


  if (!currentOrderId) {
    const activeOrder =
      orders.find(
        order =>
          order.status !==
          "cancelled"
      );


    if (activeOrder) {
      currentOrderId =
        activeOrder.id;

      localStorage.setItem(
        "thoune_current_order",
        currentOrderId
      );
    }
  }


  if (currentOrderId) {
    const exists =
      orders.some(
        order =>
          String(order.id) ===
          String(currentOrderId)
      );


    if (!exists) {
      clearCurrentOrderStorage();
      closeCurrentOrder();

      return;
    }


    await loadCurrentOrder();
  }
}


/* =========================================================
   NOTIFICAÇÕES
========================================================= */

async function loadCustomerNotifications() {
  if (!notificationsList) {
    return;
  }


  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth.getSession();


  if (!session?.user) {
    notificationsList.innerHTML =
      "";


    if (notificationsMessage) {
      notificationsMessage.textContent =
        "Entre na sua conta para ver suas notificações.";

      notificationsMessage.classList.remove(
        "hidden"
      );
    }


    return;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("notifications")
      .select("*")
      .eq(
        "user_id",
        session.user.id
      )
      .order(
        "created_at",
        {
          ascending:
            false
        }
      );


  if (error) {
    console.error(
      "Erro ao carregar notificações:",
      error
    );


    if (notificationsMessage) {
      notificationsMessage.textContent =
        "Não foi possível carregar suas notificações.";

      notificationsMessage.classList.remove(
        "hidden"
      );
    }


    return;
  }


  notificationsList.innerHTML =
    "";


  if (
    !data ||
    !data.length
  ) {
    if (notificationsMessage) {
      notificationsMessage.textContent =
        "Você ainda não possui notificações.";

      notificationsMessage.classList.remove(
        "hidden"
      );
    }


    return;
  }


  if (notificationsMessage) {
    notificationsMessage.classList.add(
      "hidden"
    );
  }


  for (
    const notification of data
  ) {
    const card =
      document.createElement(
        "article"
      );

    card.className =
      "notification-card";


    const icon =
      document.createElement(
        "div"
      );

    icon.className =
      "notification-icon";

    icon.textContent =
      "🔔";


    const content =
      document.createElement(
        "div"
      );


    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      notification.title ||
      "Thoune Store";


    const text =
      document.createElement(
        "p"
      );

    text.textContent =
      notification.message ||
      notification.text ||
      "";


    const date =
      document.createElement(
        "small"
      );


    if (
      notification.created_at
    ) {
      date.textContent =
        new Date(
          notification.created_at
        ).toLocaleString(
          "pt-BR"
        );
    }


    content.appendChild(
      title
    );

    content.appendChild(
      text
    );


    if (
      date.textContent
    ) {
      content.appendChild(
        date
      );
    }


    card.appendChild(
      icon
    );

    card.appendChild(
      content
    );


    notificationsList.appendChild(
      card
    );
  }
}


/* =========================================================
   PAINÉIS DA CONTA
========================================================= */

function closeAccountPanels() {
  ordersPanel?.classList.add(
    "hidden"
  );

  notificationsPanel?.classList.add(
    "hidden"
  );

  profilePanel?.classList.add(
    "hidden"
  );
}


function openAccountPanel(
  panel
) {
  if (!panel) {
    return;
  }


  closeAccountPanels();


  panel.classList.remove(
    "hidden"
  );


  panel.scrollIntoView({
    behavior:
      "smooth",

    block:
      "nearest"
  });
}


openOrdersPanel?.addEventListener(
  "click",
  async () => {
    openAccountPanel(
      ordersPanel
    );

    await loadCustomerOrders();
  }
);


openNotificationsPanel?.addEventListener(
  "click",
  async () => {
    openAccountPanel(
      notificationsPanel
    );

    await loadCustomerNotifications();
  }
);


openProfilePanel?.addEventListener(
  "click",
  () => {
    if (
      profilePanelTiktok &&
      tiktokUsername
    ) {
      profilePanelTiktok.value =
        tiktokUsername.value ||
        "";
    }


    if (
      profilePanelRoblox &&
      robloxUsername
    ) {
      profilePanelRoblox.value =
        robloxUsername.value ||
        "";
    }


    openAccountPanel(
      profilePanel
    );
  }
);


document
  .querySelectorAll(
    "[data-account-back]"
  )
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          closeAccountPanels();
        }
      );
    }
  );


/* =========================================================
   SALVAR PERFIL PELO PAINEL
========================================================= */

profilePanelSave?.addEventListener(
  "click",
  async () => {
    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();


    if (!session?.user) {
      toast(
        "Entre na sua conta primeiro."
      );

      return;
    }


    const tiktok =
      profilePanelTiktok?.value.trim() ||
      "";

    const roblox =
      profilePanelRoblox?.value.trim() ||
      "";


    profilePanelSave.disabled =
      true;

    profilePanelSave.textContent =
      "Salvando...";


    try {
      const {
        error
      } =
        await supabaseClient
          .from("profiles")
          .update({
            tiktok_username:
              tiktok || null,

            roblox_username:
              roblox || null
          })
          .eq(
            "id",
            session.user.id
          );


      if (error) {
        console.error(
          "Erro ao salvar perfil:",
          error
        );

        toast(
          "Não foi possível salvar suas informações."
        );

        return;
      }


      if (tiktokUsername) {
        tiktokUsername.value =
          tiktok;
      }


      if (robloxUsername) {
        robloxUsername.value =
          roblox;
      }


      if (profileMessage) {
        profileMessage.textContent =
          "Informações salvas com sucesso! ✅";
      }


      toast(
        "Perfil atualizado!"
      );

    } finally {
      profilePanelSave.disabled =
        false;

      profilePanelSave.textContent =
        "Salvar informações";
    }
  }
);


/* =========================================================
   UI DA CONTA
========================================================= */

async function updateAccountUI() {
  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth.getSession();


  closeAccountPanels();


  if (session?.user) {
    accountDetails?.classList.remove(
      "hidden"
    );

    profileFields?.classList.remove(
      "hidden"
    );


    if (accountEmail) {
      accountEmail.textContent =
        session.user.email || "";
    }


    if (accountMessage) {
      accountMessage.textContent =
        "Você está conectado à sua conta.";
    }


    loginButton?.classList.add(
      "hidden"
    );

    signupButton?.classList.add(
      "hidden"
    );

    logoutButton?.classList.remove(
      "hidden"
    );


    if (authEmail) {
      authEmail.value =
        session.user.email || "";

      authEmail.disabled =
        true;
    }


    authPassword?.classList.add(
      "hidden"
    );


    await loadProfile(
      session.user.id
    );

    await loadCustomerOrders();

  } else {
    profileFields?.classList.add(
      "hidden"
    );

    accountDetails?.classList.add(
      "hidden"
    );


    if (accountEmail) {
      accountEmail.textContent =
        "";
    }


    if (accountMessage) {
      accountMessage.textContent =
        "Entre ou crie sua conta para acompanhar seus pedidos.";
    }


    loginButton?.classList.remove(
      "hidden"
    );

    signupButton?.classList.remove(
      "hidden"
    );

    logoutButton?.classList.add(
      "hidden"
    );


    if (authEmail) {
      authEmail.disabled =
        false;
    }


    authPassword?.classList.remove(
      "hidden"
    );


    closeCurrentOrder();
  }
}


/* =========================================================
   LOGIN
========================================================= */

loginButton?.addEventListener(
  "click",
  async () => {
    const email =
      authEmail?.value.trim();

    const password =
      authPassword?.value;


    if (
      !email ||
      !password
    ) {
      toast(
        "Preencha seu e-mail e sua senha."
      );

      return;
    }


    loginButton.disabled =
      true;

    loginButton.textContent =
      "Entrando...";


    try {
      const {
        error
      } =
        await supabaseClient.auth
          .signInWithPassword({
            email,
            password
          });


      if (error) {
        toast(
          "Não foi possível entrar: " +
          error.message
        );

        return;
      }


      toast(
        "Login realizado com sucesso! ✅"
      );


      await updateAccountUI();

    } finally {
      loginButton.disabled =
        false;

      loginButton.textContent =
        "Entrar";
    }
  }
);


/* =========================================================
   CADASTRO
========================================================= */

signupButton?.addEventListener(
  "click",
  async () => {
    const email =
      authEmail?.value.trim();

    const password =
      authPassword?.value;


    if (
      !email ||
      !password
    ) {
      toast(
        "Preencha seu e-mail e sua senha."
      );

      return;
    }


    if (
      password.length < 6
    ) {
      toast(
        "A senha precisa ter pelo menos 6 caracteres."
      );

      return;
    }


    signupButton.disabled =
      true;

    signupButton.textContent =
      "Criando...";


    try {
      const {
        data,
        error
      } =
        await supabaseClient.auth
          .signUp({
            email,
            password
          });


      if (error) {
        toast(
          "Não foi possível criar a conta: " +
          error.message
        );

        return;
      }


      if (
        data?.user &&
        !data.session
      ) {
        toast(
          "Conta criada! Verifique seu e-mail para confirmar o cadastro."
        );

        return;
      }


      toast(
        "Conta criada com sucesso! ✅"
      );


      await updateAccountUI();

    } finally {
      signupButton.disabled =
        false;

      signupButton.textContent =
        "Criar conta";
    }
  }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton?.addEventListener(
  "click",
  async () => {
    logoutButton.disabled =
      true;


    try {
      const {
        error
      } =
        await supabaseClient.auth
          .signOut();


      if (error) {
        toast(
          "Não foi possível sair da conta."
        );

        return;
      }


      clearCurrentOrderStorage();

      closeCurrentOrder();


      toast(
        "Você saiu da conta."
      );


      await updateAccountUI();

    } finally {
      logoutButton.disabled =
        false;
    }
  }
);


supabaseClient.auth.onAuthStateChange(
  () => {
    updateAccountUI();
  }
);


/* =========================================================
   SALVAR PERFIL PRINCIPAL
========================================================= */

saveProfileButton?.addEventListener(
  "click",
  async () => {
    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();


    if (!session?.user) {
      toast(
        "Entre na sua conta primeiro."
      );

      return;
    }


    const tiktok =
      tiktokUsername?.value.trim() ||
      "";

    const roblox =
      robloxUsername?.value.trim() ||
      "";


    saveProfileButton.disabled =
      true;

    saveProfileButton.textContent =
      "Salvando...";


    try {
      const {
        error
      } =
        await supabaseClient
          .from("profiles")
          .update({
            tiktok_username:
              tiktok || null,

            roblox_username:
              roblox || null
          })
          .eq(
            "id",
            session.user.id
          );


      if (error) {
        console.error(
          "Erro ao salvar perfil:",
          error
        );

        toast(
          "Não foi possível salvar suas informações."
        );

        return;
      }


      if (profilePanelTiktok) {
        profilePanelTiktok.value =
          tiktok;
      }


      if (profilePanelRoblox) {
        profilePanelRoblox.value =
          roblox;
      }


      if (profileMessage) {
        profileMessage.textContent =
          "Informações salvas com sucesso! ✅";
      }


      toast(
        "Perfil atualizado!"
      );

    } finally {
      saveProfileButton.disabled =
        false;

      saveProfileButton.textContent =
        "Salvar informações";
    }
  }
);


/* =========================================================
   PRODUTOS
========================================================= */

let products = [];

let selectedCategory =
  "Todas";

let search =
  "";

let sort =
  "popular";


async function loadProducts() {
  await loadPublicStoreSettings();


  const {
    data,
    error
  } =
    await supabaseClient
      .from("products")
      .select("*")
      .eq(
        "active",
        true
      )
      .order(
        "sort_order",
        {
          ascending:
            true
        }
      );


  if (error) {
    console.error(
      "Erro ao carregar produtos:",
      error
    );

    toast(
      "Não foi possível carregar as marretas."
    );

    return;
  }


  products =
    (data || []).map(
      product => {
        const basePrice =
          Number(
            product.price
          ) || 0;


        return {
          ...product,

          price:
            getEffectivePrice(
              basePrice
            ),

          original_price:
            basePrice
        };
      }
    );


  refresh();
}


function filtered() {
  let result =
    products.filter(
      product => {
        const categoryMatch =
          selectedCategory ===
            "Todas" ||
          product.category ===
            selectedCategory;


        const productName =
          String(
            product.name || ""
          ).toLowerCase();


        const searchMatch =
          productName.includes(
            search
          );


        return (
          product.active &&
          categoryMatch &&
          searchMatch
        );
      }
    );


  if (sort === "low") {
    result.sort(
      (a, b) =>
        a.price -
        b.price
    );
  }


  if (sort === "high") {
    result.sort(
      (a, b) =>
        b.price -
        a.price
    );
  }


  if (sort === "popular") {
    result.sort(
      (a, b) =>
        (a.sort_order || 0) -
        (b.sort_order || 0)
    );
  }


  return result;
}


function refresh() {
  renderProducts(
    filtered()
  );
}


/* =========================================================
   MENU MOBILE
========================================================= */

const menuToggle =
  document.querySelector(
    "#menu-toggle"
  );

const mobileNav =
  document.querySelector(
    "#mobile-nav"
  );


menuToggle?.addEventListener(
  "click",
  () => {
    mobileNav?.classList.toggle(
      "open"
    );
  }
);


mobileNav
  ?.querySelectorAll("a")
  .forEach(
    a => {
      a.addEventListener(
        "click",
        () => {
          mobileNav.classList.remove(
            "open"
          );
        }
      );
    }
  );


/* =========================================================
   FILTROS
========================================================= */

document
  .querySelectorAll(
    ".category"
  )
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          document
            .querySelectorAll(
              ".category"
            )
            .forEach(
              b =>
                b.classList.remove(
                  "active"
                )
            );


          button.classList.add(
            "active"
          );


          selectedCategory =
            button.dataset.category;


          refresh();
        }
      );
    }
  );


document
  .querySelector(
    "#search-input"
  )
  ?.addEventListener(
    "input",
    event => {
      search =
        event.target.value
          .trim()
          .toLowerCase();

      refresh();
    }
  );


document
  .querySelector(
    "#sort-select"
  )
  ?.addEventListener(
    "change",
    event => {
      sort =
        event.target.value;

      refresh();
    }
  );


/* =========================================================
   CARRINHO
========================================================= */

const drawer =
  document.querySelector(
    "#cart-drawer"
  );

const checkoutSection =
  document.querySelector(
    "#checkout-section"
  );

const checkoutItems =
  document.querySelector(
    "#checkout-items"
  );

const checkoutTiktok =
  document.querySelector(
    "#checkout-tiktok"
  );

const checkoutRoblox =
  document.querySelector(
    "#checkout-roblox"
  );

const checkoutPixKey =
  document.querySelector(
    "#checkout-pix-key"
  );

const copyPixKeyButton =
  document.querySelector(
    "#copy-pix-key-button"
  );

const checkoutTotal =
  document.querySelector(
    "#checkout-total"
  );

const checkoutBack =
  document.querySelector(
    "#checkout-back"
  );


function openCart() {
  drawer?.classList.add(
    "open"
  );

  renderCart(
    loadCart()
  );
}


function closeCart() {
  drawer?.classList.remove(
    "open"
  );
}


document
  .querySelector(
    "#open-cart"
  )
  ?.addEventListener(
    "click",
    openCart
  );


document
  .querySelector(
    "#close-cart"
  )
  ?.addEventListener(
    "click",
    closeCart
  );


document
  .querySelector(
    "#close-cart-button"
  )
  ?.addEventListener(
    "click",
    closeCart
  );


document.addEventListener(
  "keydown",
  event => {
    if (
      event.key ===
      "Escape"
    ) {
      closeCart();
      closeCurrentOrder();
    }
  }
);


/* =========================================================
   COPIAR PEDIDO
========================================================= */

document
  .querySelector(
    "#copy-order-button"
  )
  ?.addEventListener(
    "click",
    async () => {
      const cart =
        loadCart();


      if (!cart.length) {
        toast(
          "Seu carrinho está vazio."
        );

        return;
      }


      try {
        await navigator.clipboard.writeText(
          orderText(cart)
        );

        toast(
          "Pedido copiado! ✅"
        );

      } catch {
        toast(
          "Não foi possível copiar automaticamente."
        );
      }
    }
  );


/* =========================================================
   COPIAR PIX
========================================================= */

copyPixKeyButton?.addEventListener(
  "click",
  async () => {
    const pixKey =
      storeSettings.pix_key?.trim();


    if (!pixKey) {
      toast(
        "A chave Pix não está configurada."
      );

      return;
    }


    try {
      await navigator.clipboard.writeText(
        pixKey
      );

      toast(
        "Chave Pix copiada! ✅"
      );

    } catch {
      toast(
        "Não foi possível copiar a chave Pix."
      );
    }
  }
);


/* =========================================================
   CHECKOUT
========================================================= */

document
  .querySelector(
    "#checkout-button"
  )
  ?.addEventListener(
    "click",
    async () => {
      const cart =
        loadCart();


      if (!cart.length) {
        toast(
          "Adicione uma marreta ao carrinho primeiro."
        );

        return;
      }


      const {
        data: {
          session
        }
      } =
        await supabaseClient.auth
          .getSession();


      if (!session?.user) {
        toast(
          "Entre na sua conta antes de realizar a compra."
        );


        document
          .querySelector(
            "#conta"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start"
          });


        return;
      }


      await loadProfile(
        session.user.id
      );

      await loadPublicStoreSettings();


      if (
        !storeSettings.online
      ) {
        toast(
          "O atendimento está offline no momento."
        );

        return;
      }


      if (checkoutItems) {
        checkoutItems.innerHTML =
          "";
      }


      let checkoutTotalValue =
        0;


      for (
        const item of cart
      ) {
        const currentProduct =
          products.find(
            product =>
              String(
                product.id
              ) ===
              String(
                item.id
              )
          );


        const basePrice =
          currentProduct
            ? Number(
                currentProduct.original_price
              ) || 0
            : Number(
                item.price
              ) || 0;


        const effectivePrice =
          getEffectivePrice(
            basePrice
          );


        const subtotal =
          effectivePrice *
          Number(
            item.qty
          );


        checkoutTotalValue +=
          subtotal;


        const row =
          document.createElement(
            "div"
          );

        row.className =
          "checkout-item";


        const image =
          document.createElement(
            "img"
          );


        if (
          currentProduct?.image ||
          item.image
        ) {
          image.src =
            currentProduct?.image ||
            item.image;

          image.alt =
            currentProduct?.name ||
            item.name;
        } else {
          image.alt =
            "";
        }


        const info =
          document.createElement(
            "div"
          );


        const name =
          document.createElement(
            "strong"
          );

        name.textContent =
          currentProduct?.name ||
          item.name;


        const details =
          document.createElement(
            "span"
          );

        details.textContent =
          `${item.qty} × ${money(
            effectivePrice
          )} = ${money(
            subtotal
          )}`;


        info.appendChild(
          name
        );

        info.appendChild(
          details
        );


        row.appendChild(
          image
        );

        row.appendChild(
          info
        );


        checkoutItems?.appendChild(
          row
        );
      }


      if (checkoutTiktok) {
        checkoutTiktok.value =
          tiktokUsername?.value ||
          "";
      }


      if (checkoutRoblox) {
        checkoutRoblox.value =
          robloxUsername?.value ||
          "";
      }


      if (checkoutPixKey) {
        checkoutPixKey.textContent =
          storeSettings.pix_key ||
          "Chave Pix não configurada.";
      }


      if (checkoutTotal) {
        checkoutTotal.textContent =
          money(
            checkoutTotalValue
          );
      }


      checkoutSection?.classList.remove(
        "hidden"
      );


      closeCart();


      checkoutSection?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });
    }
  );


checkoutBack?.addEventListener(
  "click",
  () => {
    checkoutSection?.classList.add(
      "hidden"
    );

    openCart();
  }
);


/* =========================================================
   BOTÕES DO PEDIDO
========================================================= */

const verifyPaymentButton =
  document.querySelector(
    "#verify-payment-button"
  );

const confirmOrderButton =
  document.querySelector(
    "#confirm-order-button"
  );


/* =========================================================
   CRIAR PEDIDO
========================================================= */

confirmOrderButton?.addEventListener(
  "click",
  async () => {
    const cart =
      loadCart();


    if (!cart.length) {
      toast(
        "Seu carrinho está vazio."
      );

      return;
    }


    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth
        .getSession();


    if (!session?.user) {
      toast(
        "Entre na sua conta antes de confirmar o pedido."
      );

      return;
    }


    const pixName =
      document
        .getElementById(
          "checkout-pix-name"
        )
        ?.value
        .trim();


    const robloxName =
      checkoutRoblox?.value.trim();


    if (!robloxName) {
      toast(
        "Informe seu usuário do Roblox."
      );

      return;
    }


    if (!pixName) {
      toast(
        "Informe o nome do remetente do Pix."
      );

      return;
    }


    confirmOrderButton.disabled =
      true;

    confirmOrderButton.textContent =
      "Criando pedido...";


    try {
      const items =
        cart.map(
          item => ({
            product_id:
              item.id,

            quantity:
              item.qty
          })
        );


      const {
        data,
        error
      } =
        await supabaseClient.rpc(
          "create_order",
          {
            p_items:
              items,

            p_pix_name:
              pixName,

            p_delivery_username:
              robloxName
          }
        );


      if (error) {
        console.error(
          "Erro ao criar pedido:",
          error
        );

        toast(
          "Não foi possível criar o pedido: " +
          error.message
        );

        return;
      }


      if (
        !data?.order_id
      ) {
        console.error(
          "Resposta inesperada do create_order:",
          data
        );

        toast(
          "O pedido não retornou um identificador válido."
        );

        return;
      }


      currentOrderId =
        data.order_id;


      localStorage.setItem(
        "thoune_current_order",
        currentOrderId
      );


      clearCart();


      updateCartBadge(
        loadCart()
      );


      toast(
        "Pedido criado com sucesso! ✅"
      );


      confirmOrderButton.classList.add(
        "hidden"
      );


      verifyPaymentButton?.classList.remove(
        "hidden"
      );


      checkoutSection?.classList.add(
        "hidden"
      );


      await loadCustomerOrders();

      await loadCurrentOrder();

    } finally {
      confirmOrderButton.disabled =
        false;

      if (
        !confirmOrderButton.classList.contains(
          "hidden"
        )
      ) {
        confirmOrderButton.textContent =
          "Confirmar pedido";
      }
    }
  }
);


/* =========================================================
   VERIFICAR PAGAMENTO
========================================================= */

verifyPaymentButton?.addEventListener(
  "click",
  async () => {
    if (!currentOrderId) {
      toast(
        "Nenhum pedido aguardando verificação."
      );

      return;
    }


    verifyPaymentButton.disabled =
      true;

    verifyPaymentButton.textContent =
      "Enviando...";


    try {
      const {
        error
      } =
        await supabaseClient.rpc(
          "request_payment_verification",
          {
            p_order_id:
              currentOrderId
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


      const verifiedOrderId =
        currentOrderId;


      clearCurrentOrderStorage();


      verifyPaymentButton.classList.add(
        "hidden"
      );


      toast(
        "Pagamento informado! Aguardando verificação. ✅"
      );


      await loadCustomerOrders();


      await loadCurrentOrder();


      console.log(
        "Pagamento enviado para verificação:",
        verifiedOrderId
      );

    } finally {
      verifyPaymentButton.disabled =
        false;

      if (
        verifyPaymentButton.classList.contains(
          "hidden"
        )
      ) {
        return;
      }

      verifyPaymentButton.textContent =
        "🔎 Verificar pagamento";
    }
  }
);


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

console.log(
  "APP INICIANDO"
);


await loadPublicStoreSettings();

console.log(
  "CONFIG CARREGADA"
);


await loadStoreStatus();

console.log(
  "STATUS CARREGADO"
);


await loadProducts();

console.log(
  "PRODUTOS CARREGADOS"
);


updateCartBadge(
  loadCart()
);

console.log(
  "CARRINHO CARREGADO"
);


await updateAccountUI();

console.log(
  "CONTA CARREGADA"
);


if (currentOrderId) {
  await loadCurrentOrder();
}


console.log(
  "APP FINALIZADO"
);
