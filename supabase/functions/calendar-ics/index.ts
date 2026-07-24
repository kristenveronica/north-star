// ============================================================================
// calendar-ics — fetch + parse the family's subscribed external calendars.
//
// Browsers can't fetch a third-party .ics directly (CORS), and the feed URL is
// a secret we don't want in page HTML. So the client asks this function for a
// date window; we read the caller's family feeds (service role), fetch each ICS
// server-side, parse the VEVENTs, and return normalized events for overlay.
//
// Read-only. We never write to the external calendar. Authorization: the caller
// must be an ACTIVE member of the family whose feeds we return.
// ============================================================================

import { resolveCaller, isActiveMember, admin } from "../_shared/authz.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// webcal:// is just http(s) for iCloud/Apple; normalize it so fetch works.
function normalizeUrl(u: string): string {
  const t = (u || "").trim();
  if (/^webcal:\/\//i.test(t)) return t.replace(/^webcal:\/\//i, "https://");
  return t;
}

// ---- ICS parsing -----------------------------------------------------------

// RFC 5545 line folding: a CRLF followed by a space/tab continues the line.
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

// Unescape TEXT values: \n \, \; \\
function unescapeText(v: string): string {
  return (v || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// Parse a DTSTART/DTEND value (+ its params) into { ms, allDay }.
// Handles: 20260724 (VALUE=DATE, all-day), 20260724T090000 (local/floating),
// 20260724T090000Z (UTC). TZID is treated as local (best-effort; no tz db).
function parseIcsDate(rawKey: string, value: string): { ms: number; allDay: boolean } | null {
  const isDateOnly = /VALUE=DATE(?![-])/i.test(rawKey) || /^\d{8}$/.test(value);
  const v = (value || "").trim();
  const dOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dOnly) {
    const [, y, mo, d] = dOnly;
    // Anchor all-day at local midday to avoid a timezone day-shift on display.
    return { ms: new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0).getTime(), allDay: true };
  }
  const dt = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dt) {
    const [, y, mo, d, h, mi, s, z] = dt;
    const ms = z
      ? Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
      : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
    return { ms, allDay: isDateOnly };
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : { ms: t, allDay: isDateOnly };
}

type IcsEvent = { uid: string; title: string; location: string; start: number; end: number | null; allDay: boolean; recurring: boolean };

function parseVevents(icsText: string): IcsEvent[] {
  const lines = unfold(icsText);
  const events: IcsEvent[] = [];
  let cur: Record<string, { key: string; val: string }> | null = null;

  for (const line of lines) {
    const up = line.toUpperCase();
    if (up.startsWith("BEGIN:VEVENT")) { cur = {}; continue; }
    if (up.startsWith("END:VEVENT")) {
      if (cur) {
        const get = (k: string) => cur![k];
        const dtstart = get("DTSTART");
        const dtend = get("DTEND");
        const start = dtstart ? parseIcsDate(dtstart.key, dtstart.val) : null;
        if (start) {
          const end = dtend ? parseIcsDate(dtend.key, dtend.val) : null;
          events.push({
            uid: (get("UID")?.val || "").trim(),
            title: unescapeText(get("SUMMARY")?.val || "").trim() || "(untitled)",
            location: unescapeText(get("LOCATION")?.val || "").trim(),
            start: start.ms,
            end: end?.ms ?? null,
            allDay: start.allDay,
            recurring: !!get("RRULE"),
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);          // e.g. DTSTART;TZID=...;VALUE=DATE
    const val = line.slice(idx + 1);
    const name = rawKey.split(";")[0].toUpperCase();
    // keep the first occurrence of each prop (DTSTART/SUMMARY/…)
    if (!cur[name]) cur[name] = { key: rawKey, val };
  }
  return events;
}

async function fetchIcs(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "NorthStar-Calendar/1.0", "Accept": "text/calendar, text/plain, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("not an iCalendar feed");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const caller = await resolveCaller(req);
    if (!isActiveMember(caller)) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const from = Number(body.from) || (Date.now() - 31 * 864e5);
    const to = Number(body.to) || (Date.now() + 120 * 864e5);

    const { data: feeds } = await admin
      .from("calendar_feeds")
      .select("id, label, url, color")
      .eq("family_id", caller!.familyId);

    if (!feeds || feeds.length === 0) return json({ events: [], feeds: [] });

    const out: any[] = [];
    const feedStatus: any[] = [];

    await Promise.all(feeds.map(async (f) => {
      try {
        const ics = await fetchIcs(normalizeUrl(f.url));
        const parsed = parseVevents(ics).filter(e => e.start <= to && (e.end ?? e.start) >= from);
        for (const e of parsed) {
          out.push({
            feedId: f.id, feedLabel: f.label, color: f.color || null,
            uid: e.uid, title: e.title, location: e.location,
            start: new Date(e.start).toISOString(),
            end: e.end ? new Date(e.end).toISOString() : null,
            allDay: e.allDay, recurring: e.recurring,
          });
        }
        feedStatus.push({ id: f.id, label: f.label, count: parsed.length, error: null });
        await admin.from("calendar_feeds").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", f.id);
      } catch (err) {
        const msg = String((err as Error).message || err).slice(0, 300);
        feedStatus.push({ id: f.id, label: f.label, count: 0, error: msg });
        await admin.from("calendar_feeds").update({ last_error: msg }).eq("id", f.id);
      }
    }));

    return json({ events: out, feeds: feedStatus });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
