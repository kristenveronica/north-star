/* ============================================================
   cart.js — Mock shopping cart + checkout.
   ============================================================ */

import { getState, removeFromCart, update } from "../store.js";
import { esc, fmtMoney, toast, icon, openModal } from "../components/ui.js";
import { navigate } from "../router.js";
import { rerender } from "../app.js";

export function renderCart(container) {
  const s = getState();
  const items = s.cart.map(c => ({
    cart: c,
    material: s.materials.find(m => m.id === c.materialId),
  })).filter(x => x.material);

  const subtotal = items.reduce((acc, it) => acc + (it.material.estimatedPrice * it.cart.quantity), 0);
  const shipping = items.length ? 9.95 : 0;
  const total = subtotal + shipping;

  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Mock Cart</h1>
        <div class="sub">Approved materials live here. Checkout integration coming later — Stripe, Shopify, Amazon affiliate, etc.</div>
      </div>
      <button class="btn" data-back>← Back to materials</button>
    </div>

    ${items.length === 0
      ? `<div class="empty"><div class="emoji">🛒</div><h3>Your cart is empty</h3><p>Approve some material suggestions and they'll appear here.</p><button class="btn btn-primary mt-2" data-back>Browse materials</button></div>`
      : `
        <div class="grid" style="grid-template-columns: 2fr 1fr; gap:18px">
          <div class="stack">
            ${items.map(it => cartItem(it)).join("")}
          </div>
          <div class="card" style="position:sticky;top:24px;height:fit-content">
            <h3 class="mb-2">Order summary</h3>
            <div class="row-between"><span>Subtotal</span><span class="fw-700">${fmtMoney(subtotal)}</span></div>
            <div class="row-between"><span>Shipping (estimated)</span><span class="fw-700">${fmtMoney(shipping)}</span></div>
            <div class="divider"></div>
            <div class="row-between"><span class="fw-700">Total</span><span class="fw-700" style="font-size:20px">${fmtMoney(total)}</span></div>
            <button class="btn btn-primary btn-lg mt-2" id="checkout" style="width:100%;justify-content:center">${icon("cart")} Proceed to checkout</button>
            <div class="small text-muted center mt-1">Checkout integration coming soon.</div>
          </div>
        </div>
      `}
  `;

  container.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => navigate("/materials")));
  container.querySelectorAll("[data-remove]").forEach(b => {
    b.addEventListener("click", () => { removeFromCart(b.dataset.remove); toast("Removed from cart"); rerender(); });
  });
  container.querySelectorAll("[data-qty]").forEach(inp => {
    inp.addEventListener("change", () => {
      const v = Math.max(1, parseInt(inp.value, 10) || 1);
      update(state => {
        const c = state.cart.find(c => c.id === inp.dataset.qty);
        if (c) c.quantity = v;
      });
      rerender();
    });
  });
  const checkout = container.querySelector("#checkout");
  if (checkout) checkout.addEventListener("click", openCheckoutModal);
}

function cartItem({ cart, material }) {
  return `
    <div class="card">
      <div class="row" style="gap:14px;align-items:flex-start">
        <div style="width:48px;height:48px;border-radius:var(--r-md);background:var(--bg-2);display:grid;place-items:center;font-size:22px">${material.buyOrDIY === "buy" ? "📦" : "🧰"}</div>
        <div style="flex:1">
          <div class="fw-700">${esc(material.name)}</div>
          <div class="small text-muted">${esc(material.category)} · ${material.buyOrDIY === "buy" ? "ready-made" : "DIY"}</div>
        </div>
        <div class="stack-tight" style="align-items:flex-end">
          <span class="fw-700">${fmtMoney(material.estimatedPrice * cart.quantity)}</span>
          <input class="input" type="number" min="1" max="20" value="${cart.quantity}" data-qty="${cart.id}" style="width:72px;text-align:center"/>
        </div>
        <button class="btn btn-ghost btn-sm" data-remove="${material.id}">Remove</button>
      </div>
    </div>
  `;
}

function openCheckoutModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="text-muted">For the MVP this is a mock checkout. The interface is real; the payment isn't.</p>
    <div class="field"><label>Full name</label><input class="input" id="co-name" value="${esc(getState().family?.parentName || "")}"/></div>
    <div class="field"><label>Shipping address</label><textarea class="textarea" id="co-addr" placeholder="Street, suburb, postcode"></textarea></div>
    <div class="field"><label>Email</label><input class="input" id="co-email" type="email" placeholder="you@example.com"/></div>
    <div class="card mt-2" style="background:var(--card-elev)">
      <h4>What happens next</h4>
      <ul class="text-muted small" style="padding-left:18px;margin:6px 0">
        <li>This MVP will not charge anything.</li>
        <li>Later this connects to affiliate links / Shopify / Amazon / Stripe / partner suppliers.</li>
        <li>For now, the order is marked "pending" so you can see how the flow feels.</li>
      </ul>
    </div>
  `;
  const foot = document.createElement("div");
  foot.style.cssText = "display:flex;gap:10px;justify-content:flex-end;width:100%";
  foot.innerHTML = `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="co-submit">Place mock order</button>`;
  const m = openModal({ title: "Checkout (mock)", body, footer: foot });
  foot.querySelector("#co-submit").addEventListener("click", () => {
    toast("Mock order placed — checkout integration coming soon.", { type: "success", duration: 3500 });
    m.close();
  });
}
