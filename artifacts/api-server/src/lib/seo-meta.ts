/**
 * Server-side SEO meta injection for the SPA.
 *
 * The client is a Vite SPA, so without this every direct URL would serve
 * index.html with the homepage title/canonical/OG tags — crawlers and link
 * unfurlers that don't execute JS would see the wrong metadata on every page.
 * Keep titles/descriptions in sync with the client-side useSeo() calls in
 * artifacts/voiceover-tool/src/pages/*.
 */

const SITE = "https://openradio.io";

type PageMeta = { title: string; description: string; noindex?: boolean };

const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "OpenRadio — Free AI Voice Generator, Text to Speech & Voice Cloning",
    description:
      "Turn text into realistic AI voiceovers in seconds. OpenRadio offers lifelike text to speech, instant voice cloning, video dubbing and 100+ natural voices in dozens of languages. Start free.",
  },
  "/pricing": {
    title: "Pricing & Credit Plans — OpenRadio AI Voice Generator",
    description:
      "Simple credit-based pricing for AI text to speech, voice cloning and dubbing. Start free, upgrade when you need more — no hidden fees.",
  },
  "/tools": {
    title: "AI Audio Tools — Text to Speech, Voice Cloning, Dubbing & More | OpenRadio",
    description:
      "Explore OpenRadio's AI audio toolkit: realistic text to speech, instant voice cloning, video dubbing, sound effects, speech to text, multi-speaker dialogue and more.",
  },
  "/contact": {
    title: "Contact Us — OpenRadio",
    description: "Get in touch with the OpenRadio team for support, billing or partnership questions.",
  },
  "/privacy": {
    title: "Privacy Policy — OpenRadio",
    description: "How OpenRadio collects, uses and protects your data.",
  },
  "/terms": {
    title: "Terms of Service — OpenRadio",
    description: "The terms that govern your use of OpenRadio's AI voice tools.",
  },
  "/refund-policy": {
    title: "Refund Policy — OpenRadio",
    description: "OpenRadio's refund policy for credit plans and subscriptions.",
  },
  "/cookies": {
    title: "Cookie Policy — OpenRadio",
    description: "How OpenRadio uses cookies to keep you signed in and improve the product.",
  },
  // Blog — keep in sync with artifacts/voiceover-tool/src/lib/blog-content.ts
  "/blog": {
    title: "Blog — AI Voice Guides & Comparisons | OpenRadio",
    description:
      "Guides and comparisons on AI voiceovers: ElevenLabs & Murf alternatives, how voice cloning works, AI dubbing explained, and more from the OpenRadio team.",
  },
  "/blog/elevenlabs-alternative": {
    title: "Best Free ElevenLabs Alternative in 2026 — OpenRadio",
    description:
      "Looking for a free ElevenLabs alternative? OpenRadio gives you ElevenLabs-quality AI voices, voice cloning and dubbing with simple pay-as-you-go credits — no monthly subscription required.",
  },
  "/blog/murf-ai-alternative": {
    title: "Murf AI Alternative: More Voices, Simpler Pricing — OpenRadio",
    description:
      "Searching for a Murf AI alternative? OpenRadio offers hundreds of realistic AI voices, instant voice cloning and video dubbing with pay-as-you-go credits instead of subscriptions. Start free.",
  },
  "/blog/play-ht-alternative": {
    title: "Play.ht Alternative with Voice Cloning & Dubbing — OpenRadio",
    description:
      "Need a Play.ht alternative? OpenRadio combines realistic text to speech, instant voice cloning, video dubbing and sound effects in one credit-based studio. No subscription — start free.",
  },
  "/blog/fish-audio-alternative": {
    title: "Fish Audio Alternative — Same Engine, Full Studio | OpenRadio",
    description:
      "Want Fish Audio voices plus cloning, dubbing and more? OpenRadio includes the Fish Audio engine alongside other premium AI voices in one credit-based studio. Start free.",
  },
  "/blog/what-is-ai-dubbing": {
    title: "What Is AI Dubbing? How AI Video Dubbing Works in 2026",
    description:
      "AI dubbing translates your video's speech into another language while keeping natural-sounding voices. Learn how AI video dubbing works, what it costs, and how to dub a video in minutes.",
  },
  "/blog/what-is-voice-cloning": {
    title: "What Is AI Voice Cloning & How Does It Work? (2026 Guide)",
    description:
      "AI voice cloning creates a digital copy of a voice from a short recording. Learn how voice cloning works, what it's used for, how to do it safely — and how to clone a voice in seconds.",
  },
  "/blog/what-is-ai-voice-cover": {
    title: "What Is an AI Voice Cover? Voice Changers Explained (2026)",
    description:
      "An AI voice cover re-voices existing audio in a different voice while keeping the original delivery. Learn how AI voice covers and speech-to-speech voice changers work.",
  },
  "/login": {
    title: "Log In — OpenRadio",
    description: "Log in to your OpenRadio account to create AI voiceovers, clone voices and dub videos.",
    noindex: true,
  },
  "/register": {
    title: "Sign Up Free — OpenRadio AI Voice Generator",
    description: "Create a free OpenRadio account and start generating realistic AI voiceovers in seconds. No credit card required.",
    noindex: true,
  },
};

// Keep in sync with FAQ_ITEMS in artifacts/voiceover-tool/src/pages/landing.tsx
const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "What is OpenRadio?",
    a: "OpenRadio is an all-in-one AI voice generator. It turns text into natural, human-sounding speech, clones your voice from a short sample, dubs videos into other languages, generates sound effects, and more — all from your browser.",
  },
  {
    q: "Is there a free AI voice generator plan?",
    a: "Yes. You can sign up free — no credit card required — and get free credits to try realistic text to speech right away. Upgrade any time for more credits and premium tools like voice cloning and dubbing.",
  },
  {
    q: "How does AI voice cloning work?",
    a: "Upload a clear 10–30 second recording of a voice you have permission to use. OpenRadio builds a custom AI voice from it in seconds, and you can then generate unlimited speech in that voice.",
  },
  {
    q: "Which languages and accents are supported?",
    a: "OpenRadio supports dozens of languages and accents — including English, Urdu, Hindi, Arabic, Spanish, and many more — with hundreds of lifelike male and female voices to choose from.",
  },
  {
    q: "Can I use the voiceovers commercially?",
    a: "Yes. Audio you generate on a paid plan can be used in YouTube videos, podcasts, ads, e-learning courses, audiobooks, and other commercial projects.",
  },
  {
    q: "How is OpenRadio different from other voiceover tools?",
    a: "OpenRadio combines multiple premium AI speech engines in one studio, with simple credit pricing, batch generation, multi-speaker dialogue, video dubbing, and speech-to-text — so you don't need separate subscriptions for each tool.",
  },
];

const HOME_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OpenRadio",
    url: SITE,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description:
      "AI voice generator with realistic text to speech, voice cloning, video dubbing, sound effects and multi-speaker dialogue.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setTagContent(html: string, attr: "name" | "property", key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${key.replace(/[.:]/g, "\\$&")}"\\s+content=")[^"]*(")`, "i");
  return html.replace(re, `$1${escAttr(value)}$2`);
}

/** Rewrite the built index.html with per-route title/description/canonical/OG tags. */
export function renderIndexHtml(rawHtml: string, pathname: string): string {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const meta = PAGE_META[clean];
  const title = meta?.title ?? PAGE_META["/"].title;
  const description = meta?.description ?? PAGE_META["/"].description;
  const url = `${SITE}${clean === "/" ? "/" : clean}`;
  // Unknown routes are app/private pages (or 404s): keep them out of the index.
  const noindex = !meta || meta.noindex === true;

  let html = rawHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escAttr(title)}</title>`);
  html = setTagContent(html, "name", "description", description);
  html = setTagContent(html, "property", "og:title", title);
  html = setTagContent(html, "property", "og:description", description);
  html = setTagContent(html, "property", "og:url", url);
  html = setTagContent(html, "name", "twitter:title", title);
  html = setTagContent(html, "name", "twitter:description", description);
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${escAttr(url)}$2`);
  if (noindex) {
    html = setTagContent(html, "name", "robots", "noindex, nofollow");
  }
  if (clean === "/") {
    const scripts = HOME_JSONLD.map(
      (d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, "\\u003c")}</script>`,
    ).join("\n    ");
    html = html.replace("</head>", `    ${scripts}\n  </head>`);
  }
  return html;
}
