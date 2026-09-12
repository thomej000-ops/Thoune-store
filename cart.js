const KEY = "thoune-cart-v2";

export function loadCart(){
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
export function saveCart(cart){ localStorage.setItem(KEY, JSON.stringify(cart)); }

export function addToCart(product){
  const cart = loadCart();
  const found = cart.find(x => x.id === product.id);
  if(found) found.qty += 1;
  else cart.push({id:product.id,name:product.name,price:Number(product.price),image:product.image || "",qty:1});
  saveCart(cart);
  return cart;
}
export function changeQty(id, delta){
  const cart = loadCart();
  const item = cart.find(x => x.id === id);
  if(!item) return cart;
  item.qty += delta;
  const next = cart.filter(x => x.qty > 0);
  saveCart(next);
  return next;
}
export function removeFromCart(id){
  const next = loadCart().filter(x => x.id !== id);
  saveCart(next);
  return next;
}
export function clearCart(){ saveCart([]); }
export function cartCount(cart=loadCart()){ return cart.reduce((sum,x)=>sum+x.qty,0); }
export function cartTotal(cart=loadCart()){ return cart.reduce((sum,x)=>sum+(x.price*x.qty),0); }

export function orderText(cart=loadCart()){
  const lines = cart.map(x => `• ${x.name} ×${x.qty} — ${money(x.price*x.qty)}`);
  return `📦 Pedido — Thoune Store\\n\\n${lines.join("\\n")}\\n\\n💰 Total: ${money(cartTotal(cart))}`;
}
export function money(value){
  return Number(value).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
