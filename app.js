import {demoProducts} from "./demo-products.js";
import {loadCart, orderText} from "./cart.js";
import {renderProducts, renderCart, updateCartBadge, toast} from "./ui.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
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
async function updateAccountUI() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    accountDetails.classList.remove("hidden");
accountEmail.textContent = session.user.email || "";
    profileFields.classList.remove("hidden");
await loadProfile(session.user.id);
    accountMessage.textContent = "Você está conectado à sua conta.";
    loginButton.classList.add("hidden");
    signupButton.classList.add("hidden");
    logoutButton.classList.remove("hidden");
    authEmail.value = session.user.email || "";
    authEmail.disabled = true;
    authPassword.classList.add("hidden");
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
  }
}

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

updateAccountUI();
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
toast("Produtos carregados: " + products.length);
refresh();
}
loadProducts();

const menuToggle = document.querySelector("#menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");
menuToggle.addEventListener("click",()=>mobileNav.classList.toggle("open"));
mobileNav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>mobileNav.classList.remove("open")));

document.querySelectorAll(".category").forEach(button=>{
  button.addEventListener("click",()=>{
    document.querySelectorAll(".category").forEach(b=>b.classList.remove("active"));
    button.classList.add("active");
    selectedCategory = button.dataset.category;
    refresh();
  });
});
document.querySelector("#search-input").addEventListener("input",e=>{search=e.target.value.trim().toLowerCase();refresh()});
document.querySelector("#sort-select").addEventListener("change",e=>{sort=e.target.value;refresh()});

function filtered(){
  let result = products.filter(p=>p.active && (selectedCategory==="Todas" || p.category===selectedCategory) && p.name.toLowerCase().includes(search));
  if(sort==="low") result.sort((a,b)=>a.price-b.price);
  if(sort==="high") result.sort((a,b)=>b.price-a.price);
  if(sort==="popular") result.sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  return result;
}
function refresh(){renderProducts(filtered())}

const drawer = document.querySelector("#cart-drawer");
function openCart(){drawer.classList.add("open");renderCart(loadCart())}
function closeCart(){drawer.classList.remove("open")}
document.querySelector("#open-cart").addEventListener("click",openCart);
document.querySelector("#close-cart").addEventListener("click",closeCart);
document.querySelector("#close-cart-button").addEventListener("click",closeCart);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCart()});

document.querySelector("#copy-order-button").addEventListener("click",async()=>{
  const cart=loadCart();
  if(!cart.length){toast("Seu carrinho está vazio.");return}
  try{
    await navigator.clipboard.writeText(orderText(cart));
    toast("Pedido copiado! Agora é só enviar no TikTok.");
  }catch{
    toast("Não foi possível copiar automaticamente.");
  }
});

document.querySelector("#checkout-button").addEventListener("click",()=>{
  const cart=loadCart();
  if(!cart.length){toast("Adicione uma marreta ao carrinho primeiro.");return}
  toast("O fluxo de compra será conectado ao Supabase nesta etapa.");
});

// Atualiza o catálogo sem fingir que o backend já está conectado.
refresh();
updateCartBadge(loadCart());
