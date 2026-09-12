const products = [
  {id:1,name:"Strawberry Moo Plushie",category:"Exclusiva",price:200,stock:1,img:"assets/thoune-brand.jpg",featured:1},
  {id:2,name:"Frosted",category:"Rara",price:19.99,stock:4,img:"assets/thoune-brand.jpg",featured:2},
  {id:3,name:"Party Balloons",category:"Rara",price:12.50,stock:8,img:"assets/thoune-brand.jpg",featured:3},
  {id:4,name:"Carousel",category:"Épica",price:8,stock:6,img:"assets/thoune-brand.jpg",featured:4},
  {id:5,name:"Darkheart",category:"Lendária",price:45,stock:2,img:"assets/thoune-brand.jpg",featured:5},
  {id:6,name:"Sweet Tooth",category:"Rara",price:22,stock:5,img:"assets/thoune-brand.jpg",featured:6}
];

let cart = JSON.parse(localStorage.getItem("thouneCart") || "[]");
let activeCategory = "Todas";

const grid = document.querySelector("#productGrid");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");
const globalSearch = document.querySelector("#globalSearch");
const catalogSearch = document.querySelector("#catalogSearch");
const sortSelect = document.querySelector("#sortSelect");

const money = value => value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function filteredProducts(){
  const q = (catalogSearch.value || globalSearch.value || "").trim().toLowerCase();
  let list = products.filter(p =>
    (activeCategory === "Todas" || p.category === activeCategory) &&
    (!q || p.name.toLowerCase().includes(q))
  );
  if(sortSelect.value==="priceAsc") list.sort((a,b)=>a.price-b.price);
  if(sortSelect.value==="priceDesc") list.sort((a,b)=>b.price-a.price);
  if(sortSelect.value==="name") list.sort((a,b)=>a.name.localeCompare(b.name));
  if(sortSelect.value==="featured") list.sort((a,b)=>a.featured-b.featured);
  return list;
}

function renderProducts(){
  const list = filteredProducts();
  resultCount.textContent = `${list.length} ${list.length===1?"item encontrado":"itens encontrados"}`;
  grid.innerHTML = list.map(p=>{
    const inCart = cart.find(x=>x.id===p.id)?.qty || 0;
    return `<article class="product">
      <div class="product-img"><img src="${p.img}" alt="${p.name}"></div>
      <div class="product-top"><h3>${p.name}</h3><button class="heart" data-heart="${p.id}" aria-label="Favoritar">♡</button></div>
      <span class="rarity">${p.category}</span>
      <div class="price">${money(p.price)}</div>
      <div class="stock">${p.stock>0?`Estoque disponível: ${p.stock}`:"Sem estoque"}</div>
      <button class="add-btn" data-add="${p.id}" ${p.stock===0?"disabled":""}>🛒 ${inCart?"Adicionar mais":"Adicionar ao carrinho"}</button>
    </article>`;
  }).join("");
  emptyState.classList.toggle("hidden", list.length>0);
}

function save(){localStorage.setItem("thouneCart",JSON.stringify(cart));renderProducts();renderCart();}
function add(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  const row=cart.find(x=>x.id===id);
  if(row){ if(row.qty<p.stock) row.qty++; else return toast("Quantidade máxima disponível."); }
  else cart.push({id,qty:1});
  save(); toast(`${p.name} foi adicionada ao carrinho.`);
}
function renderCart(){
  const items=document.querySelector("#cartItems"), empty=document.querySelector("#cartEmpty");
  const total=cart.reduce((sum,row)=>{const p=products.find(x=>x.id===row.id);return sum+p.price*row.qty},0);
  document.querySelector("#cartTotal").textContent=money(total);
  document.querySelector("#cartBadge").textContent=cart.reduce((s,x)=>s+x.qty,0);
  empty.classList.toggle("hidden",cart.length>0);
  items.innerHTML=cart.map(row=>{
    const p=products.find(x=>x.id===row.id);
    return `<div class="cart-row">
      <img src="${p.img}" alt="">
      <div><h4>${p.name}</h4><small>${money(p.price)} cada</small><div class="qty">
        <button data-minus="${p.id}">−</button><span>${row.qty}</span><button data-plus="${p.id}">+</button>
      </div></div>
      <strong>${money(p.price*row.qty)}</strong>
    </div>`;
  }).join("");
}
function changeQty(id,delta){
  const row=cart.find(x=>x.id===id); const p=products.find(x=>x.id===id); if(!row)return;
  row.qty+=delta;
  if(row.qty<=0) cart=cart.filter(x=>x.id!==id);
  if(row.qty>p.stock) row.qty=p.stock;
  save();
}
function openCart(){document.querySelector("#cartDrawer").classList.add("open");document.querySelector("#cartDrawer").setAttribute("aria-hidden","false")}
function closeCart(){document.querySelector("#cartDrawer").classList.remove("open");document.querySelector("#cartDrawer").setAttribute("aria-hidden","true")}
function toast(msg){const t=document.querySelector("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove("show"),2200)}
function openSupport(){ window.open("https://www.tiktok.com/","_blank","noopener"); return false; }

grid.addEventListener("click",e=>{
  const addBtn=e.target.closest("[data-add]"); if(addBtn)add(+addBtn.dataset.add);
  const heart=e.target.closest("[data-heart]"); if(heart){heart.classList.toggle("active");heart.textContent=heart.classList.contains("active")?"♥":"♡";}
});
document.querySelector(".filters").addEventListener("click",e=>{
  const b=e.target.closest("[data-category]"); if(!b)return;
  activeCategory=b.dataset.category;
  document.querySelectorAll(".filter-cat").forEach(x=>x.classList.toggle("active",x===b));
  renderProducts();
});
catalogSearch.addEventListener("input",()=>{globalSearch.value=catalogSearch.value;renderProducts()});
globalSearch.addEventListener("input",()=>{catalogSearch.value=globalSearch.value;renderProducts()});
sortSelect.addEventListener("change",renderProducts);
document.querySelector("#clearFilters").onclick=()=>{activeCategory="Todas";catalogSearch.value="";globalSearch.value="";document.querySelectorAll(".filter-cat").forEach((x,i)=>x.classList.toggle("active",i===0));renderProducts()};

document.querySelector("#openCart").onclick=openCart;
document.querySelector("#mobileCart").onclick=()=>{document.querySelector("#mobileMenu").classList.remove("open");openCart()};
document.querySelector("#closeCart").onclick=closeCart;
document.querySelector("#cartDrawer").addEventListener("click",e=>{if(e.target.id==="cartDrawer")closeCart()});
document.querySelector("#cartItems").addEventListener("click",e=>{
  const plus=e.target.closest("[data-plus]"),minus=e.target.closest("[data-minus]");
  if(plus)changeQty(+plus.dataset.plus,1); if(minus)changeQty(+minus.dataset.minus,-1);
});

document.querySelector("#copyOrder").onclick=async()=>{
  if(!cart.length)return toast("Seu carrinho está vazio.");
  const lines=["📦 Pedido — Thoune Store","",...cart.map(row=>{const p=products.find(x=>x.id===row.id);return`• ${p.name} ×${row.qty} — ${money(p.price*row.qty)}`})];
  lines.push("",`💰 Total: ${document.querySelector("#cartTotal").textContent}`);
  try{await navigator.clipboard.writeText(lines.join("\n"));toast("Pedido copiado!")}catch{toast("Não foi possível copiar automaticamente.")}
};
document.querySelector("#buyBtn").onclick=()=>{
  if(!cart.length)return toast("Adicione pelo menos uma marreta.");
  // Prototype: store online/offline is controlled later from Supabase/admin.
  document.querySelector("#offlineModal").classList.add("open");
};
document.querySelectorAll("[data-close-modal]").forEach(b=>b.onclick=()=>document.querySelector("#offlineModal").classList.remove("open"));

document.querySelector("#menuBtn").onclick=()=>document.querySelector("#mobileMenu").classList.toggle("open");

renderProducts();renderCart();
