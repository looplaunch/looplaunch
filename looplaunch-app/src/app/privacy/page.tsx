import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Loop Launch collects, why, who processes it, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const contact = siteConfig.links.contact;
const Email = () => <a href={`mailto:${contact}`}>{contact}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 29, 2026"
      intro={
        <p>
          Loop Launch (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs looplaunch.co, an AI marketing strategist for businesses.
          This policy explains what we collect, why we collect it, and the choices you have. Questions? Email <Email />.
        </p>
      }
    >
      <LegalSection title="1. What we collect">
        <ul>
          <li>
            <strong>Waitlist.</strong> If you join the waitlist: your email address, the page you joined from, your
            browser&apos;s user agent, and when you joined.
          </li>
          <li>
            <strong>Your account.</strong> Your email address and, if you set one, your password, which our authentication
            provider stores only as a secure hash. If you use Google sign-in, Google shares your name, email address and
            profile photo with us.
          </li>
          <li>
            <strong>Your profile.</strong> Anything you add in Settings: your name, role, company name, website and avatar
            color.
          </li>
          <li>
            <strong>Your analyses.</strong> The website you ask us to analyze, your answers to our questions, the research and
            strategies we generate, and your chats with Loopy.
          </li>
          <li>
            <strong>Technical data.</strong> Cookies that keep you logged in, and server logs (such as IP address, browser
            type and the requests you make) that our hosting provider keeps for security and troubleshooting.
          </li>
        </ul>
        <p>We don&apos;t use advertising or analytics cookies, and we don&apos;t sell your personal information.</p>
      </LegalSection>

      <LegalSection title="2. How we use it">
        <ul>
          <li>To run Loop Launch: research your market, write your strategies, save them to your account and answer your questions.</li>
          <li>To send account emails, such as verification and password reset codes.</li>
          <li>If you joined the waitlist, to tell you when your access is ready.</li>
          <li>To keep the service secure and working, and to fix problems.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Who processes it for us">
        <p>These providers help us run Loop Launch. They handle data on our behalf, only to provide their service:</p>
        <ul>
          <li><strong>Supabase:</strong> database and authentication.</li>
          <li><strong>Render:</strong> hosting.</li>
          <li>
            <strong>Google:</strong> Google sign-in, and the Gemini AI models that read your website and answers to write your
            analysis and replies.
          </li>
          <li><strong>Brevo:</strong> delivering our emails.</li>
          <li>
            <strong>SerpApi and Tavily:</strong> web searches about your business, market and competitors. We send them search
            terms, not your account details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. How long we keep it">
        <p>
          We keep your account and analyses until you delete them or your account. Waitlist entries are kept until we launch
          or you ask us to remove yours. Our hosting provider keeps server logs for a limited time.
        </p>
      </LegalSection>

      <LegalSection title="5. Your choices and rights">
        <ul>
          <li>Delete any analysis from your History at any time.</li>
          <li>
            Change your email or password, or delete your account, in <Link href="/profile">Settings</Link>. Deleting your
            account permanently deletes your analyses, chats and profile.
          </li>
          <li>
            Email <Email /> to get a copy of your data, correct it, remove your waitlist entry, or ask anything about your
            privacy. Depending on where you live, laws such as the GDPR may give you further rights, and we&apos;ll honor them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          Data travels over encrypted connections (HTTPS), access to it is restricted, and passwords are stored only as
          hashes. No system is perfectly secure, but we work hard to protect your information.
        </p>
      </LegalSection>

      <LegalSection title="7. Children">
        <p>Loop Launch is built for businesses and isn&apos;t meant for children under 16.</p>
      </LegalSection>

      <LegalSection title="8. Changes to this policy">
        <p>If we change this policy, we&apos;ll update this page and the date at the top.</p>
      </LegalSection>
    </LegalPage>
  );
}
