

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

// Atualiza o total de entregas periodicamente enquanto o painel estiver aberto.
window.setInterval(() => {
  const ordersSection = document.querySelector("#orders-section");
  if (ordersSection && !ordersSection.classList.contains("hidden")) loadDeliveredOrdersCount();
}, 30000);


/* =========================================================
   ELEMENTOS
========================================================= */

const loadingScreen =
  document.querySelector("#loading-screen");

const accessDenied =
  document.querySelector("#access-denied");

const adminPanel =
  document.querySelector("#admin-panel");

const logoutButton =
  document.querySelector("#admin-logout");

const adminLoginForm =
  document.querySelector("#admin-login-form");

const adminLoginEmail =
  document.querySelector("#admin-login-email");

const adminLoginPassword =
  document.querySelector("#admin-login-password");

const adminLoginButton =
  document.querySelector("#admin-login-button");

const adminLoginMessage =
  document.querySelector("#admin-login-message");


const sections = {
  dashboard:
    document.querySelector("#dashboard-section"),

  products:
    document.querySelector("#products-section"),

  orders:
    document.querySelector("#orders-section"),

  payments:
    document.querySelector("#payments-section"),

  service:
    document.querySelector("#service-section"),

  promotion:
    document.querySelector("#promotion-section"),

  delivery:
    document.querySelector("#delivery-section"),

  reviews:
    document.querySelector("#reviews-section")
};


/* =========================================================
   ACESSO
========================================================= */

async function checkAdminAccess(){
  loadingScreen.classList.remove("hidden");
  accessDenied.classList.add("hidden");
  adminPanel.classList.add("hidden");

  const revealDenied = (message = "") => {
    loadingScreen.classList.add("hidden");
    adminPanel.classList.add("hidden");
    accessDenied.classList.remove("hidden");
    if (message && adminLoginMessage) adminLoginMessage.textContent = message;
    return false;
  };
  const revealPanel = () => {
    loadingScreen.classList.add("hidden");
    accessDenied.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    return true;
  };
  const withTimeout = (promise, ms = 8000, label = "verificação") => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tempo esgotado durante ${label}.`)), ms))
  ]);

  let session;
  try {
    const result = await withTimeout(supabaseClient.auth.getSession(), 8000, "a leitura da sessão");
    if (result?.error) throw result.error;
    session = result?.data?.session || null;
  } catch (err) {
    console.error("Falha ao recuperar sessão ADM:", err);
    return revealDenied("Não foi possível verificar a sessão. Confira a internet e tente entrar novamente.");
  }

  if (!session?.user) return revealDenied("Entre com o e-mail e a senha da sua conta administradora.");

  const user = session.user;
  const metadataRole = user.app_metadata?.role || user.user_metadata?.role || "";
  if (metadataRole === "admin") return revealPanel();

  // Tenta a função do banco, mas não deixa uma chamada travada prender a tela para sempre.
  try {
    const result = await withTimeout(supabaseClient.rpc("is_admin"), 7000, "a validação de administrador");
    if (!result?.error && result?.data === true) return revealPanel();
    if (result?.error) console.warn("RPC is_admin indisponível; tentando o perfil:", result.error.message);
  } catch (err) {
    console.warn("RPC is_admin falhou ou demorou; tentando o perfil:", err);
  }

  try {
    const result = await withTimeout(
      supabaseClient.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      7000,
      "a leitura do perfil"
    );
    if (!result?.error && result?.data?.role === "admin") return revealPanel();
    console.error("Acesso administrativo negado:", result?.error || "perfil sem role admin");
    return revealDenied("Sua conta entrou, mas não está marcada como administradora no Supabase.");
  } catch (err) {
    console.error("Falha ao consultar perfil administrativo:", err);
    return revealDenied("A verificação demorou demais ou o banco recusou a consulta. Confira a conexão e as permissões do Supabase.");
  }
}


adminLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = String(adminLoginEmail?.value || "").trim();
  const password = String(adminLoginPassword?.value || "");

  if(!email || !password){
    if(adminLoginMessage) adminLoginMessage.textContent = "Informe e-mail e senha.";
    return;
  }

  if(adminLoginButton){
    adminLoginButton.disabled = true;
    adminLoginButton.textContent = "Entrando...";
  }
  if(adminLoginMessage) adminLoginMessage.textContent = "";

  let error = null;
  try {
    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    error = result?.error || null;
  } catch (err) {
    error = err;
  }

  if(error){
    console.error("Login administrativo:", error);
    if(adminLoginMessage){
      adminLoginMessage.textContent = error.message || "Não foi possível entrar.";
    }
  }else{
    if(adminLoginMessage) adminLoginMessage.textContent = "Verificando permissão...";
    try {
      await checkAdminAccess().catch((err) => {
  console.error("Erro ao iniciar painel ADM:", err);
  loadingScreen.classList.add("hidden");
  accessDenied.classList.remove("hidden");
  if (adminLoginMessage) adminLoginMessage.textContent = "O painel não conseguiu carregar. Confira a conexão e tente entrar novamente.";
});
    } catch (err) {
      console.error("Falha ao verificar acesso ADM:", err);
      loadingScreen.classList.add("hidden");
      accessDenied.classList.remove("hidden");
      if (adminLoginMessage) adminLoginMessage.textContent = "Não foi possível verificar sua permissão. Confira a conexão e a configuração do Supabase.";
    }
  }

  if(adminLoginButton){
    adminLoginButton.disabled = false;
    adminLoginButton.textContent = "Entrar no painel";
  }
});



/* =========================================================
   NAVEGAÇÃO
========================================================= */

function hideAllSections(){

  Object.values(sections)
    .forEach(section =>
      section.classList.add("hidden")
    );

}


function showDashboard(){

  hideAllSections();

  sections.dashboard.classList.remove("hidden");

  closeProductForm();

}


function showSection(name){

  hideAllSections();

  sections[name].classList.remove("hidden");

}


document
  .querySelector("#products-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("products");

      await loadProducts();

    }
  );


document
  .querySelector("#orders-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("orders");

      await loadOrders();

    }
  );


document
  .querySelector("#payments-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("payments");

      await loadPayments();

    }
  );


document
  .querySelector("#service-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("service");

      await loadServiceStatus();

    }
  );


document
  .querySelector("#promotion-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("promotion");

      await loadPromotion();

    }
  );


document
  .querySelector("#delivery-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("delivery");

      await loadDeliverySettings();

    }
  );


document
  .querySelector("#reviews-option")
  .addEventListener(
    "click",
    async ()=>{

      showSection("reviews");

      await loadReviews();

    }
  );


[
  "#back-products-dashboard",
  "#back-orders-dashboard",
  "#back-payments-dashboard",
  "#back-service-dashboard",
  "#back-promotion-dashboard",
  "#back-delivery-dashboard",
  "#back-reviews-dashboard"
].forEach(selector => {

  document
    .querySelector(selector)
    .addEventListener(
      "click",
      showDashboard
    );

});


/* =========================================================
   PRODUTOS
========================================================= */

const productForm =
  document.querySelector("#product-form");

const formTitle =
  document.querySelector("#form-title");

const productName =
  document.querySelector("#product-name");

const productCategory =
  document.querySelector("#product-category");

const productPrice =
  document.querySelector("#product-price");


const productDiscountPercent =
  document.querySelector("#product-discount-percent");

const productDiscountActive =
  document.querySelector("#product-discount-active");

const productOrder =
  document.querySelector("#product-order");

const productImage =
  document.querySelector("#product-image");
const productImageFile = document.querySelector("#product-image-file");
const productImagePreview = document.querySelector("#product-image-preview");
let selectedProductImageData = "";

productImageFile?.addEventListener("change", async () => {
  const file = productImageFile.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    productFormMessage.textContent = "Escolha um arquivo de imagem.";
    productImageFile.value = "";
    return;
  }
  try {
    const source = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = source;
    });
    const maxSide = 900;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    selectedProductImageData = canvas.toDataURL("image/webp", 0.78);
    productImage.value = selectedProductImageData;
    const previewImg = productImagePreview?.querySelector("img");
    if (previewImg) previewImg.src = selectedProductImageData;
    if (productImagePreview) productImagePreview.hidden = false;
    productFormMessage.textContent = "Foto selecionada e otimizada.";
  } catch (error) {
    productFormMessage.textContent = "Não consegui abrir essa foto. Tente outra imagem.";
  }
});

productImage?.addEventListener("input", () => {
  if (productImage.value.trim() !== selectedProductImageData) selectedProductImageData = "";
  const value = productImage.value.trim();
  const previewImg = productImagePreview?.querySelector("img");
  if (previewImg && value) previewImg.src = value;
  if (productImagePreview) productImagePreview.hidden = !value;
});

const productDescription =
  document.querySelector("#product-description");

const productActive =
  document.querySelector("#product-active");

const saveProductButton =
  document.querySelector("#save-product-button");

const cancelProductButton =
  document.querySelector("#cancel-product-button");

const newProductButton =
  document.querySelector("#new-product-button");

const productsList =
  document.querySelector("#products-list");

const productsCount =
  document.querySelector("#products-count");

const refreshProductsButton =
  document.querySelector("#refresh-products-button");

const productFormMessage =
  document.querySelector("#product-form-message");

// Busca local nas listas já carregadas, sem consultar o banco a cada tecla.
function applyAdminSearch(inputSelector, listSelector, itemSelector, emptyMessage) {
  const input = document.querySelector(inputSelector);
  const list = document.querySelector(listSelector);
  if (!input || !list) return;
  const query = input.value.trim().toLocaleLowerCase("pt-BR");
  const items = Array.from(list.querySelectorAll(itemSelector));
  let visibleCount = 0;
  items.forEach(item => {
    const text = (item.innerText || item.textContent || "").toLocaleLowerCase("pt-BR");
    const matches = !query || text.includes(query);
    item.style.display = matches ? "" : "none";
    if (matches) visibleCount++;
  });
  let empty = list.querySelector(":scope > .admin-search-empty");
  if (query && items.length && visibleCount === 0) {
    if (!empty) { empty = document.createElement("p"); empty.className = "admin-search-empty"; list.appendChild(empty); }
    empty.textContent = emptyMessage;
  } else if (empty) empty.remove();
}

function setupAdminSearch(inputSelector, listSelector, itemSelector, emptyMessage) {
  const input = document.querySelector(inputSelector);
  if (!input || input.dataset.searchReady === "true") return;
  input.dataset.searchReady = "true";
  input.addEventListener("input", () => applyAdminSearch(inputSelector, listSelector, itemSelector, emptyMessage));
}

setupAdminSearch("#products-search", "#products-list", ".product-admin-item", "Nenhuma marreta corresponde à sua busca.");
setupAdminSearch("#orders-search", "#orders-list", ".order-card", "Nenhum pedido corresponde à sua busca.");
setupAdminSearch("#order-history-search", "#order-history-list", ".order-card", "Nenhum pedido no histórico corresponde à sua busca.");
setupAdminSearch("#payments-search", "#payments-list", ".payment-card", "Nenhum pagamento corresponde à sua busca.");

let editingProductId = null;


function openProductForm(product=null){

  productForm.classList.remove("hidden");

  productFormMessage.textContent = "";


  if(product){

    editingProductId =
      product.id;

    formTitle.textContent =
      "Editar marreta";

    productName.value =
      product.name || "";

    productCategory.value =
      product.category || "Comum";

    productPrice.value =
      product.price ?? "";

    productDiscountPercent.value =
      product.discount_percent ?? 0;

    productDiscountActive.checked =
      product.discount_active === true;

    productOrder.value =
      product.sort_order ?? 0;

    productImage.value =
      product.image || "";
    selectedProductImageData = String(product.image || "").startsWith("data:image/") ? product.image : "";
    if (productImageFile) productImageFile.value = "";
    if (productImagePreview) {
      productImagePreview.hidden = !product.image;
      const previewImg = productImagePreview.querySelector("img");
      if (previewImg) previewImg.src = product.image || "";
    }

    productDescription.value =
      product.description || "";

    productActive.checked =
      product.active !== false;

    saveProductButton.textContent =
      "Salvar alterações";

  }else{

    editingProductId = null;

    formTitle.textContent =
      "Adicionar marreta";

    productName.value = "";

    productCategory.value =
      "Comum";

    productPrice.value = "";

    productDiscountPercent.value = 0;
    productDiscountActive.checked = false;

    productOrder.value = 0;

    productImage.value = "";
    selectedProductImageData = "";
    if (productImageFile) productImageFile.value = "";
    if (productImagePreview) productImagePreview.hidden = true;

    productDescription.value = "";

    productActive.checked =
      true;

    saveProductButton.textContent =
      "Salvar marreta";

  }


  productForm.scrollIntoView({
    behavior:"smooth",
    block:"start"
  });

}


function closeProductForm(){

  productForm.classList.add("hidden");

  editingProductId = null;

  productFormMessage.textContent = "";

  productName.value = "";

  productCategory.value =
    "Comum";

  productPrice.value = "";

  productDiscountPercent.value = 0;
  productDiscountActive.checked = false;

  productOrder.value = 0;

  productImage.value = "";

  productDescription.value = "";

  productActive.checked =
    true;

  saveProductButton.textContent =
    "Salvar marreta";

}


newProductButton.addEventListener(
  "click",
  ()=>openProductForm()
);


cancelProductButton.addEventListener(
  "click",
  closeProductForm
);


async function loadDeliveredOrdersCount(){
  const number = document.querySelector("#delivered-orders-count-number");
  if (!number) return;
  // A consulta depende das permissões existentes do administrador no Supabase.
  const { count, error } = await supabaseClient
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "delivered");
  if (error) {
    console.error("Erro ao contar pedidos entregues:", error);
    if (number.textContent === "—") number.textContent = "Indisponível";
    return;
  }
  number.textContent = String(count ?? 0);
}

async function loadProducts(){

  productsList.innerHTML =
    "<p>Carregando produtos...</p>";


  const {
    data,
    error
  } =
    await supabaseClient
      .from("products")
      .select("*")
      .order(
        "sort_order",
        {ascending:true}
      )
      .order(
        "name",
        {ascending:true}
      );


  if(error){

    console.error(
      "Erro ao carregar produtos:",
      error
    );

    productsList.innerHTML =
      `<p class="message error-message">
        Não foi possível carregar os produtos:
        ${escapeHtml(error.message)}
      </p>`;

    return;
  }


  const products =
    data || [];


  productsCount.textContent =
    `${products.length} produto(s) cadastrado(s).`;


  if(!products.length){

    productsList.innerHTML = `
      <div class="empty-products">
        <div style="font-size:40px">📦</div>
        <p>Nenhuma marreta cadastrada ainda.</p>
      </div>
    `;

    return;
  }


  productsList.innerHTML = "";


  products.forEach(product => {

    const item =
      document.createElement("div");

    item.className =
      "product-admin-item";


    const image =
      document.createElement("img");

    image.className =
      "product-admin-image";

    image.src =
      product.image || "";

    image.alt =
      product.name || "Marreta";

    image.onerror = ()=>{
      image.style.opacity = ".35";
    };


    const info =
      document.createElement("div");

    info.className =
      "product-admin-info";


    const name =
      document.createElement("strong");

    name.textContent =
      product.name || "Sem nome";


    const meta =
      document.createElement("div");

    meta.className =
      "product-admin-meta";


    const rarity =
      document.createElement("span");

    rarity.textContent =
      product.category || "Sem raridade";


    const price =
      document.createElement("span");

    price.textContent =
      money(product.price);


    const stock =
      document.createElement("span");

    stock.textContent =
      `Estoque: ${product.stock ?? 0}`;

    stock.className =
      product.stock > 0
        ? "stock-ok"
        : "stock-empty";


    const status =
      document.createElement("span");

    status.textContent =
      product.active
        ? "● Ativo"
        : "● Inativo";

    status.className =
      product.active
        ? "status-active"
        : "status-inactive";


    const discount = document.createElement("span");
    if (product.discount_active && Number(product.discount_percent) > 0) {
      discount.textContent = `-${Number(product.discount_percent)}% OFF`;
      discount.className = "admin-discount-badge";
    }

    meta.append(
      rarity,
      price,
      ...(discount.textContent ? [discount] : []),
      status
    );


    info.append(
      name,
      meta
    );


    const actions =
      document.createElement("div");

    actions.className =
      "product-admin-actions";


    const editButton =
      document.createElement("button");

    editButton.className =
      "small-button";

    editButton.textContent =
      "✏️ Editar";

    editButton.onclick =
      ()=>openProductForm(product);


    const toggleButton =
      document.createElement("button");

    toggleButton.className =
      "small-button";

    toggleButton.textContent =
      product.active
        ? "👁️ Desativar"
        : "👁️ Ativar";

    toggleButton.onclick =
      ()=>toggleProduct(product);


    const deleteButton =
      document.createElement("button");

    deleteButton.className =
      "small-button danger";

    deleteButton.textContent =
      "🗑️ Excluir";

    deleteButton.onclick =
      ()=>deleteProduct(product);


    actions.append(
      editButton,
      toggleButton,
      deleteButton
    );


    item.append(
      image,
      info,
      actions
    );


    productsList.appendChild(item);

  });

  applyAdminSearch("#products-search", "#products-list", ".product-admin-item", "Nenhuma marreta corresponde à sua busca.");
}


saveProductButton.addEventListener(
  "click",
  async ()=>{

    const name =
      productName.value.trim();

    const category =
      productCategory.value;

    const price =
      Number(String(productPrice.value).trim().replace(",", "."));

    const discountPercent =
      Number(productDiscountPercent.value || 0);

    const discountActive =
      productDiscountActive.checked;

    const sortOrder =
      Number(productOrder.value);

    const image =
      productImage.value.trim();

    const description =
      productDescription.value.trim();

    const active =
      productActive.checked;


    if(!name){

      productFormMessage.textContent =
        "Informe o nome da marreta.";

      return;
    }


    if(
      productPrice.value.trim() === "" ||
      !Number.isFinite(price) ||
      price < 0
    ){

      productFormMessage.textContent =
        "Informe um preço válido.";

      return;
    }
if(
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ){

      productFormMessage.textContent =
        "Informe um desconto entre 0% e 100%.";

      return;
    }


    if(
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ){

      productFormMessage.textContent =
        "Informe uma ordem válida.";

      return;
    }


    saveProductButton.disabled =
      true;

    const editing =
      Boolean(editingProductId);

    saveProductButton.textContent =
      editing
        ? "Salvando..."
        : "Adicionando...";


    try{

      const productData = {

        name,

        description:
          description || null,

        price,

        category,

        image:
          image || null,

        stock: 2147483647,

        discount_percent: discountPercent,
        discount_active: discountActive,

        sort_order:
          sortOrder,

        active

      };


      let result;

      if(editingProductId){
        result = await supabaseClient
          .from("products")
          .update(productData)
          .eq("id", editingProductId)
          .select("id")
          .maybeSingle();
      }else{
        result = await supabaseClient
          .from("products")
          .insert(productData)
          .select("id")
          .single();
      }

      if(result.error){
        productFormMessage.textContent =
          "Não foi possível salvar: " + result.error.message;
        productFormMessage.classList.add("error-message");
        return;
      }

      if(!result.data?.id){
        productFormMessage.textContent =
          "Nenhum produto foi alterado. Confira sua permissão de administrador no Supabase.";
        productFormMessage.classList.add("error-message");
        return;
      }

      productFormMessage.classList.remove("error-message");
      productFormMessage.textContent =
        editing ? "Alterações salvas com sucesso." : "Marreta cadastrada com sucesso.";
      await loadProducts();
      window.alert(editing ? "Alterações do produto salvas com sucesso." : "Marreta cadastrada com sucesso.");
      closeProductForm();

    }catch(error){
      console.error("Erro inesperado ao salvar produto:", error);
      productFormMessage.textContent =
        "Falha inesperada ao salvar. Confira a conexão e tente novamente. " +
        (error?.message || "");
      productFormMessage.classList.add("error-message");
    }finally{

      saveProductButton.disabled =
        false;

      saveProductButton.textContent =
        editing
          ? "Salvar alterações"
          : "Salvar marreta";

    }

  }
);


async function toggleProduct(product){

  const action =
    product.active
      ? "desativar"
      : "ativar";


  if(
    !confirm(
      `Deseja ${action} "${product.name}"?`
    )
  ) return;


  const {
    error
  } =
    await supabaseClient
      .from("products")
      .update({
        active:
          !product.active
      })
      .eq(
        "id",
        product.id
      );


  if(error){

    alert(
      "Não foi possível alterar o status:\n" +
      error.message
    );

    return;
  }


  await loadProducts();

}


async function deleteProduct(product){

  if(
    !confirm(
      `Tem certeza que deseja excluir "${product.name}"?\n\nEssa ação não pode ser desfeita.`
    )
  ) return;


  const {
    error
  } =
    await supabaseClient
      .from("products")
      .delete()
      .eq(
        "id",
        product.id
      );


  if(error){

    alert(
      "Não foi possível excluir:\n" +
      error.message
    );

    return;
  }


  await loadProducts();

}


refreshProductsButton.addEventListener(
  "click",
  loadProducts
);


/* =========================================================
   PEDIDOS
========================================================= */

function setOrdersView(view) {
  const history = view === "history";
  document.querySelector("#active-orders-view")?.classList.toggle("hidden", history);
  document.querySelector("#order-history-view")?.classList.toggle("hidden", !history);
  const activeTab = document.querySelector("#active-orders-tab");
  const historyTab = document.querySelector("#order-history-tab");
  if (activeTab) activeTab.setAttribute("aria-selected", String(!history));
  if (historyTab) historyTab.setAttribute("aria-selected", String(history));
  if (activeTab) activeTab.style.opacity = history ? ".72" : "1";
  if (historyTab) historyTab.style.opacity = history ? "1" : ".72";
}

document.querySelector("#active-orders-tab")?.addEventListener("click", () => setOrdersView("active"));
document.querySelector("#order-history-tab")?.addEventListener("click", () => setOrdersView("history"));

async function loadOrders(focusOrderId = null){
  await loadDeliveredOrdersCount();

  const list =
    document.querySelector(
      "#orders-list"
    );

  const message =
    document.querySelector(
      "#orders-message"
    );


  list.innerHTML =
    "<p>Carregando pedidos...</p>";

  message.textContent = "";


  let {
    data: orders,
    error
  } =
    await supabaseClient
      .from("orders")
      .select("*")
      .neq("status", "cancelled")
      .order(
        "created_at",
        {ascending:true}
      );


  if(error){

    list.innerHTML =
      `<p class="message error-message">
        ${escapeHtml(error.message)}
      </p>`;

    return;
  }


  const historyList = document.querySelector("#order-history-list");
  if (!historyList) return;
  historyList.innerHTML = "";
  list.innerHTML = "";

  // A fila de trabalho prioriza pedidos pagos/prontos para entrega e ordena
  // cada etapa do mais antigo para o mais recente.
  const stageRank = order => {
    if (["awaiting_delivery", "payment_confirmed"].includes(order.status)) return 0;
    if (order.status === "awaiting_verification") return 1;
    if (order.status === "awaiting_payment") return 2;
    return 3;
  };
  orders = (orders || []).slice().sort((a, b) => {
    if (a.status === "delivered" && b.status === "delivered") {
      return new Date(b.delivered_at || b.created_at || 0).getTime() - new Date(a.delivered_at || a.created_at || 0).getTime();
    }
    if (a.status === "delivered") return 1;
    if (b.status === "delivered") return -1;
    const stageDifference = stageRank(a) - stageRank(b);
    if (stageDifference) return stageDifference;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  // Carrega as imagens do catálogo para associá-las aos itens de cada pedido.
  // O pedido continua mostrando nome e preço mesmo se uma imagem não existir.
  const { data: productImages, error: productImagesError } = await supabaseClient
    .from("products")
    .select("id, image");

  if(productImagesError){
    console.warn("Não foi possível carregar as imagens dos produtos:", productImagesError);
  }

  const productImageById = new Map(
    (productImages || []).map(product => [String(product.id), product.image || ""])
  );

  for(const order of orders){

    const {
      data: items
    } =
      await supabaseClient
        .from("order_items")
        .select("*")
        .eq(
          "order_id",
          order.id
        );


    const card =
      document.createElement("div");

    card.className =
      "order-card";
    card.id = `order-card-${order.id}`;


    const title =
      document.createElement("h3");

    title.textContent =
      `📦 Pedido #${order.id.slice(0,8)}`;


    const date =
      document.createElement("p");

    date.innerHTML =
      `<strong>Data:</strong> ${formatDate(order.created_at)}`;


    const status =
      document.createElement("p");

    status.innerHTML =
      `<strong>Status:</strong> `;


    const statusBadge =
      document.createElement("span");

    statusBadge.className =
      "status-badge";

    statusBadge.textContent =
      formatOrderStatus(
        order.status
      );


    status.appendChild(
      statusBadge
    );


    const customer =
      document.createElement("p");

    customer.innerHTML =
      `<strong>Cliente:</strong> Compra sem cadastro`;


    const privateInfo =
      document.createElement("div");

    privateInfo.className =
      "private-info";

    privateInfo.innerHTML = `
      <strong>🔒 Dados informados no checkout</strong>

      <div style="margin-top:8px">
        <strong>TikTok:</strong>
        ${escapeHtml(order.tiktok_username || "Não informado")}
      </div>

      <div style="margin-top:5px">
        <strong>Roblox:</strong>
        ${escapeHtml(order.delivery_username || "Não informado")}
      </div>
      <div style="margin-top:5px">
        <strong>Nome no Pix:</strong>
        ${escapeHtml(order.pix_name || "Não informado")}
      </div>

    `;


    const itemsBox =
      document.createElement("div");

    itemsBox.className =
      "order-items";


    const itemsTitle =
      document.createElement("strong");

    itemsTitle.textContent =
      "Itens do pedido";


    itemsBox.appendChild(
      itemsTitle
    );


    (items || []).forEach(item => {

      const row = document.createElement("div");
      row.className = "order-item";

      const thumb = document.createElement("div");
      thumb.className = "order-item-thumb";
      thumb.textContent = "🔨";

      const imageUrl = productImageById.get(String(item.product_id || ""));
      if(imageUrl){
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = item.product_name || "Imagem da marreta";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => {
          image.remove();
          thumb.textContent = "🔨";
        }, { once: true });
        thumb.textContent = "";
        thumb.appendChild(image);
      }

      const details = document.createElement("div");
      details.className = "order-item-details";

      const name = document.createElement("span");
      name.className = "order-item-name";
      name.textContent = item.product_name || "Produto sem nome";

      const price = document.createElement("span");
      price.className = "order-item-price";
      price.textContent = `${item.quantity} × ${money(Number(item.product_price))} = ${money(
        Number(item.product_price) * Number(item.quantity)
      )}`;

      details.append(name, price);
      row.append(thumb, details);
      itemsBox.appendChild(row);

    });


    const total =
      document.createElement("div");

    total.className =
      "order-total";

    total.innerHTML =
      `<strong>Total: ${money(order.total)}</strong>`;


    const actions =
      document.createElement("div");

    actions.className =
      "order-actions";


    if(
      order.status ===
      "awaiting_delivery" ||
      order.status ===
      "payment_confirmed"
    ){

      const delivered =
        document.createElement("button");

      delivered.className =
        "primary-button";

      delivered.textContent =
        "✅ Marcar como entregue";

      delivered.onclick =
        ()=>markDelivered(
          order.id
        );

      actions.appendChild(
        delivered
      );

    }


    if(
      order.status ===
      "delivered"
    ){

      const deliveredLabel =
        document.createElement("span");

      deliveredLabel.className =
        "status-badge";

      deliveredLabel.textContent =
        "✅ Entregue";

      actions.appendChild(
        deliveredLabel
      );

    }


    card.append(
      title,
      date,
      customer,
      status,
      privateInfo,
      itemsBox,
      total,
      actions
    );


    (order.status === "delivered" ? historyList : list).appendChild(card);

  }

  if (!list.querySelector(".order-card")) {
    list.innerHTML = `<div class="empty-products"><div style="font-size:40px">📦</div><p>Nenhum pedido aguardando atendimento.</p></div>`;
  }
  if (!historyList.querySelector(".order-card")) {
    historyList.innerHTML = `<div class="empty-products"><div style="font-size:40px">🗂️</div><p>Nenhuma entrega no histórico ainda.</p></div>`;
  }

  applyAdminSearch("#orders-search", "#orders-list", ".order-card", "Nenhum pedido corresponde à sua busca.");
  applyAdminSearch("#order-history-search", "#order-history-list", ".order-card", "Nenhum pedido no histórico corresponde à sua busca.");

  // Depois de uma ação, leva o administrador diretamente ao pedido atualizado.
  if (focusOrderId) {
    const focusedCard = document.getElementById(`order-card-${focusOrderId}`);
    if (focusedCard) {
      focusedCard.style.outline = "2px solid #62c8d5";
      focusedCard.style.outlineOffset = "3px";
      focusedCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}


async function markDelivered(orderId){
  if(!confirm("Marcar este pedido como entregue?")) return;
  const {data: deliveredOrder, error}=await supabaseClient
    .from("orders")
    .update({status:"delivered",delivered_at:new Date().toISOString(),updated_at:new Date().toISOString()})
    .eq("id",orderId)
    .in("status", ["awaiting_delivery", "payment_confirmed"])
    .select("customer_id, status")
    .maybeSingle();
  if(error){alert("Não foi possível atualizar o pedido:\n"+error.message);return;}
  if(!deliveredOrder){
    alert("Este pedido não está mais aguardando entrega. Atualize a lista para conferir o status atual.");
    await loadOrders(orderId);
    return;
  }
  if(deliveredOrder.customer_id){
    const {error: notificationError}=await supabaseClient.from("notifications").insert({customer_id:deliveredOrder.customer_id,title:"Pedido entregue 🎉",message:"Parabéns! Obrigado pela compra. Esperamos ver você novamente na Thoune Store. Sua avaliação está disponível no painel do pedido.",type:"order_delivered"});
    if(notificationError) console.error("Não foi possível notificar o cliente sobre a entrega:", notificationError);
  }
  await loadOrders(orderId);
}


document
  .querySelector(
    "#refresh-orders-button"
  )
  .addEventListener(
    "click",
    loadOrders
  );


/* =========================================================
   PAGAMENTOS
========================================================= */

async function loadPayments(){

  const list =
    document.querySelector(
      "#payments-list"
    );


  list.innerHTML =
    "<p>Carregando pagamentos...</p>";


  const {
    data: payments,
    error
  } =
    await supabaseClient
      .from("payments")
      .select("*")
      .order(
        "created_at",
        {ascending:false}
      );


  if(error){

    list.innerHTML =
      `<p class="message error-message">
        ${escapeHtml(error.message)}
      </p>`;

    return;
  }


  const pending = [];


  for(
    const payment of payments || []
  ){

    if(
      payment.status !==
      "pending"
    ){

      continue;
    }


    const {
      data: order,
      error: orderError
    } =
      await supabaseClient
        .from("orders")
        .select("*")
        .eq(
          "id",
          payment.order_id
        )
        .maybeSingle();


    if(orderError){

      console.error(
        "Erro ao carregar pedido do pagamento:",
        orderError
      );

      continue;
    }


    /*
      O pagamento só aparece no ADM
      depois que o cliente informou
      que realizou o Pix.
    */

    if(
      !order ||
      order.status !==
        "awaiting_verification"
    ){

      continue;
    }


    pending.push({
      payment,
      order
    });

  }


  if(!pending.length){

    list.innerHTML =
      `<div class="empty-products">

        <div style="font-size:40px">
          💳
        </div>

        <p>
          Nenhum pagamento aguardando confirmação.
        </p>

      </div>`;

    return;
  }


  list.innerHTML = "";


  for(
    const entry of pending
  ){

    const order =
      entry.order;


    const {
      data: items,
      error: itemsError
    } =
      await supabaseClient
        .from("order_items")
        .select("*")
        .eq(
          "order_id",
          order.id
        );


    if(itemsError){

      console.error(
        "Erro ao carregar itens do pedido:",
        itemsError
      );

    }


    const card =
      document.createElement("div");

    card.className =
      "payment-card";


    const title =
      document.createElement("h3");

    title.textContent =
      `💳 Pedido #${order.id.slice(0,8)}`;


    const date =
      document.createElement("p");

    date.innerHTML =
      `<strong>Data:</strong> ${formatDate(order.created_at)}`;


    const status =
      document.createElement("div");

    status.className =
      "payment-status";

    status.textContent =
      "⏳ Cliente informou o pagamento";


    const privateInfo =
      document.createElement("div");

    privateInfo.className =
      "private-info";

    privateInfo.innerHTML = `
      <strong>🔒 Dados informados pelo cliente</strong>

      <div style="margin-top:8px">
        <strong>Nome no Pix:</strong>
        ${escapeHtml(
          order.pix_name ||
          "Não informado"
        )}
      </div>

      <div style="margin-top:5px">
        <strong>TikTok:</strong>
        ${escapeHtml(
          order.tiktok_username ? `@${String(order.tiktok_username).replace(/^@/, "")}` : "Não informado"
        )}
      </div>

      <div style="margin-top:5px">
        <strong>Roblox:</strong>
        ${escapeHtml(
          order.delivery_username ||
          "Não informado"
        )}
      </div>
    `;


    const proofBox = document.createElement("div");
    proofBox.className = "private-info";
    proofBox.innerHTML = `<strong>📷 Comprovante</strong><div id="proof-${order.id}" style="margin-top:8px;color:#8fb5bd;">${entry.payment.payment_proof_path ? "Carregando comprovante..." : "Nenhum comprovante enviado."}</div>`;
    if (entry.payment.payment_proof_path) {
      supabaseClient.storage.from("payment-proofs").createSignedUrl(entry.payment.payment_proof_path, 3600).then(({data, error}) => {
        const box = document.querySelector(`#proof-${CSS.escape(order.id)}`);
        if (!box) return;
        if (error || !data?.signedUrl) { box.textContent = "Não foi possível abrir o comprovante."; return; }
        box.innerHTML = `<a href="${escapeHtml(data.signedUrl)}" target="_blank" rel="noopener noreferrer">Abrir comprovante ↗</a>`;
      });
    }

    const total =
      document.createElement("p");

    total.innerHTML =
      `<strong>Total:</strong> ${money(order.total)}`;


    const itemsBox =
      document.createElement("div");

    itemsBox.className =
      "order-items";


    const itemsTitle =
      document.createElement("strong");

    itemsTitle.textContent =
      "Itens do pedido";


    itemsBox.appendChild(
      itemsTitle
    );


    for(
      const item of items || []
    ){

      const row =
        document.createElement("div");

      row.className =
        "order-item";

      row.textContent =
        `${item.product_name} × ${item.quantity} — ${money(
          Number(item.product_price) *
          Number(item.quantity)
        )}`;

      itemsBox.appendChild(
        row
      );

    }


    const button =
      document.createElement("button");

    button.className =
      "primary-button";

    button.style.marginTop =
      "15px";

    button.textContent =
      "✅ Confirmar pagamento";


    button.onclick =
      async ()=>{

        if(
          !confirm(
            "Você confirmou que o pagamento realmente caiu no Pix?"
          )
        ){

          return;
        }


        button.disabled =
          true;

        button.textContent =
          "Confirmando...";


        const {
          data,
          error
        } =
          await supabaseClient
            .rpc(
              "confirm_payment",
              {
                p_order_id:
                  order.id
              }
            );


        if(error){

          button.disabled =
            false;

          button.textContent =
            "✅ Confirmar pagamento";

          alert(
            "Não foi possível confirmar o pagamento:\n" +
            error.message
          );

          return;
        }


        if(!data?.success){

          button.disabled =
            false;

          button.textContent =
            "✅ Confirmar pagamento";

          alert(
            data?.message ||
            "O pagamento não pôde ser confirmado."
          );

          return;
        }


        alert(
          "Pagamento confirmado com sucesso! ✅\n\nAbrindo os dados de entrega do pedido..."
        );

        // O pedido sai da fila de pagamentos e passa para a fila de entrega.
        // Abrimos a seção de pedidos automaticamente e destacamos o pedido confirmado.
        showSection("orders");
        await loadOrders(order.id);

      };


    const rejectButton = document.createElement("button");
    rejectButton.className = "small-button danger-button";
    rejectButton.style.marginTop = "10px";
    rejectButton.textContent = "❌ Recusar pedido / Pix não recebido";
    rejectButton.onclick = async () => {
      const reason = window.prompt("Motivo para recusar o pagamento:", "Pix não localizado pela loja.");
      if (reason === null) return;
      rejectButton.disabled = true;
      const { data: rejected, error: rejectError } = await supabaseClient.rpc("reject_guest_payment", { p_order_id: order.id, p_reason: reason.trim() || "Pix não localizado pela loja." });
      if (rejectError || !rejected?.success) {
        rejectButton.disabled = false;
        alert("Não foi possível recusar o pedido:\n" + (rejectError?.message || rejected?.message || "Erro desconhecido"));
        return;
      }
      await loadPayments();
    };

    card.append(
      title,
      date,
      status,
      privateInfo,
      proofBox,
      total,
      itemsBox,
      button,
      rejectButton
    );


    list.appendChild(
      card
    );

  }

  applyAdminSearch("#payments-search", "#payments-list", ".payment-card", "Nenhum pagamento corresponde à sua busca.");
}


document
  .querySelector(
    "#refresh-payments-button"
  )
  .addEventListener(
    "click",
    loadPayments
  );


/* =========================================================
   ATENDIMENTO
========================================================= */

let serviceOnline = false;


async function loadServiceStatus(){

  const {
    data,
    error
  } =
    await supabaseClient
      .from("store_settings")
      .select("online")
      .eq(
        "id",
        1
      )
      .maybeSingle();


  if(error){

    alert(
      "Não foi possível carregar o status:\n" +
      error.message
    );

    return;
  }


  serviceOnline =
    Boolean(data?.online);


  updateServiceUI();

}


function updateServiceUI(){

  const text =
    document.querySelector(
      "#service-status-text"
    );

  const button =
    document.querySelector(
      "#toggle-service-button"
    );


  if(serviceOnline){

    text.textContent =
      "🟢 Atendimento online";

    button.textContent =
      "🔴 Colocar offline";

  }else{

    text.textContent =
      "⚪ Atendimento offline";

    button.textContent =
      "🟢 Colocar online";

  }

}


async function toggleService(){

  const newStatus =
    !serviceOnline;


  const {
    error
  } =
    await supabaseClient
      .from("store_settings")
      .update({

        online:
          newStatus,

        updated_at:
          new Date().toISOString()

      })
      .eq(
        "id",
        1
      );


  if(error){

    alert(
      "Não foi possível alterar o atendimento:\n" +
      error.message
    );

    return;
  }


  serviceOnline =
    newStatus;


  updateServiceUI();

}


document
  .querySelector(
    "#toggle-service-button"
  )
  .addEventListener(
    "click",
    toggleService
  );


/* =========================================================
   PROMOÇÃO
========================================================= */

const discountPercent =
  document.querySelector(
    "#discount-percent"
  );

const discountActive =
  document.querySelector(
    "#discount-active"
  );

const discountPreview =
  document.querySelector(
    "#discount-preview"
  );

const discountMessage =
  document.querySelector(
    "#discount-message"
  );


function updateDiscountPreview(){

  const value =
    Number(
      discountPercent.value
    );


  if(
    !Number.isFinite(value) ||
    value <= 0
  ){

    discountPreview.textContent =
      "Nenhum desconto configurado.";

    return;
  }


  discountPreview.textContent =
    `Desconto configurado: ${value}%`;

}


discountPercent.addEventListener(
  "input",
  updateDiscountPreview
);


async function loadPromotion(){

  discountMessage.textContent =
    "";


  const {
    data,
    error
  } =
    await supabaseClient
      .from("store_settings")
      .select(
        "discount_percent, discount_active"
      )
      .eq(
        "id",
        1
      )
      .maybeSingle();


  if(error){

    discountMessage.textContent =
      "Erro: " +
      error.message;

    discountMessage.className =
      "message error-message";

    return;
  }


  discountPercent.value =
    data?.discount_percent ?? 0;

  discountActive.checked =
    Boolean(
      data?.discount_active
    );


  updateDiscountPreview();

}


document
  .querySelector(
    "#save-discount-button"
  )
  .addEventListener(
    "click",
    async (event)=>{
      const button = event.currentTarget;
      if (button.disabled) return;
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Salvando…";
      try {
      const percent =
        Number(
          discountPercent.value
        );

      const active =
        discountActive.checked;


      if(
        !Number.isFinite(percent) ||
        percent < 0 ||
        percent > 100
      ){

        discountMessage.textContent =
          "O desconto deve estar entre 0% e 100%.";

        discountMessage.className =
          "message error-message";

        return;
      }


      const {
        error
      } =
        await supabaseClient
          .from("store_settings")
          .update({

            discount_percent:
              percent,

            discount_active:
              active,

            updated_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            1
          );


      if(error){

        discountMessage.textContent =
          "Erro: " +
          error.message;

        discountMessage.className =
          "message error-message";

        return;
      }


      discountMessage.textContent =
        "Promoção salva com sucesso! ✅";

      discountMessage.className =
        "message success-message";


      updateDiscountPreview();
      } catch (err) {
        discountMessage.textContent = "Não foi possível salvar a promoção: " + (err?.message || "erro inesperado");
        discountMessage.className = "message error-message";
      } finally {
        button.disabled = false;
        button.textContent = originalText || "Salvar desconto";
      }
    }
  );


/* =========================================================
   ENTREGA
========================================================= */

const pixKey =
  document.querySelector(
    "#pix-key"
  );

const deliveryBotUsername =
  document.querySelector(
    "#delivery-bot-username"
  );

const deliveryBotUrl =
  document.querySelector("#delivery-bot-url");

const joinOpen =
  document.querySelector("#join-open");

const deliveryMessage =
  document.querySelector(
    "#delivery-message"
  );


async function loadDeliverySettings(){

  deliveryMessage.textContent =
    "";


  const {
    data,
    error
  } =
    await supabaseClient
      .from("store_settings")
      .select(
        "pix_key, delivery_bot_username, delivery_bot_url, join_open"
      )
      .eq(
        "id",
        1
      )
      .maybeSingle();


  if(error){

    deliveryMessage.textContent =
      "Erro: " +
      error.message;

    deliveryMessage.className =
      "message error-message";

    return;
  }


  pixKey.value =
    data?.pix_key || "";

  deliveryBotUsername.value =
    data?.delivery_bot_username || "";

  deliveryBotUrl.value =
    data?.delivery_bot_url || "";

  joinOpen.checked =
    data?.join_open !== false;

}


document
  .querySelector(
    "#save-delivery-button"
  )
  .addEventListener(
    "click",
    async ()=>{

      const pix =
        pixKey.value.trim();

      const username =
        deliveryBotUsername.value.trim();
      const botUrl =
        deliveryBotUrl.value.trim();


      const {
        error
      } =
        await supabaseClient
          .from("store_settings")
          .update({

            pix_key:
              pix || null,

            delivery_bot_username:
              username || null,

            delivery_bot_url:
              botUrl || null,

            join_open:
              joinOpen.checked,

            updated_at:
              new Date().toISOString()

          })
          .eq(
            "id",
            1
          );


      if(error){

        deliveryMessage.textContent =
          "Erro: " +
          error.message;

        deliveryMessage.className =
          "message error-message";

        return;
      }


      deliveryMessage.textContent =
        "Configurações de entrega salvas! ✅";

      deliveryMessage.className =
        "message success-message";

    }
  );


/* =========================================================
   AVALIAÇÕES
========================================================= */

async function loadReviews(){

  const list =
    document.querySelector(
      "#reviews-list"
    );


  list.innerHTML =
    "<p>Carregando avaliações...</p>";


  const {
    data: reviews,
    error
  } =
    await supabaseClient
      .from("reviews")
      .select("*")
      .order(
        "created_at",
        {ascending:false}
      );


  if(error){

    list.innerHTML =
      `<p class="message error-message">
        ${escapeHtml(error.message)}
      </p>`;

    return;
  }


  if(!reviews?.length){

    list.innerHTML =
      `<div class="empty-products">

        <div style="font-size:40px">
          ⭐
        </div>

        <p>
          Nenhuma avaliação encontrada.
        </p>

      </div>`;

    return;
  }


  list.innerHTML = "";


  reviews.forEach(review => {

    const card =
      document.createElement("div");

    card.className =
      "review-card";


    const author =
      review.tiktok_username
        ? `@${String(review.tiktok_username).replace(/^@/, "")}`
        : "Cliente";


    const rating =
      Math.max(
        0,
        Math.min(
          5,
          Number(
            review.rating || 0
          )
        )
      );


    const stars =
      "★".repeat(rating) +
      "☆".repeat(5 - rating);


    card.innerHTML = `
      <h3>
        ${escapeHtml(author)}
      </h3>

      <div class="review-stars">
        ${stars}
      </div>

      <p class="review-text">
        ${escapeHtml(
          review.text ||
          "Sem comentário."
        )}
      </p>

      <div class="review-author">Status: <strong>${escapeHtml(review.status || "pending")}</strong></div>
      ${review.moderation_reason ? `<p class="review-moderation-reason"><strong>Motivo:</strong> ${escapeHtml(review.moderation_reason)}</p>` : ""}
    `;


    const actions =
      document.createElement("div");

    actions.className =
      "order-actions";


    if(
      review.status ===
      "pending"
    ){

      const approve =
        document.createElement("button");

      approve.className =
        "small-button success";

      approve.textContent =
        "✅ Aprovar";

      approve.onclick =
        ()=>updateReviewStatus(
          review.id,
          "approved"
        );


      const reject =
        document.createElement("button");

      reject.className =
        "small-button danger";

      reject.textContent =
        "❌ Rejeitar";

      reject.onclick =
        ()=>updateReviewStatus(
          review.id,
          "rejected"
        );


      actions.append(
        approve,
        reject
      );

    }else{

      const status =
        document.createElement("span");

      status.className =
        "status-badge";

      status.textContent =
        review.status ===
        "approved"
          ? "✅ Aprovada"
          : review.status === "rejected"
            ? "❌ Rejeitada"
            : "⏳ Pendente";

      actions.appendChild(
        status
      );

    }

    const deleteReviewButton = document.createElement("button");
    deleteReviewButton.className = "small-button danger";
    deleteReviewButton.textContent = "🗑️ Excluir avaliação";
    deleteReviewButton.onclick = () => deleteReview(review.id);
    actions.appendChild(deleteReviewButton);

    card.appendChild(
      actions
    );


    list.appendChild(
      card
    );

  });

}


async function updateReviewStatus(reviewId, status){
  let moderationReason = null;
  if (status === "rejected") {
    moderationReason = window.prompt("Informe o motivo da retirada/rejeição. Esse motivo será mostrado ao cliente:");
    if (moderationReason === null) return;
    moderationReason = moderationReason.trim();
    if (moderationReason.length < 3) {
      alert("Informe um motivo com pelo menos 3 caracteres.");
      return;
    }
  }

  const { data: review, error: fetchError } = await supabaseClient
    .from("reviews").select("id, customer_id, tiktok_username").eq("id", reviewId).maybeSingle();
  if (fetchError || !review) {
    alert("Não foi possível localizar a avaliação: " + (fetchError?.message || "registro não encontrado"));
    return;
  }

  const update = { status, moderation_reason: moderationReason,
    moderated_at: new Date().toISOString() };
  const { error } = await supabaseClient.from("reviews").update(update).eq("id", reviewId);
  if (error) {
    alert("Não foi possível atualizar a avaliação:\n" + error.message + "\n\nConfirme se a migração SQL de avaliações foi executada.");
    return;
  }

  if (status === "rejected" && review.customer_id) {
    const { error: notificationError } = await supabaseClient.from("notifications").insert({
      customer_id: review.customer_id,
      title: "Sua avaliação foi retirada",
      message: "Sua avaliação foi retirada pela equipe da Thoune Store. Motivo: " + moderationReason + " Se precisar de esclarecimentos, entre em contato com o suporte.",
      type: "review_rejected"
    });
    if (notificationError) console.error("Não foi possível notificar o cliente sobre a avaliação:", notificationError);
  }
  await loadReviews();
}


async function deleteReview(reviewId){
  const confirmed = window.confirm("Excluir esta avaliação definitivamente?\n\nEssa ação não pode ser desfeita.");
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("reviews")
    .delete()
    .eq("id", reviewId);

  if (error) {
    alert("Não foi possível excluir a avaliação:\n" + error.message);
    return;
  }

  await loadReviews();
}


document
  .querySelector(
    "#refresh-reviews-button"
  )
  .addEventListener(
    "click",
    loadReviews
  );


/* =========================================================
   UTILITÁRIOS
========================================================= */

function money(value){

  return Number(
    value || 0
  ).toLocaleString(
    "pt-BR",
    {
      style:"currency",
      currency:"BRL"
    }
  );

}


function formatDate(value){

  return new Date(
    value
  ).toLocaleString(
    "pt-BR"
  );

}


function formatOrderStatus(status){

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


  return labels[status] ||
    status ||
    "Desconhecido";

}


function escapeHtml(value=""){

  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
  "click",
  async ()=>{

    await supabaseClient.auth.signOut();

    window.location.href =
      "index.html";

  }
);


/* =========================================================
   INICIAR
========================================================= */

checkAdminAccess().catch((err) => {
  console.error("Erro ao iniciar painel ADM:", err);
  loadingScreen.classList.add("hidden");
  accessDenied.classList.remove("hidden");
  if (adminLoginMessage) adminLoginMessage.textContent = "O painel não conseguiu carregar. Confira a conexão e tente entrar novamente.";
});

