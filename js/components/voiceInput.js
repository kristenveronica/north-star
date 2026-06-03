/* ============================================================
   voiceInput.js — Voice-First Experience (Layer 14A)
   Adds a microphone button beside any textarea/input that has
   data-voice. Uses the Web Speech API where supported.

   For MVP: stores transcript into the field. The recording
   timestamp is captured on the host element as data-voice-at.
   Audio file capture is intentionally not implemented for MVP.
   ============================================================ */

import { icon, toast } from "./ui.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_SUPPORTED = !!SR;

let _autoWired = false;

/** Auto-enhance every [data-voice] element under document. Watches for new ones. */
export function enableAutoVoice() {
  if (_autoWired) return;
  _autoWired = true;
  enhanceRoot(document);
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches?.("[data-voice]")) attachVoice(n);
        n.querySelectorAll?.("[data-voice]").forEach(attachVoice);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

export function enhanceRoot(root) {
  root.querySelectorAll?.("[data-voice]").forEach(attachVoice);
}

/* Attach a mic button next to a single element. Idempotent. */
export function attachVoice(el) {
  if (el.dataset.voiceWired === "1") return;
  el.dataset.voiceWired = "1";

  // Wrap field in .voice-field
  const wrap = document.createElement("div");
  wrap.className = "voice-field";
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);

  const label = el.dataset.voiceLabel || "Speak";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "voice-btn" + (IS_SUPPORTED ? "" : " unsupported");
  btn.title = IS_SUPPORTED ? `${label} (click to record)` : "Voice not supported in this browser — try Chrome or Safari";
  btn.innerHTML = icon("mic");
  wrap.appendChild(btn);

  if (!IS_SUPPORTED) {
    btn.addEventListener("click", () => {
      toast("Voice input isn't supported in this browser. Try Chrome or Safari.", { type: "warning", duration: 3500 });
    });
    return;
  }

  let recognition = null;
  let recording = false;
  let originalValue = "";
  let interim = "";

  const start = () => {
    try {
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";

      originalValue = el.value || "";
      interim = "";
      recording = true;
      btn.classList.add("recording");
      btn.innerHTML = icon("micFilled");
      btn.title = "Click to stop";

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interimText += r[0].transcript;
        }
        if (finalText) {
          originalValue = appendNicely(originalValue, finalText);
        }
        interim = interimText;
        el.value = appendNicely(originalValue, interim);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        // grow textarea if needed
        if (el.tagName === "TEXTAREA") autoGrow(el);
      };
      recognition.onerror = (e) => {
        if (e.error === "not-allowed") {
          toast("Microphone permission was denied. Allow it in the browser address bar.", { type: "warning", duration: 4000 });
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
          toast(`Voice error: ${e.error}`, { type: "warning" });
        }
      };
      recognition.onend = () => {
        recording = false;
        btn.classList.remove("recording");
        btn.innerHTML = icon("mic");
        btn.title = `${label} (click to record)`;
        el.dataset.voiceAt = new Date().toISOString();
        // Finalize with the last interim cleared
        el.value = originalValue.trim();
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };

      recognition.start();
      toast("Listening… speak naturally. Click again to stop.", { duration: 1800 });
    } catch (err) {
      recording = false;
      btn.classList.remove("recording");
      btn.innerHTML = icon("mic");
      toast("Could not start microphone — " + err.message, { type: "warning" });
    }
  };

  const stop = () => {
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
  };

  btn.addEventListener("click", () => {
    if (recording) stop(); else start();
  });
}

function appendNicely(prev, addition) {
  if (!addition) return prev;
  const sep = prev.length === 0 ? "" :
    /[\.!?,]\s*$/.test(prev) ? " " :
    /\s$/.test(prev) ? "" : " ";
  return prev + sep + addition.trim();
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(400, el.scrollHeight + 4) + "px";
}

/* Convenience: a "big voice button" for kid reflection mode. */
export function attachBigVoice(el, onStopText) {
  if (!IS_SUPPORTED) return null;
  attachVoice(el);
  return el;
}

export const isVoiceSupported = () => IS_SUPPORTED;
