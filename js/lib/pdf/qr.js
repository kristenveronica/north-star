/* ============================================================
   pdf/qr.js — lazy QR code generation (future-ready deep links).

   Returns a PNG data URL for embedding in the PDF. Non-critical: if the
   library can't load (offline), callers simply skip the QR.
   ============================================================ */

let _QR = null;
async function loadQR() {
  if (_QR) return _QR;
  const mod = await import("https://esm.sh/qrcode@1.5.4");
  _QR = mod.default || mod;
  return _QR;
}

export async function qrDataUrl(text, { size = 320 } = {}) {
  const QR = await loadQR();
  return QR.toDataURL(String(text), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#1c2028", light: "#ffffff" },   // ink on white — prints cleanly
  });
}
