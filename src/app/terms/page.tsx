import Link from "next/link";

/**
 * /terms — Terms of Service. Static content page styled with the
 * RomdoulKHShop brand tokens (surface / hairline / gold / muted) so it
 * renders correctly in both dark and light themes.
 */
export const metadata = {
  title: "Terms of Service — RomdoulKHShop",
  description:
    "The terms and conditions governing your use of RomdoulKHShop — Cambodia's gaming top-up marketplace with escrow-protected KHQR payments.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-6">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <div className="bg-page">
      <article className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <header className="pb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-muted">
            Last updated: October 26, 2026 · RomdoulKHShop
          </p>
        </header>

        <div className="space-y-6">
          <Section title="1. About RomdoulKHShop">
            <p>
              RomdoulKHShop is an online marketplace that lets buyers in
              Cambodia purchase game top-ups, gift cards, and related digital
              goods from approved sellers. We provide the platform, the
              escrow-backed payment flow (KHQR via ABA PayWay), and dispute
              resolution — but we are not the seller of the items listed unless
              we explicitly say so.
            </p>
            <p>
              By creating an account or placing an order, you agree to these
              Terms and the&nbsp;
              <Link href="/privacy" className="text-royal underline hover:text-gold">
                Privacy &amp; Seller KYC Policy
              </Link>
              . Sellers are additionally bound by the&nbsp;
              <Link href="/seller-terms" className="text-royal underline hover:text-gold">
                Seller Terms &amp; Guidelines
              </Link>
              .
            </p>
          </Section>

          <Section title="2. Accounts">
            <Bullets
              items={[
                "You must provide accurate, up-to-date information when registering and keep your credentials secure.",
                "You must be at least 18 years old (or have the consent and supervision of a parent or legal guardian) to transact.",
                "One person may hold one buyer account. Duplicate, shared, or fraudulent accounts may be suspended without notice.",
                "You are responsible for all activity that occurs under your account, including orders placed with a compromised login. Report any unauthorized access to support immediately.",
              ]}
            />
          </Section>

          <Section title="3. Buying & Payments">
            <Bullets
              items={[
                "All prices are shown and charged in US dollars (USD).",
                "Payments are accepted via KHQR (ABA PayWay). Your bank or wallet issuer's own terms also apply to the payment itself.",
                "RomdoulKHShop never stores your bank credentials. Payment authorization happens entirely within the PayWay flow.",
                "When you place an order, your funds are held in escrow by RomdoulKHShop and are only released to the seller after delivery is confirmed as described in Section 4.",
                "Orders are subject to availability. If a listing is canceled, unavailable, or materially misrepresented, the held funds are refunded to you.",
              ]}
            />
          </Section>

          <Section title="4. Delivery & Confirmation">
            <Bullets
              items={[
                "Sellers must deliver within the delivery window shown on the listing.",
                "After delivery, you are expected to confirm receipt in the order page. Confirmations must be given honestly — only confirm once you have actually received and verified the goods.",
                "If you do not confirm or dispute within the stated review window, the order may be auto-confirmed and funds released to the seller.",
                "Keep delivery evidence (screenshots, serials, transaction IDs) until the order is fully closed.",
              ]}
            />
          </Section>

          <Section title="5. Disputes">
            <p>
              If an order is wrong, incomplete, late, or not delivered, open a
              dispute from the order page before the confirmation window ends.
              Our support team reviews the on-platform evidence (chat logs,
              delivery records, payment history) and issues a binding decision
              to refund the buyer or release the funds to the seller.
            </p>
            <p>
              Abusive, fabricated, or bad-faith disputes may result in account
              restrictions. Decisions on escrowed funds are final within the
              platform.
            </p>
          </Section>

          <Section title="6. Prohibited Use">
            <p>You agree not to use RomdoulKHShop to:</p>
            <Bullets
              items={[
                "Buy or sell stolen, hijacked, fraudulent, or hacked accounts or goods.",
                "Sell or distribute cheats, hacks, or anything that violates a game publisher's terms of service.",
                "Initiate fraudulent chargebacks or route payments originating from unlawful sources.",
                "Harass, scam, or defraud other users, or take transactions off-platform to evade escrow.",
                "Scrape, reverse-engineer, or disrupt the platform, or circumvent our fees and verification flows.",
              ]}
            />
          </Section>

          <Section title="7. Fees & Changes">
            <p>
              RomdoulKHShop may charge sellers a commission on completed sales
              and may introduce or change fees with reasonable advance notice
              on the platform. Continued use of the platform after a change
              takes effect means you accept the updated terms and fees.
            </p>
          </Section>

          <Section title="8. Suspension & Termination">
            <p>
              We may suspend or terminate accounts that break these Terms,
              fail KYC verification where required, or put buyers, sellers, or
              payment partners at risk. Escrowed funds on legitimate,
              completed orders are still honored; balances linked to
              fraud are withheld pending investigation.
            </p>
          </Section>

          <Section title="9. Disclaimers & Liability">
            <p>
              The marketplace is provided &quot;as is&quot;. We work hard to vet
              sellers and mediate disputes, but we do not warrant that every
              listing is accurate or that any particular game, publisher, or
              third-party service will remain available or accept a given
              top-up. To the maximum extent permitted by Cambodian law, our
              liability for any claim is limited to the amount you paid for the
              affected order.
            </p>
          </Section>

          <Section title="10. Governing Law & Contact">
            <p>
              These Terms are governed by the laws of the Kingdom of Cambodia.
              Questions about these Terms? Reach us through the&nbsp;
              <Link href="/feedback" className="text-royal underline hover:text-gold">
                feedback page
              </Link>
              &nbsp;or in-app support chat.
            </p>
          </Section>
        </div>

        {/* Cross-links */}
        <nav
          aria-label="Other policies"
          className="mt-10 flex flex-wrap justify-center gap-3 text-xs"
        >
          <Link
            href="/seller-terms"
            className="rounded-full border border-hairline bg-surface px-4 py-2 text-muted transition-colors hover:border-gold hover:text-gold"
          >
            Seller Terms &amp; Guidelines →
          </Link>
          <Link
            href="/privacy"
            className="rounded-full border border-hairline bg-surface px-4 py-2 text-muted transition-colors hover:border-gold hover:text-gold"
          >
            Privacy &amp; Seller KYC Policy →
          </Link>
        </nav>
      </article>
    </div>
  );
}
