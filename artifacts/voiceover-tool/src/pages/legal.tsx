import { MarketingNav, MarketingFooter } from "@/components/marketing-nav";
import { Mail, MessageCircle } from "lucide-react";

/* ── Shared layout for policy pages ─────────────────────────────────── */
function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fafaf8]">
      <MarketingNav />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-orange-500 mb-3">OpenRadio.io</p>
          <h1 className="text-[36px] sm:text-[48px] font-black tracking-tight text-black leading-tight mb-2">{title}</h1>
          <p className="text-[13px] text-black/40 font-medium mb-10">Last updated: {updated}</p>
          <div className="space-y-8 text-[15px] leading-relaxed text-black/70 [&_h2]:text-[20px] [&_h2]:font-black [&_h2]:text-black [&_h2]:tracking-tight [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
            {children}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

const UPDATED = "August 15, 2026";
const CONTACT_EMAIL = "hellojian@openradio.io";

/* ── Privacy Policy ─────────────────────────────────────────────────── */
export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={UPDATED}>
      <section>
        <h2>1. Information we collect</h2>
        <ul>
          <li><b>Account details</b> — your name, email address and password (stored encrypted) when you register.</li>
          <li><b>Content you create</b> — text you convert to speech, audio samples you upload for voice cloning, and generated audio files.</li>
          <li><b>Usage data</b> — character usage, credits, plan information, and basic logs needed to run the service.</li>
        </ul>
      </section>
      <section>
        <h2>2. How we use your information</h2>
        <ul>
          <li>To provide text-to-speech, voice cloning and related audio services.</li>
          <li>To manage your account, credits and subscription plan.</li>
          <li>To process your text and audio through our AI voice providers (ElevenLabs, MiniMax, Fish Audio, Microsoft Edge TTS) solely to generate your requested output.</li>
          <li>To keep the platform secure and prevent abuse.</li>
        </ul>
      </section>
      <section>
        <h2>3. What we never do</h2>
        <ul>
          <li>We never sell your personal data to anyone.</li>
          <li>We never use your cloned voice or uploaded audio for anything other than the generations you request.</li>
          <li>We never share your content with third parties beyond the AI providers required to fulfil your request.</li>
        </ul>
      </section>
      <section>
        <h2>4. Data retention & deletion</h2>
        <p>Generated audio and voice clones remain in your account until you delete them. You can request full account deletion at any time by emailing {CONTACT_EMAIL} — we will remove your personal data within 30 days.</p>
      </section>
      <section>
        <h2>5. Security</h2>
        <p>Passwords are hashed, connections are encrypted with TLS, and access to production data is restricted. No system is 100% secure, but we follow industry best practices to protect your information.</p>
      </section>
      <section>
        <h2>6. Contact</h2>
        <p>Questions about this policy? Email us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 font-semibold hover:underline">{CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalLayout>
  );
}

/* ── Terms of Service ───────────────────────────────────────────────── */
export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated={UPDATED}>
      <section>
        <h2>1. Acceptance of terms</h2>
        <p>By creating an account or using OpenRadio.io you agree to these Terms. If you do not agree, please do not use the service.</p>
      </section>
      <section>
        <h2>2. The service</h2>
        <p>OpenRadio provides AI-powered voice tools — text to speech, voice cloning and related audio generation — powered by third-party AI engines. Features available to you depend on your plan and credit balance.</p>
      </section>
      <section>
        <h2>3. Your responsibilities</h2>
        <ul>
          <li>Only clone voices you own or have clear permission to use. Cloning someone's voice without consent is strictly prohibited.</li>
          <li>Do not use generated audio for fraud, impersonation, harassment, misinformation or any illegal purpose.</li>
          <li>Keep your account credentials secure — you are responsible for activity under your account.</li>
          <li>Do not attempt to abuse, reverse-engineer or overload the platform.</li>
        </ul>
      </section>
      <section>
        <h2>4. Credits & plans</h2>
        <p>Paid plans grant a monthly character/credit allowance as described on the Pricing page. Credits reset with your billing cycle and unused credits do not roll over unless stated otherwise. We may adjust plan features with reasonable notice.</p>
      </section>
      <section>
        <h2>5. Ownership of output</h2>
        <p>You own the audio you generate, subject to the terms of the underlying AI providers. You are responsible for how you use and distribute that audio.</p>
      </section>
      <section>
        <h2>6. Termination</h2>
        <p>We may suspend or terminate accounts that violate these Terms, including misuse of voice cloning. You may stop using the service and delete your account at any time.</p>
      </section>
      <section>
        <h2>7. Disclaimer & liability</h2>
        <p>The service is provided "as is". To the maximum extent permitted by law, OpenRadio is not liable for indirect or consequential damages arising from use of the service.</p>
      </section>
      <section>
        <h2>8. Contact</h2>
        <p>Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 font-semibold hover:underline">{CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalLayout>
  );
}

/* ── Refund Policy ──────────────────────────────────────────────────── */
export function RefundPage() {
  return (
    <LegalLayout title="Refund Policy" updated={UPDATED}>
      <section>
        <h2>1. 7-day refund window</h2>
        <p>If you purchased a paid plan and are not satisfied, you can request a refund within <b>7 days</b> of the purchase — provided you have used less than <b>20%</b> of the plan's credit allowance.</p>
      </section>
      <section>
        <h2>2. When refunds are not available</h2>
        <ul>
          <li>More than 7 days have passed since the purchase.</li>
          <li>You have consumed 20% or more of the plan's credits.</li>
          <li>The account was suspended for violating our Terms of Service.</li>
          <li>Renewal charges where the previous cycle was actively used.</li>
        </ul>
      </section>
      <section>
        <h2>3. How to request a refund</h2>
        <p>Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 font-semibold hover:underline">{CONTACT_EMAIL}</a> from your registered email address with your order details. Approved refunds are returned to the original payment method within 5–10 business days.</p>
      </section>
      <section>
        <h2>4. Service issues</h2>
        <p>If a technical problem on our side prevented you from using purchased credits, contact us — we will restore the credits or refund the affected amount, whichever you prefer.</p>
      </section>
    </LegalLayout>
  );
}

/* ── Cookie Policy ──────────────────────────────────────────────────── */
export function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" updated={UPDATED}>
      <section>
        <h2>1. What are cookies?</h2>
        <p>Cookies are small text files stored in your browser. OpenRadio uses them sparingly — we do not run third-party advertising or tracking cookies.</p>
      </section>
      <section>
        <h2>2. Cookies we use</h2>
        <ul>
          <li><b>Session cookie (essential)</b> — keeps you signed in to your account. Without it, login cannot work. It expires after 7 days.</li>
          <li><b>Preference storage</b> — your interface settings (like selected voice or theme) may be kept in your browser's local storage.</li>
        </ul>
      </section>
      <section>
        <h2>3. Managing cookies</h2>
        <p>You can clear or block cookies in your browser settings at any time. Note that blocking the session cookie will sign you out and prevent login.</p>
      </section>
      <section>
        <h2>4. Contact</h2>
        <p>Questions about cookies? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 font-semibold hover:underline">{CONTACT_EMAIL}</a>.</p>
      </section>
    </LegalLayout>
  );
}

/* ── Contact ────────────────────────────────────────────────────────── */
export function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#fafaf8]">
      <MarketingNav />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-orange-500 mb-3">We're here to help</p>
          <h1 className="text-[40px] sm:text-[56px] font-black tracking-tight text-black leading-tight mb-4">Contact us</h1>
          <p className="text-[16px] text-black/50 font-medium max-w-lg mx-auto mb-12">
            Questions about plans, refunds, voice cloning or anything else — we usually reply within 24 hours.
          </p>
          <div className="grid sm:grid-cols-2 gap-5 max-w-xl mx-auto text-left">
            <a href={`mailto:${CONTACT_EMAIL}`} className="group bg-white rounded-3xl border border-black/6 p-7 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-5">
                <Mail size={22} className="text-orange-500" />
              </div>
              <h3 className="text-[18px] font-black text-black tracking-tight mb-1">Email support</h3>
              <p className="text-[13px] text-black/50 font-medium mb-3">For account, billing and technical questions.</p>
              <span className="text-[14px] font-bold text-orange-500 group-hover:underline">{CONTACT_EMAIL}</span>
            </a>
            <div className="bg-white rounded-3xl border border-black/6 p-7">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5">
                <MessageCircle size={22} className="text-blue-500" />
              </div>
              <h3 className="text-[18px] font-black text-black tracking-tight mb-1">Refunds & billing</h3>
              <p className="text-[13px] text-black/50 font-medium">
                Check our <a href="/refund-policy" className="text-orange-500 font-semibold hover:underline">Refund Policy</a> first — most billing questions are answered there.
              </p>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
