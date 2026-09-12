import {demoProducts} from "./demo-products.js";
import {loadCart, orderText} from "./cart.js";
import {renderProducts, renderCart, updateCartBadge, toast} from "./ui.js";

let products = [...demoProducts];
let selectedCategory = "Todas";
let search = "";
let sort = "popular";

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
  let result = products.filter(p=>p.active && (selectedCategory==="Todas" || p.rarity===selectedCategory) && p.name.toLowerCase().includes(search));
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
