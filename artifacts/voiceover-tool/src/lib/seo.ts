import { useEffect } from "react";

const SITE = "https://openradio.io";
const DEFAULTS = {
  title: "OpenRadio — Free AI Voice Generator, Text to Speech & Voice Cloning",
  description:
    "Turn text into realistic AI voiceovers in seconds. OpenRadio offers lifelike text to speech, instant voice cloning, video dubbing and 100+ natural voices in dozens of languages. Start free.",
  url: `${SITE}/`,
  robots: "index, follow",
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function applyHead(title: string, description: string, url: string, robots: string) {
  document.title = title;
  setMeta("name", "description", description);
  setMeta("name", "robots", robots);
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", description);
  setMeta("property", "og:url", url);
  setMeta("name", "twitter:title", title);
  setMeta("name", "twitter:description", description);
  setCanonical(url);
}

/**
 * Per-page SEO for client-side navigation. The server injects the same
 * metadata into the initial HTML (see api-server lib/seo-meta.ts) — this hook
 * keeps the head correct as the user navigates within the SPA.
 */
export function useSeo(opts: { title: string; description: string; path: string; noindex?: boolean }) {
  const { title, description, path, noindex } = opts;
  useEffect(() => {
    applyHead(title, description, `${SITE}${path}`, noindex ? "noindex, nofollow" : "index, follow");
    return () => {
      // Restore the full baseline so routes without useSeo (app pages) never
      // keep a previous page's canonical/OG metadata.
      applyHead(DEFAULTS.title, DEFAULTS.description, DEFAULTS.url, DEFAULTS.robots);
    };
  }, [title, description, path, noindex]);
}
