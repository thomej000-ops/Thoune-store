import {
  addToCart,
  changeQty,
  removeFromCart,
  cartCount,
  cartTotal,
  money
} from "./cart.js";


/* =========================================================
   TOAST
========================================================= */

export function toast(message) {
  const region =
    document.querySelector(
      "#toast-region"
    );

  if (!region) return;

  const el =
    document.createElement("div");

  el.className =
    "toast";

  el.textContent =
    message;

  region.appendChild(el);

  setTimeout(
    () => el.remove(),
    2400
  );
}


/* =========================================================
   PRODUTOS
========================================================= */

export function renderProducts(products = []) {
  const grid =
    document.querySelector(
      "#product-grid"
    );

  const empty =
    document.querySelector(
      "#empty-state"
    );

  const count =
    document.querySelector(
      "#catalog-count"
    );


  if (!grid || !empty) {
    console.warn(
      "Elementos do catálogo não encontrados."
    );

    return;
  }


  /* ---------- Contador ---------- */

  if (count) {
    count.textContent =
      `${products.length} ${
        products.length === 1
          ? "item"
          : "itens"
      }`;
  }


  /* ---------- Limpa catálogo ---------- */

  grid.innerHTML = "";


  /* ---------- Estado vazio ---------- */

  empty.classList.toggle(
    "hidden",
    products.length !== 0
  );


  if (!products.length) {
    return;
  }


  /* =======================================================
     CARDS
  ======================================================= */

  for (const p of products) {
    const currentPrice =
      Number(p.price) || 0;

    const originalPrice =
      p.original_price != null
        ? Number(
            p.original_price
          ) || currentPrice
        : currentPrice;

    const hasDiscount =
      originalPrice >
      currentPrice;


    const stock =
      Number(p.stock) || 0;


    const productName =
      p.name ||
      "Produto";


    const card =
      document.createElement(
        "article"
      );

    card.className =
      "product-card";


    card.innerHTML = `
      <div class="product-image">

        ${
          p.image
            ? `
              <img
                src="${escapeHtml(
                  p.image
                )}"
                alt="${escapeHtml(
                  productName
                )}"
                loading="lazy"
              >
            `
            : `
              <div class="placeholder">
                🔨
              </div>
            `
        }

        <button
          type="button"
          class="favorite"
          aria-label="Favoritar ${escapeHtml(
            productName
          )}"
          data-fav="${escapeHtml(
            p.id
          )}"
        >♡</button>

      </div>

      <div class="product-info">

        <span class="rarity">
          ${escapeHtml(
            p.category || ""
          )}
        </span>

        <h3
          class="product-name"
          title="${escapeHtml(
            productName
          )}"
        >
          ${escapeHtml(
            productName
          )}
        </h3>

        <div class="product-bottom">

          <div>

            <div class="price">

              ${
                hasDiscount
                  ? `
                    <span class="price-old">
                      ${money(
                        originalPrice
                      )}
                    </span>

                    <span class="price-current">
                      ${money(
                        currentPrice
                      )}
                    </span>
                  `
                  : money(
                      currentPrice
                    )
              }

            </div>

            <div class="stock">

              ${
                stock > 0
                  ? `${stock} disponíveis`
                  : "Sem estoque"
              }

            </div>

          </div>

          <button
            type="button"
            class="add-button"
            data-add="${escapeHtml(
              p.id
            )}"
            ${stock <= 0
              ? "disabled"
              : ""}
          >
            ${
              stock > 0
                ? "Adicionar"
                : "Esgotado"
            }
          </button>

        </div>

      </div>
    `;


    grid.appendChild(
      card
    );
  }


  /* =======================================================
     ADICIONAR AO CARRINHO
  ======================================================= */

  grid
    .querySelectorAll(
      "[data-add]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const product =
              products.find(
                p =>
                  String(p.id) ===
                  String(
                    button.dataset.add
                  )
              );


            if (
              !product ||
              Number(product.stock) <= 0
            ) {
              return;
            }


            addToCart(
              product
            );


            updateCartBadge();


            button.animate(
              [
                {
                  transform:
                    "scale(1)"
                },

                {
                  transform:
                    "scale(.94)"
                },

                {
                  transform:
                    "scale(1)"
                }
              ],
              {
                duration: 240
              }
            );


            toast(
              `${product.name} foi adicionado ao carrinho.`
            );
          }
        );
      }
    );


  /* =======================================================
     FAVORITOS
  ======================================================= */

  grid
    .querySelectorAll(
      "[data-fav]"
    )
    .forEach(
      button => {
        const key =
          `thoune-fav-${button.dataset.fav}`;


        const isActive =
          localStorage.getItem(
            key
          ) === "1";


        button.classList.toggle(
          "active",
          isActive
        );


        button.textContent =
          isActive
            ? "♥"
            : "♡";


        button.addEventListener(
          "click",
          () => {
            const active =
              localStorage.getItem(
                key
              ) === "1";


            localStorage.setItem(
              key,
              active
                ? "0"
                : "1"
            );


            button.classList.toggle(
              "active",
              !active
            );


            button.textContent =
              !active
                ? "♥"
                : "♡";


            button.classList.add(
              "pop"
            );


            setTimeout(
              () =>
                button.classList.remove(
                  "pop"
                ),
              350
            );
          }
        );
      }
    );
}


/* =========================================================
   CARRINHO
========================================================= */

export function renderCart(
  cart = []
) {
  const list =
    document.querySelector(
      "#cart-items"
    );

  const empty =
    document.querySelector(
      "#cart-empty"
    );


  if (!list || !empty) {
    return;
  }


  list.innerHTML =
    "";


  /* ---------- Estado vazio ---------- */

  empty.style.display =
    cart.length
      ? "none"
      : "grid";


  /* =======================================================
     ITENS
  ======================================================= */

  for (const item of cart) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "cart-item";


    row.innerHTML = `
      ${
        item.image
          ? `
            <img
              src="${escapeHtml(
                item.image
              )}"
              alt="${escapeHtml(
                item.name || ""
              )}"
            >
          `
          : `
            <div class="cart-thumb">
              🔨
            </div>
          `
      }

      <div>

        <div class="cart-item-name">
          ${escapeHtml(
            item.name
          )}
        </div>

        <div class="cart-item-price">
          ${money(
            item.price
          )} cada
        </div>

        <div class="qty">

          <button
            type="button"
            data-minus="${escapeHtml(
              item.id
            )}"
            aria-label="Diminuir quantidade"
          >
            −
          </button>

          <span>
            ${item.qty}
          </span>

          <button
            type="button"
            data-plus="${escapeHtml(
              item.id
            )}"
            aria-label="Aumentar quantidade"
          >
            +
          </button>

        </div>

      </div>

      <button
        type="button"
        class="remove"
        data-remove="${escapeHtml(
          item.id
        )}"
        aria-label="Remover ${escapeHtml(
          item.name || "produto"
        )}"
      >
        ×
      </button>
    `;


    list.appendChild(
      row
    );
  }


  /* =======================================================
     DIMINUIR QUANTIDADE
  ======================================================= */

  list
    .querySelectorAll(
      "[data-minus]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const updatedCart =
              changeQty(
                button.dataset.minus,
                -1
              );


            renderCart(
              updatedCart
            );
          }
        );
      }
    );


  /* =======================================================
     AUMENTAR QUANTIDADE
  ======================================================= */

  list
    .querySelectorAll(
      "[data-plus]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const updatedCart =
              changeQty(
                button.dataset.plus,
                1
              );


            renderCart(
              updatedCart
            );
          }
        );
      }
    );


  /* =======================================================
     REMOVER
  ======================================================= */

  list
    .querySelectorAll(
      "[data-remove]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const updatedCart =
              removeFromCart(
                button.dataset.remove
              );


            renderCart(
              updatedCart
            );
          }
        );
      }
    );


  /* =======================================================
     TOTAL
  ======================================================= */

  const total =
    document.querySelector(
      "#cart-total"
    );


  if (total) {
    total.textContent =
      money(
        cartTotal(cart)
      );
  }


  /* =======================================================
     BADGE
  ======================================================= */

  updateCartBadge(
    cart
  );
}


/* =========================================================
   BADGE DO CARRINHO
========================================================= */

export function updateCartBadge(
  cart
) {
  const badge =
    document.querySelector(
      "#cart-count"
    );


  if (!badge) {
    return;
  }


  /*
    Quando nenhum carrinho é passado,
    carregamos o carrinho atual diretamente.
  */

  const currentCart =
    Array.isArray(cart)
      ? cart
      : [];


  badge.textContent =
    cartCount(
      currentCart
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value = ""
) {
  return String(
    value
  ).replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[
        character
      ]
  );
                        }
