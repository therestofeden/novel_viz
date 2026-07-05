// resolve-buy-link
// Given a {title, author}, returns the best "buy" URL for the requesting
// user's country. Prefers indie / smaller shops, Amazon as last resort.
//
// Design goals:
//   - <100ms p50 (no upstream calls when geo header is present)
//   - structured for affiliate tags later (vendor registry has affiliateParam)
//   - never throws to client; always returns *something* (Amazon.com fallback)
//
// Geo source priority:
//   1. cf-ipcountry  (Cloudflare; Supabase edge runtime in front of CF)
//   2. x-vercel-ip-country
//   3. x-country-code
//   4. accept-language (best-effort, last resort — no network)
//   5. "US"
//
// We deliberately do NOT call an external IP→geo API here: that adds
// 150–400ms and a dependency we don't need for country-level routing.


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Vendor = {
  key: string;            // stable id (used for affiliate tag lookup later)
  name: string;           // display name
  kind: "indie" | "chain" | "amazon";
  // Build a search URL for {title, author}. Keep it a *search* page — we
  // can't guarantee a deep PDP without an ISBN.
  build: (title: string, author: string, affiliateTag?: string) => string;
};

// --- Vendor catalogue ----------------------------------------------------
// Order inside each country list = preference order. Indies first, Amazon last.

const enc = (s: string) => encodeURIComponent(s.trim());
const q = (title: string, author: string) =>
  enc(`${title}${author && author !== "Unknown" ? " " + author : ""}`);

const BOOKSHOP_ORG: Vendor = {
  key: "bookshop_org",
  name: "Bookshop.org",
  kind: "indie",
  build: (t, a, tag) =>
    `https://bookshop.org/search?keywords=${q(t, a)}${tag ? `&aid=${enc(tag)}` : ""}`,
};

const BOOKSHOP_UK: Vendor = {
  key: "bookshop_uk",
  name: "Bookshop.org UK",
  kind: "indie",
  build: (t, a, tag) =>
    `https://uk.bookshop.org/search?keywords=${q(t, a)}${tag ? `&aid=${enc(tag)}` : ""}`,
};

const BOOKSHOP_ES: Vendor = {
  key: "bookshop_es",
  name: "Bookshop.org España",
  kind: "indie",
  build: (t, a, tag) =>
    `https://es.bookshop.org/search?keywords=${q(t, a)}${tag ? `&aid=${enc(tag)}` : ""}`,
};

const GENIALOKAL_DE: Vendor = {
  key: "genialokal_de",
  name: "Genialokal (lokaler Buchhandel)",
  kind: "indie",
  build: (t, a) => `https://www.genialokal.de/Suche/?q=${q(t, a)}`,
};

const BUCH7_DE: Vendor = {
  key: "buch7_de",
  name: "Buch7",
  kind: "indie",
  build: (t, a) => `https://www.buch7.de/suche?q=${q(t, a)}`,
};

const PLACE_DES_LIBRAIRES_FR: Vendor = {
  key: "placedeslibraires_fr",
  name: "Place des Libraires",
  kind: "indie",
  build: (t, a) => `https://www.placedeslibraires.fr/listeliv.php?MOTS=${q(t, a)}`,
};

const LALIBRAIRIE_FR: Vendor = {
  key: "lalibrairie_fr",
  name: "Lalibrairie.com",
  kind: "indie",
  build: (t, a) => `https://www.lalibrairie.com/livres/recherche.html?search=${q(t, a)}`,
};

const LIBRERIA_UNIVERSITARIA_IT: Vendor = {
  key: "libreriauniv_it",
  name: "Libreriauniversitaria",
  kind: "chain",
  build: (t, a) => `https://www.libreriauniversitaria.it/ricerca/query/${q(t, a)}`,
};

const IBS_IT: Vendor = {
  key: "ibs_it",
  name: "IBS.it",
  kind: "chain",
  build: (t, a) => `https://www.ibs.it/search/?ts=as&query=${q(t, a)}`,
};

const FNAC_FR: Vendor = {
  key: "fnac_fr",
  name: "Fnac",
  kind: "chain",
  build: (t, a) => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q(t, a)}&SCat=2!1`,
};

const HONTO_JP: Vendor = {
  key: "honto_jp",
  name: "Honto",
  kind: "indie",
  build: (t, a) => `https://honto.jp/netstore/search.html?k=${q(t, a)}&srchf=1`,
};

const KINOKUNIYA_JP: Vendor = {
  key: "kinokuniya_jp",
  name: "Kinokuniya",
  kind: "chain",
  build: (t, a) => `https://www.kinokuniya.co.jp/disp/CSfDispListPage_001.jsp?qs=true&ptk=01&q=${q(t, a)}`,
};

const ALADIN_KR: Vendor = {
  key: "aladin_kr",
  name: "Aladin (알라딘)",
  kind: "indie",
  build: (t, a) => `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchTarget=Book&SearchWord=${q(t, a)}`,
};

const KYOBO_KR: Vendor = {
  key: "kyobo_kr",
  name: "Kyobo (교보문고)",
  kind: "chain",
  build: (t, a) => `https://search.kyobobook.co.kr/search?keyword=${q(t, a)}&gbCode=TOT`,
};

const LEYA_BR: Vendor = {
  key: "leya_br",
  name: "Leya",
  kind: "chain",
  build: (t, a) => `https://www.leya.com/pt/gca/buscar/?q=${q(t, a)}`,
};

const CULTURA_BR: Vendor = {
  key: "cultura_br",
  name: "Livraria Cultura",
  kind: "chain",
  build: (t, a) => `https://www3.livrariacultura.com.br/busca?ft=${q(t, a)}`,
};

const INDIGO_CA: Vendor = {
  key: "indigo_ca",
  name: "Indigo",
  kind: "chain",
  build: (t, a) => `https://www.indigo.ca/en-ca/search?keywords=${q(t, a)}`,
};

const BOOKTOPIA_AU: Vendor = {
  key: "booktopia_au",
  name: "Booktopia",
  kind: "chain",
  build: (t, a) => `https://www.booktopia.com.au/search.ep?keywords=${q(t, a)}`,
};

const READINGS_AU: Vendor = {
  key: "readings_au",
  name: "Readings (indie)",
  kind: "indie",
  build: (t, a) => `https://www.readings.com.au/search?q=${q(t, a)}`,
};

const HIVE_UK: Vendor = {
  key: "hive_uk",
  name: "Hive (supports indies)",
  kind: "indie",
  build: (t, a) => `https://www.hive.co.uk/Search/Keyword?keyword=${q(t, a)}`,
};

const BOL_NL: Vendor = {
  key: "bol_nl",
  name: "Bol.com",
  kind: "chain",
  build: (t, a) => `https://www.bol.com/nl/nl/s/?searchtext=${q(t, a)}&section=books`,
};

const STANDAARD_BE: Vendor = {
  key: "standaard_be",
  name: "Standaard Boekhandel",
  kind: "chain",
  build: (t, a) => `https://www.standaardboekhandel.be/zoeken?q=${q(t, a)}`,
};

const ADLIBRIS_SE: Vendor = {
  key: "adlibris_se",
  name: "Adlibris",
  kind: "chain",
  build: (t, a) => `https://www.adlibris.com/se/sok?q=${q(t, a)}`,
};

const AKATEEMINEN_FI: Vendor = {
  key: "akateeminen_fi",
  name: "Akateeminen Kirjakauppa",
  kind: "chain",
  build: (t, a) => `https://www.akateeminen.com/search?text=${q(t, a)}`,
};

// Amazon (always last). Domain per country.
const AMZ = (domain: string, key: string, name: string): Vendor => ({
  key,
  name,
  kind: "amazon",
  build: (t, a, tag) =>
    `https://${domain}/s?k=${q(t, a)}&i=stripbooks${tag ? `&tag=${enc(tag)}` : ""}`,
});

const AMZ_COM = AMZ("www.amazon.com", "amazon_com", "Amazon");
const AMZ_UK = AMZ("www.amazon.co.uk", "amazon_uk", "Amazon UK");
const AMZ_DE = AMZ("www.amazon.de", "amazon_de", "Amazon DE");
const AMZ_FR = AMZ("www.amazon.fr", "amazon_fr", "Amazon FR");
const AMZ_IT = AMZ("www.amazon.it", "amazon_it", "Amazon IT");
const AMZ_ES = AMZ("www.amazon.es", "amazon_es", "Amazon ES");
const AMZ_CA = AMZ("www.amazon.ca", "amazon_ca", "Amazon CA");
const AMZ_AU = AMZ("www.amazon.com.au", "amazon_au", "Amazon AU");
const AMZ_JP = AMZ("www.amazon.co.jp", "amazon_jp", "Amazon JP");
const AMZ_BR = AMZ("www.amazon.com.br", "amazon_br", "Amazon BR");
const AMZ_NL = AMZ("www.amazon.nl", "amazon_nl", "Amazon NL");
const AMZ_SE = AMZ("www.amazon.se", "amazon_se", "Amazon SE");
const AMZ_MX = AMZ("www.amazon.com.mx", "amazon_mx", "Amazon MX");
const AMZ_IN = AMZ("www.amazon.in", "amazon_in", "Amazon IN");

// Country → ordered preference list (indies first, Amazon last).
const COUNTRY_VENDORS: Record<string, Vendor[]> = {
  US: [BOOKSHOP_ORG, AMZ_COM],
  GB: [BOOKSHOP_UK, HIVE_UK, AMZ_UK],
  IE: [BOOKSHOP_UK, HIVE_UK, AMZ_UK],
  DE: [GENIALOKAL_DE, BUCH7_DE, AMZ_DE],
  AT: [GENIALOKAL_DE, BUCH7_DE, AMZ_DE],
  CH: [GENIALOKAL_DE, BUCH7_DE, AMZ_DE],
  FR: [PLACE_DES_LIBRAIRES_FR, LALIBRAIRIE_FR, FNAC_FR, AMZ_FR],
  BE: [PLACE_DES_LIBRAIRES_FR, STANDAARD_BE, AMZ_FR],
  LU: [PLACE_DES_LIBRAIRES_FR, AMZ_FR],
  IT: [LIBRERIA_UNIVERSITARIA_IT, IBS_IT, AMZ_IT],
  ES: [BOOKSHOP_ES, AMZ_ES],
  PT: [BOOKSHOP_ES, AMZ_ES],
  CA: [BOOKSHOP_ORG, INDIGO_CA, AMZ_CA],
  AU: [READINGS_AU, BOOKTOPIA_AU, AMZ_AU],
  NZ: [READINGS_AU, BOOKTOPIA_AU, AMZ_AU],
  JP: [HONTO_JP, KINOKUNIYA_JP, AMZ_JP],
  KR: [ALADIN_KR, KYOBO_KR],
  BR: [CULTURA_BR, LEYA_BR, AMZ_BR],
  NL: [BOL_NL, AMZ_NL],
  SE: [ADLIBRIS_SE, AMZ_SE],
  NO: [ADLIBRIS_SE, AMZ_UK],
  DK: [ADLIBRIS_SE, AMZ_UK],
  FI: [AKATEEMINEN_FI, ADLIBRIS_SE, AMZ_UK],
  MX: [AMZ_MX],
  IN: [AMZ_IN],
};

// Affiliate tag registry. Empty for now — populate via env vars when monetizing.
// Vendor key → env var name → if set, passed to vendor.build().
const AFFILIATE_ENV: Record<string, string> = {
  bookshop_org: "AFFILIATE_BOOKSHOP_ORG",
  bookshop_uk: "AFFILIATE_BOOKSHOP_UK",
  bookshop_es: "AFFILIATE_BOOKSHOP_ES",
  amazon_com: "AFFILIATE_AMAZON_COM",
  amazon_uk: "AFFILIATE_AMAZON_UK",
  amazon_de: "AFFILIATE_AMAZON_DE",
  amazon_fr: "AFFILIATE_AMAZON_FR",
  amazon_it: "AFFILIATE_AMAZON_IT",
  amazon_es: "AFFILIATE_AMAZON_ES",
  amazon_ca: "AFFILIATE_AMAZON_CA",
  amazon_au: "AFFILIATE_AMAZON_AU",
  amazon_jp: "AFFILIATE_AMAZON_JP",
  amazon_br: "AFFILIATE_AMAZON_BR",
  amazon_nl: "AFFILIATE_AMAZON_NL",
  amazon_se: "AFFILIATE_AMAZON_SE",
  amazon_mx: "AFFILIATE_AMAZON_MX",
  amazon_in: "AFFILIATE_AMAZON_IN",
};

// --- Geo detection -------------------------------------------------------

function countryFromAcceptLanguage(al: string | null): string | null {
  if (!al) return null;
  // Accept-Language entries are ordered by preference (q=...) — only trust
  // the FIRST (highest-priority) entry. The previous implementation used a
  // non-anchored regex that scanned the *entire* header for the first
  // region-tagged locale anywhere in the string, so a low-priority fallback
  // like "en-GB" tacked on after a region-less primary tag (e.g.
  // "en;q=0.9,en-GB;q=0.8" — a common reduced-Accept-Language shape) would
  // silently win over the user's actual top preference. Since Accept-Language
  // is a language signal, not a location one, being wrong here reliably
  // routed English-UI visitors worldwide to Amazon UK ("always redirects to
  // Amazon UK" bug) — anchoring to the first entry only doesn't make this a
  // reliable geo signal, but it stops it from actively lying.
  const first = (al.split(",")[0] ?? "").trim();
  const m = first.match(/^([a-zA-Z]{2,3})-([a-zA-Z]{2})/);
  return m ? m[2].toUpperCase() : null;
}

function detectCountry(req: Request): { country: string; source: string } {
  const h = req.headers;
  const cf = h.get("cf-ipcountry");
  if (cf && cf.length === 2 && cf !== "XX") return { country: cf.toUpperCase(), source: "cf" };
  const vc = h.get("x-vercel-ip-country");
  if (vc && vc.length === 2) return { country: vc.toUpperCase(), source: "vercel" };
  const xc = h.get("x-country-code");
  if (xc && xc.length === 2) return { country: xc.toUpperCase(), source: "x-country" };
  const al = countryFromAcceptLanguage(h.get("accept-language"));
  if (al) return { country: al, source: "accept-language" };
  return { country: "US", source: "default" };
}

// --- Handler -------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let title = "";
    let author = "";
    let countryOverride: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      title = url.searchParams.get("title") || "";
      author = url.searchParams.get("author") || "";
      countryOverride = url.searchParams.get("country");
    } else {
      const body = await req.json().catch(() => ({}));
      title = String(body?.title || "");
      author = String(body?.author || "");
      countryOverride = body?.country ? String(body.country) : null;
    }

    title = title.trim();
    author = author.trim();
    if (!title) {
      return new Response(JSON.stringify({ error: "title required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detected = detectCountry(req);
    const country =
      countryOverride && countryOverride.length === 2
        ? countryOverride.toUpperCase()
        : detected.country;

    const vendors = COUNTRY_VENDORS[country] || COUNTRY_VENDORS["US"];

    const options = vendors.map((v) => {
      const tagEnv = AFFILIATE_ENV[v.key];
      const tag = tagEnv ? Deno.env.get(tagEnv) || undefined : undefined;
      return {
        vendor: v.key,
        name: v.name,
        kind: v.kind,
        url: v.build(title, author, tag),
        affiliated: !!tag,
      };
    });

    const primary = options[0];

    return new Response(
      JSON.stringify({
        country,
        country_source: detected.source,
        primary,
        options,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Country-keyed; safe to cache at the edge for a day.
          "Cache-Control": "public, max-age=86400",
        },
      },
    );
  } catch (err) {
    console.error("resolve-buy-link fatal", err);
    // Never fail the user — fall back to amazon.com search.
    const url = new URL(req.url);
    const title = url.searchParams.get("title") || "";
    const author = url.searchParams.get("author") || "";
    return new Response(
      JSON.stringify({
        country: "US",
        country_source: "fallback",
        primary: {
          vendor: "amazon_com",
          name: "Amazon",
          kind: "amazon",
          url: AMZ_COM.build(title, author),
          affiliated: false,
        },
        options: [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
