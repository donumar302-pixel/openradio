import { Link, useParams } from "wouter";
import { ArrowRight, Clock } from "lucide-react";
import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { useSeo } from "@/lib/seo";
import { BLOG_ARTICLES, getArticle } from "@/lib/blog-content";
import NotFound from "@/pages/not-found";

function CtaBanner() {
  return (
    <div className="mt-14 bg-black rounded-[32px] p-8 sm:p-12 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.2)_0%,transparent_60%)] pointer-events-none" />
      <div className="relative z-10">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-3">Try OpenRadio free</h2>
        <p className="text-sm sm:text-base text-gray-400 font-medium max-w-md mx-auto mb-7">
          Realistic AI voices, cloning and dubbing — with free starter credits. No credit card required.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-orange-500 hover:bg-orange-600 rounded-full text-white text-[15px] font-bold shadow-lg shadow-orange-500/30 transition-all"
          data-testid="link-blog-cta-register"
        >
          Start Creating Free <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}

export function BlogIndexPage() {
  useSeo({
    title: "Blog — AI Voice Guides & Comparisons | OpenRadio",
    description:
      "Guides and comparisons on AI voiceovers: ElevenLabs & Murf alternatives, how voice cloning works, AI dubbing explained, and more from the OpenRadio team.",
    path: "/blog",
  });
  const guides = BLOG_ARTICLES.filter((a) => a.category === "Guides");
  const alternatives = BLOG_ARTICLES.filter((a) => a.category === "Alternatives");
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fafaf8]">
      <MarketingNav />
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-24">
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-orange-500 mb-3">OpenRadio Blog</p>
          <h1 className="text-[36px] sm:text-[52px] font-black tracking-tight text-black leading-tight mb-4">
            AI Voice Guides & Comparisons
          </h1>
          <p className="text-base text-black/60 font-medium max-w-2xl mb-14">
            Practical guides on text to speech, voice cloning and dubbing — plus honest comparisons with other
            voiceover tools.
          </p>

          {[
            { label: "Comparisons & Alternatives", items: alternatives },
            { label: "Guides", items: guides },
          ].map((group) => (
            <div key={group.label} className="mb-14">
              <h2 className="text-xl font-black text-black mb-6">{group.label}</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                {group.items.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/blog/${a.slug}`}
                    className="group bg-white rounded-3xl border border-black/5 shadow-sm p-7 hover:shadow-md hover:border-orange-500/20 transition-all flex flex-col"
                    data-testid={`link-blog-${a.slug}`}
                  >
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-500 mb-3">
                      {a.category}
                    </span>
                    <span className="text-lg font-black text-black leading-snug mb-3 group-hover:text-orange-600 transition-colors">
                      {a.h1}
                    </span>
                    <span className="text-sm text-black/55 font-medium leading-relaxed mb-5 line-clamp-3">
                      {a.metaDescription}
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-bold text-black/40">
                      <Clock size={14} /> {a.readMinutes} min read
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <CtaBanner />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function BlogArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = getArticle(params.slug ?? "");
  useSeo({
    title: article?.title ?? "Page Not Found — OpenRadio",
    description: article?.metaDescription ?? "The page you're looking for doesn't exist.",
    path: article ? `/blog/${article.slug}` : "/blog",
    noindex: !article,
  });
  if (!article) return <NotFound />;

  const related = article.related.map(getArticle).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fafaf8]">
      <MarketingNav />
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-orange-500 mb-3">
            <Link href="/blog" className="hover:underline">Blog</Link> · {article.category}
          </p>
          <h1 className="text-[32px] sm:text-[44px] font-black tracking-tight text-black leading-[1.1] mb-4">
            {article.h1}
          </h1>
          <p className="text-[13px] font-semibold text-black/40 mb-10 flex items-center gap-2">
            <Clock size={14} /> {article.readMinutes} min read · Updated{" "}
            {new Date(article.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          {article.intro.map((p, i) => (
            <p key={i} className="text-base sm:text-[17px] text-black/70 font-medium leading-relaxed mb-5">{p}</p>
          ))}

          {article.sections.map((s) => (
            <section key={s.heading} className="mt-10">
              <h2 className="text-2xl sm:text-[28px] font-black tracking-tight text-black mb-4">{s.heading}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-base text-black/70 font-medium leading-relaxed mb-4">{p}</p>
              ))}
              {s.bullets && (
                <ul className="space-y-2.5 mb-4">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-base text-black/70 font-medium leading-relaxed">
                      <span className="text-orange-500 font-black shrink-0 mt-0.5">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {article.comparison && (
            <section className="mt-10">
              <h2 className="text-2xl sm:text-[28px] font-black tracking-tight text-black mb-5">
                OpenRadio vs {article.comparison.competitor}
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 bg-black/[0.02]">
                      <th className="text-left font-black text-black px-5 py-3.5"> </th>
                      <th className="text-left font-black text-orange-600 px-5 py-3.5">OpenRadio</th>
                      <th className="text-left font-black text-black/60 px-5 py-3.5">{article.comparison.competitor}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {article.comparison.rows.map(([feature, ours, theirs]) => (
                      <tr key={feature} className="border-b border-black/5 last:border-0">
                        <td className="px-5 py-3.5 font-bold text-black/80">{feature}</td>
                        <td className="px-5 py-3.5 font-medium text-black/70">{ours}</td>
                        <td className="px-5 py-3.5 font-medium text-black/50">{theirs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-12">
            <h2 className="text-2xl sm:text-[28px] font-black tracking-tight text-black mb-5">Frequently asked questions</h2>
            <div className="space-y-4">
              {article.faq.map((f) => (
                <details key={f.q} className="group bg-white rounded-2xl border border-black/5 shadow-sm px-6 py-4 open:pb-5">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[15px] font-bold text-black">
                    {f.q}
                    <span className="shrink-0 text-orange-500 text-xl leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-black/60 font-medium leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <CtaBanner />

          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="text-xl font-black text-black mb-5">Keep reading</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r!.slug}
                    href={`/blog/${r!.slug}`}
                    className="bg-white rounded-2xl border border-black/5 shadow-sm p-5 hover:border-orange-500/20 hover:shadow-md transition-all"
                  >
                    <span className="text-[11px] font-black uppercase tracking-[0.15em] text-orange-500 block mb-2">
                      {r!.category}
                    </span>
                    <span className="text-sm font-bold text-black leading-snug">{r!.h1}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
