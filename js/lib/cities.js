/* ============================================================
   cities.js — City-of-birth autocomplete.

   Uses Open-Meteo's geocoding API (free, no API key, CORS-enabled).
   Critically captures the COUNTRY, since many cities share a name
   across different countries (e.g. Wanaka NZ vs. Wellington NZ/US/etc).
   ============================================================ */

const ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

/**
 * Wire async city autocomplete onto a text input.
 * @param {HTMLInputElement} input      visible "City of birth" input
 * @param {HTMLInputElement} countryEl  hidden input to receive the country
 */
export function attachCityAutocomplete(input, countryEl) {
  if (!input) return;

  const menu = document.createElement("div");
  menu.className = "city-suggest";
  menu.style.cssText =
    "position:absolute;left:0;right:0;top:100%;z-index:50;background:var(--card,#fff);" +
    "border:1px solid var(--border,#e3ddd0);border-radius:10px;margin-top:4px;overflow:hidden;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.12);display:none;max-height:240px;overflow-y:auto";
  input.insertAdjacentElement("afterend", menu);

  let timer = null;
  let lastQuery = "";

  const close = () => { menu.style.display = "none"; menu.innerHTML = ""; };

  const render = (results) => {
    if (!results.length) { close(); return; }
    menu.innerHTML = results.map((r, i) => {
      const parts = [r.name, r.admin1, r.country].filter(Boolean);
      const label = parts.join(", ");
      return `<div class="city-opt" data-i="${i}" role="option"
        style="padding:9px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--border,#eee)">
        ${escapeHtml(r.name)}<span style="color:var(--muted,#888)"> · ${escapeHtml([r.admin1, r.country].filter(Boolean).join(", "))}</span>
      </div>`;
    }).join("");
    menu.style.display = "block";
    menu.querySelectorAll(".city-opt").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus / prevent blur before click
        const r = results[+el.dataset.i];
        const label = [r.name, r.country].filter(Boolean).join(", ");
        input.value = label;
        if (countryEl) countryEl.value = r.country || "";
        input.dataset.lat = r.latitude ?? "";
        input.dataset.lon = r.longitude ?? "";
        close();
      });
      el.addEventListener("mouseenter", () => {
        menu.querySelectorAll(".city-opt").forEach(o => o.style.background = "");
        el.style.background = "var(--card-elev,#f6f1e7)";
      });
    });
  };

  const search = async (q) => {
    try {
      const url = `${ENDPOINT}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) return close();
      const data = await res.json();
      if (q !== lastQuery) return; // a newer keystroke superseded this
      render(Array.isArray(data.results) ? data.results : []);
    } catch {
      close();
    }
  };

  input.addEventListener("input", () => {
    const q = input.value.trim();
    if (countryEl) countryEl.value = ""; // typing invalidates a prior pick
    lastQuery = q;
    clearTimeout(timer);
    if (q.length < 2) { close(); return; }
    timer = setTimeout(() => search(q), 220);
  });

  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}

/**
 * Richer location autocomplete that hands back structured fields.
 * @param {HTMLInputElement} input
 * @param {(loc:{display:string,city:string,region:string,country:string,postcode:string,lat:number|null,lon:number|null})=>void} onPick
 */
export function attachLocationAutocomplete(input, onPick) {
  if (!input) return;
  // Clean up any orphaned popovers from a previous render of this view.
  document.querySelectorAll(".city-suggest.loc-pop").forEach(m => {
    if (!m._owner || !document.body.contains(m._owner)) m.remove();
  });

  // Rendered on <body> with fixed positioning, so no accordion/overflow/stacking
  // context can clip or hide it.
  const menu = document.createElement("div");
  menu.className = "city-suggest loc-pop";
  menu._owner = input;
  menu.style.cssText =
    "position:fixed;z-index:9999;background:var(--card,#fff);" +
    "border:1px solid var(--border,#e3ddd0);border-radius:10px;overflow-y:auto;max-height:240px;" +
    "box-shadow:0 10px 28px rgba(0,0,0,.16);display:none";
  document.body.appendChild(menu);

  let timer = null, lastQuery = "";
  const place = () => {
    const r = input.getBoundingClientRect();
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 4) + "px";
    menu.style.width = r.width + "px";
  };
  const close = () => { menu.style.display = "none"; menu.innerHTML = ""; };

  const render = (results) => {
    if (!results.length) { close(); return; }
    menu.innerHTML = results.map((r, i) =>
      `<div class="city-opt" data-i="${i}" role="option"
         style="padding:9px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--border,#eee)">
        ${escapeHtml(r.name)}<span style="color:var(--muted,#888)"> · ${escapeHtml([r.admin1, r.country].filter(Boolean).join(", "))}</span>
       </div>`).join("");
    place();
    menu.style.display = "block";
    menu.querySelectorAll(".city-opt").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const r = results[+el.dataset.i];
        const display = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
        input.value = display;
        onPick && onPick({
          display,
          city: r.name || "",
          region: r.admin1 || "",
          country: r.country || "",
          postcode: Array.isArray(r.postcodes) ? (r.postcodes[0] || "") : "",
          lat: r.latitude ?? null,
          lon: r.longitude ?? null,
        });
        close();
      });
      el.addEventListener("mouseenter", () => {
        menu.querySelectorAll(".city-opt").forEach(o => o.style.background = "");
        el.style.background = "var(--card-elev,#f6f1e7)";
      });
    });
  };

  const search = async (q) => {
    try {
      const res = await fetch(`${ENDPOINT}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
      if (!res.ok) return close();
      const data = await res.json();
      if (q !== lastQuery) return;
      render(Array.isArray(data.results) ? data.results : []);
    } catch { close(); }
  };

  input.addEventListener("input", () => {
    const q = input.value.trim();
    lastQuery = q;
    clearTimeout(timer);
    if (q.length < 2) { close(); return; }
    timer = setTimeout(() => search(q), 220);
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  // Keep the fixed popover aligned (or dismiss) as the page moves.
  window.addEventListener("scroll", () => { if (menu.style.display === "block") place(); }, true);
  window.addEventListener("resize", () => { if (menu.style.display === "block") place(); });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
