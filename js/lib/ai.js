/* ============================================================
   ai.js — Frontend gateway to the North Star AI edge function.
   The function runs server-side and holds the Claude API key;
   this just invokes it with the signed-in parent's session.
   ============================================================ */

import { supabase } from "./supabase.js";

async function invokeAi(action, payload) {
  const { data, error } = await supabase.functions.invoke("ai", {
    body: { action, payload },
  });
  if (error) {
    // Surface the function's JSON error message when present.
    let msg = error.message || "AI request failed";
    try {
      const body = await error.context?.json?.();
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (data?.usage) console.log(`[ai] ${action} usage:`, data.usage);
  return data.data;
}

/** Suggest 3 family core words + acronyms from their vision answers. */
export function aiSuggestCoreWord(vision, currentWord = "") {
  return invokeAi("suggest-core-word", { vision, currentWord });
}

/** Suggest a short, friendly set of focus ideas (interests/strengths/grow/capabilities) for a child. */
export function aiSuggestFocus(family, child) {
  return invokeAi("suggest-focus", { family, child });
}

/**
 * Suggest a piece of the Family North Star from the deeper-vision answers.
 * kind = "outcomes" -> { outcomes: string[] } ; "motto"|"mission" -> { value: string }.
 */
export function aiSuggestVision(kind, vision, family = {}) {
  return invokeAi("suggest-vision", { kind, vision, family });
}

/** Tidy ONLY the formatting of a parent's free-text answer (never rewrites meaning). */
export function aiTidyText(text) {
  return invokeAi("tidy-text", { text });
}

/** Generate one personalized project for a child. */
export function aiGenerateProject(family, child, constraints = {}) {
  return invokeAi("generate-project", { family, child, constraints });
}

/** Reflect on a child's quarter AGAINST the family's own vision (for growth reports).
    Returns { reflection:[…], strengths:[{title,detail}], opportunity:[{focus,why}] }. */
export function aiGrowthReflection(family, child, summary) {
  return invokeAi("growth-reflection", { family, child, summary });
}

/** Which Core Word qualities were GENUINELY lived in recent work (sincere or empty).
    Returns { connections:[{ letter, quality, evidence }] }. */
export function aiCoreWordLiving(family, summary) {
  return invokeAi("coreword-living", { family, summary });
}
