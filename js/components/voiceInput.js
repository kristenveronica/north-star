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
  let baseValue = "";     // field content when recording began (typed text is preserved)
  let dictatedRaw = "";   // raw recognised speech for THIS session
  let interim = "";

  const start = () => {
    try {
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || "en-US";

      baseValue = el.value || "";
      dictatedRaw = "";
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
        if (finalText) dictatedRaw = (dictatedRaw + " " + finalText).replace(/\s+/g, " ").trim();
        const formatted = formatDictation(dictatedRaw);
        // Show formatted speech so far, with the still-forming interim words trailing.
        const live = interimText ? (formatted ? formatted + " " : "") + interimText.trim() : formatted;
        el.value = joinParts(baseValue, live);
        el.dispatchEvent(new Event("input", { bubbles: true }));
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
        // Finalize: drop any trailing interim, keep the cleanly formatted dictation.
        el.value = joinParts(baseValue, formatDictation(dictatedRaw)).trim();
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

/* ---- Dictation intelligence (client-side, no server) --------------------
   The Web Speech API returns raw, unpunctuated, lowercase text. We add the
   intelligence dictation tools expect: spoken punctuation + line commands,
   sentence capitalisation, "I", and tidy spacing. Said-aloud commands like
   "period", "comma", "question mark", "new line", "new paragraph" become the
   actual punctuation / breaks. */
function formatDictation(raw) {
  if (!raw) return "";
  let s = " " + raw.toLowerCase() + " ";
  // Line breaks first (so they win over sentence spacing).
  s = s.replace(/\s+new paragraph\s+/g, "\n\n")
       .replace(/\s+(new line|next line|line break)\s+/g, "\n");
  // Spoken punctuation → symbols (kept padded; spacing is normalised below).
  s = s.replace(/\s+(full stop|period)\s+/g, ". ")
       .replace(/\s+comma\s+/g, ", ")
       .replace(/\s+question mark\s+/g, "? ")
       .replace(/\s+exclamation (mark|point)\s+/g, "! ")
       .replace(/\s+semi[\s-]?colon\s+/g, "; ")
       .replace(/\s+colon\s+/g, ": ")
       .replace(/\s+(open paren|open parenthesis|open bracket)\s+/g, " (")
       .replace(/\s+(close paren|close parenthesis|close bracket)\s+/g, ") ")
       .replace(/\s+(dash|hyphen)\s+/g, " - ");
  // Tidy spacing: none before punctuation, single spaces, clean around newlines.
  s = s.replace(/[ \t]+([.,!?;:)])/g, "$1")
       .replace(/([(])[ \t]+/g, "$1")
       .replace(/[ \t]{2,}/g, " ")
       .replace(/[ \t]*\n[ \t]*/g, "\n")
       .replace(/\n{3,}/g, "\n\n")
       .trim();
  // Capitalise sentence starts (start of text, after . ! ?, after a newline) + "I".
  s = s.replace(/(^|[.!?]\s+|\n+)([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
  s = s.replace(/\bi\b/g, "I").replace(/\bi'/g, "I'");
  return s;
}

/* Join already-typed text with the formatted dictation, with sensible spacing. */
function joinParts(base, dictated) {
  if (!base) return dictated;
  if (!dictated) return base;
  const sep = /\s$/.test(base) || /^\n/.test(dictated) ? "" : " ";
  return base + sep + dictated;
}

function autoGrow(el, max = 400) {
  el.style.height = "auto";
  if (el.scrollHeight > max) {
    el.style.height = max + "px";
    el.style.overflowY = "auto";
  } else {
    el.style.height = (el.scrollHeight + 4) + "px";
    el.style.overflowY = "hidden";
  }
}

/* Convenience: a "big voice button" for kid reflection mode. */
export function attachBigVoice(el, onStopText) {
  if (!IS_SUPPORTED) return null;
  attachVoice(el);
  return el;
}

export const isVoiceSupported = () => IS_SUPPORTED;
