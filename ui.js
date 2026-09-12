import {addToCart, changeQty, removeFromCart, cartCount, cartTotal, money} from "./cart.js";

export function toast(message){
  const region = document.querySelector("#toast-region");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  region.appendChild(el);
  setTimeout(()=>el.remove(), 2400);
}

export function renderProducts(products){
  const grid = document.querySelector("#product-grid");
  const empty = document.querySelector("#empty-state");
  document.querySelector("#catalog-count").textContent = `${products.length} ${products.length === 1 ? "item" : "itens"}`;
  grid.innerHTML = "";
  empty.classList.toggle("hidden", products.length !== 0);

  for(const p of products){
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image">
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<div class="placeholder">🔨</div>`}
        <button class="favorite" aria-label="Favoritar ${escapeHtml(p.name)}" data-fav="${p.id}">♡</button>
      </div>
      <div class="product-info">
        <span class="rarity">${escapeHtml(p.rarity)}</span>
        <h3 class="product-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
        <div class="product-bottom">
          <div><div class="price">${money(p.price)}</div><div class="stock">${p.stock > 0 ? `${p.stock} disponíveis` : "Sem estoque"}</div></div>
          <button class="add-button" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>${p.stock > 0 ? "Adicionar" : "Esgotado"}</button>
        </div>
      </div>`;
    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-add]").forEach(btn => btn.addEventListener("click", ()=>{
    const product = products.find(p=>p.id===btn.dataset.add);
    addToCart(product);
    updateCartBadge();
    btn.animate([{transform:"scale(1)"},{transform:"scale(.94)"},{transform:"scale(1)"}],{duration:240});
    toast(`${product.name} foi adicionado ao carrinho.`);
  }));

  grid.querySelectorAll("[data-fav]").forEach(btn => {
    const key = `thoune-fav-${btn.dataset.fav}`;
    btn.classList.toggle("active", localStorage.getItem(key)==="1");
    btn.textContent = btn.classList.contains("active") ? "♥" : "♡";
    btn.addEventListener("click",()=>{
      const active = localStorage.getItem(key)==="1";
      localStorage.setItem(key, active ? "0" : "1");
      btn.classList.toggle("active", !active);
      btn.classList.add("pop");
      btn.textContent = !active ? "♥" : "♡";
      setTimeout(()=>btn.classList.remove("pop"),350);
    });
  });
}

export function renderCart(cart){
  const list = document.querySelector("#cart-items");
  const empty = document.querySelector("#cart-empty");
  list.innerHTML = "";
  empty.style.display = cart.length ? "none" : "grid";

  for(const item of cart){
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : `<div class="cart-thumb">🔨</div>`}
      <div>
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">${money(item.price)} cada</div>
        <div class="qty">
          <button data-minus="${item.id}">−</button><span>${item.qty}</span><button data-plus="${item.id}">+</button>
        </div>
      </div>
      <button class="remove" data-remove="${item.id}" aria-label="Remover">×</button>`;
    list.appendChild(row);
  }
  list.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>renderCart(changeQty(b.dataset.minus,-1)));
  list.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>renderCart(changeQty(b.dataset.plus,1)));
  list.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>renderCart(removeFromCart(b.dataset.remove)));

  document.querySelector("#cart-total").textContent = money(cartTotal(cart));
  updateCartBadge(cart);
}

export function updateCartBadge(cart){
  document.querySelector("#cart-count").textContent = cartCount(cart);
}

function escapeHtml(value=""){
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
