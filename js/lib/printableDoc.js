/* ============================================================
   printableDoc.js — renders an AI-generated worksheet to a clean,
   print-ready page in a new tab (print / save-as-PDF from there).

   Split so the window opens SYNCHRONOUSLY inside the click gesture
   (avoids the pop-up blocker) while the AI call runs; the result is
   written into the already-open window when it returns.
   ============================================================ */

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SHELL_HEAD = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --ink:#1a2233; --soft:#5a6478; --gold:#b07d25; --line:#c9cdd6; }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; background:#f4f1ea; color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .sheet { max-width:760px; margin:0 auto; background:#fff; padding:44px 52px 60px;
    box-shadow:0 6px 30px rgba(20,26,40,.12); }
  .brand { font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:var(--gold); font-weight:700; }
  .brand::before { content:"\\2726 "; }
  h1 { font-family:"Iowan Old Style",Georgia,"Times New Roman",serif; font-weight:600;
    font-size:30px; line-height:1.1; margin:8px 0 4px; }
  .sub { color:var(--soft); font-size:14px; margin:0 0 6px; }
  .materials { font-size:13px; color:var(--ink); background:#f4eee1; border-radius:8px;
    padding:10px 14px; margin:18px 0 8px; }
  section.ws { margin-top:26px; page-break-inside:avoid; }
  section.ws h2 { font-family:"Iowan Old Style",Georgia,serif; font-size:19px; margin:0 0 4px;
    border-bottom:2px solid var(--gold); padding-bottom:4px; display:inline-block; }
  .ins { color:var(--soft); font-size:14px; margin:6px 0 10px; }
  ol.items { margin:0 0 8px; padding-left:26px; }
  ol.items li { margin:0 0 12px; font-size:15px; line-height:1.5; }
  .wl { height:1.9em; border-bottom:1px solid var(--line); margin:6px 0; }
  section.ext { margin-top:26px; background:#fbf7ec; border-left:3px solid var(--gold);
    padding:14px 18px; border-radius:0 8px 8px 0; page-break-inside:avoid; }
  section.ext h2 { font-family:"Iowan Old Style",Georgia,serif; font-size:16px; margin:0 0 4px; }
  footer { margin-top:34px; border-top:1px solid var(--line); padding-top:14px; }
  .pn { font-size:13px; color:var(--ink); }
  .fine { font-size:11px; color:var(--soft); margin-top:8px; }
  .bar { position:sticky; top:0; background:var(--ink); color:#fff; padding:10px 16px;
    display:flex; justify-content:space-between; align-items:center; font-size:14px; }
  .bar button { font:inherit; font-weight:600; background:var(--gold); color:#1a1206; border:0;
    border-radius:8px; padding:8px 16px; cursor:pointer; }
  .loading { text-align:center; padding:80px 20px; color:var(--soft); }
  .loading .spin { width:34px; height:34px; border:3px solid #e6e2d6; border-top-color:var(--gold);
    border-radius:50%; margin:0 auto 16px; animation:sp 0.8s linear infinite; }
  @keyframes sp { to { transform:rotate(360deg); } }
  @media print {
    body { background:#fff; }
    .sheet { box-shadow:none; max-width:none; margin:0; padding:0 8px; }
    .bar { display:none; }
    @page { margin:16mm; }
  }
</style></head><body>`;

/** Open a blank print window immediately (inside the click) with a loading state. */
export function openPrintableWindow() {
  const w = window.open("", "_blank");
  if (!w) return null;
  w.document.write(`${SHELL_HEAD}<div class="sheet"><div class="loading"><div class="spin"></div>Creating a worksheet tailored to your child…</div></div></body></html>`);
  w.document.close();
  return w;
}

/** Write the finished worksheet into an already-open window. */
export function writeWorksheet(win, doc, child) {
  if (!win || win.closed) return;
  const linesOf = (n) => Array.from({ length: Math.max(0, Math.min(12, n | 0)) }, () => `<div class="wl"></div>`).join("");
  const sections = (doc.sections || []).map((sec) => `
    <section class="ws">
      <h2>${esc(sec.heading)}</h2>
      ${sec.instructions ? `<p class="ins">${esc(sec.instructions)}</p>` : ""}
      ${(sec.items || []).length ? `<ol class="items">${sec.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ol>` : ""}
      ${linesOf(sec.writingLines)}
    </section>`).join("");
  const html = `${SHELL_HEAD}
    <div class="bar"><span>${esc(doc.title || "Worksheet")}</span><button onclick="window.print()">Print / Save as PDF</button></div>
    <div class="sheet">
      <div class="brand">North Star</div>
      <h1>${esc(doc.title || "Worksheet")}</h1>
      <div class="sub">${esc(doc.subtitle || (child ? `For ${child.name}` : ""))}</div>
      ${(doc.materials || []).length ? `<div class="materials"><strong>You'll need:</strong> ${doc.materials.map(esc).join(" · ")}</div>` : ""}
      ${sections}
      ${doc.extension ? `<section class="ext"><h2>Extra challenge</h2><p>${esc(doc.extension)}</p></section>` : ""}
      <footer>
        ${doc.parentNote ? `<div class="pn"><strong>For the parent:</strong> ${esc(doc.parentNote)}</div>` : ""}
        <div class="fine">Generated by North Star${child ? ` for ${esc(child.name)}` : ""}. Tailored to age, interests, learning style and capability domains.</div>
      </footer>
    </div></body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

/** Show a friendly error inside the open window (or note it's closed). */
export function writeError(win, message) {
  if (!win || win.closed) return;
  win.document.open();
  win.document.write(`${SHELL_HEAD}<div class="sheet"><div class="loading">${esc(message || "Couldn't create the worksheet. Please try again.")}<br><br><button onclick="window.close()" style="font:inherit;background:#b07d25;color:#1a1206;border:0;border-radius:8px;padding:8px 16px;cursor:pointer">Close</button></div></div></body></html>`);
  win.document.close();
}
