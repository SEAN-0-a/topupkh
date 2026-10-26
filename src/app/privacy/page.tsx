import Link from "next/link";

/**
 * /privacy — Privacy & Seller KYC Policy. Static content page styled with
 * the RomdoulKHShop brand tokens (surface / hairline / gold / muted) so it
 * renders correctly in both dark and light themes.
 */
export const metadata = {
  title: "Privacy & Seller KYC Policy — RomdoulKHShop",
  description:
    "How RomdoulKHShop collects, uses, and protects your data — including buyer information, KHQR payments, and seller KYC verification documents.",
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

export default function PrivacyPage() {
  return (
    <div className="bg-page">
      <article className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <header className="pb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold">
            Legal · Privacy
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            Privacy &amp; Seller KYC Policy
          </h1>
          <p className="mt-3 text-sm text-muted">
            Last updated: October 26, 2026 · RomdoulKHShop
          </p>
        </header>

        <div className="space-y-6">
          <Section title="1. Data We Collect">
            <Bullets
              items={[
                "Account data: display name, email, avatar, and login identifiers.",
                "Order data: items viewed and purchased, delivery and confirmation records, messages, and dispute history.",
                "Payment data: KHQR transaction references and payment status from ABA PayWay. We never see or store your bank PIN, card numbers, or wallet credentials.",
                "Seller KYC data: legal name, date of birth, government-issued ID (e.g. Khmer national ID or passport), a selfie or liveness photo, contact details, and payout/bank account information.",
                "Technical data: IP address, device and browser information, and usage logs used for security and to keep the marketplace working.",
              ]}
            />
          </Section>

          <Section title="2. How We Use Your Data">
            <Bullets
              items={[
                "Operating the marketplace — accounts, orders, escrow, deliveries, and confirmations.",
                "Vetting and verifying sellers, and re-verifying changed payout details.",
                "Preventing fraud, money laundering, stolen-goods resale, and abuse of the platform.",
                "Resolving disputes using the on-platform record (chat, delivery proofs, payment references).",
                "Complying with legal obligations, including requests from Cambodian authorities and our payment partner.",
                "Product support and (only with your consent, where required) service updates — never sold to advertisers.",
              ]}
            />
          </Section>

          <Section title="3. Payments & Escrow">
            <p>
              Buyer payments are processed by ABA PayWay through the KHQR
              standard. Card and wallet details are entered in the payment
              provider&apos;s own flow; RomdoulKHShop receives only the
              transaction reference, amount, and status needed to hold funds in
              escrow and process refunds. Refunds are returned via the original
              payment method wherever the provider supports it.
            </p>
          </Section>

          <Section title="4. Seller KYC — What We Collect & Why">
            <p>
              Sellers handle buyer funds and deliver digital goods, so every
              seller must complete identity verification before listings go
              live. Here is exactly what happens to it:
            </p>
            <Bullets
              items={[
                "Verify who you are so buyers transact with a real, accountable person or business.",
                "Meet anti-fraud and anti-money-laundering (AML) expectations of our payment partner, ABA PayWay.",
                "Match payouts to the verified person or entity, preventing payout hijacking and fraud.",
                "Review and re-review KYC only when needed — e.g. when payout details change, a high-risk signal appears, or a serious dispute requires identity confirmation.",
                "KYC status is shown to us only as an internal flag. We do not publish your legal name, ID number, selfie, or payout account to buyers or other sellers.",
              ]}
            />
            <p>
              Documents you upload through the verification form are
              transmitted securely and stored with access limited to staff who
              review verifications or investigate fraud.
            </p>
          </Section>

          <Section title="5. Sharing & Disclosure">
            <p>
              We do not sell personal data. We share it only with:
            </p>
            <Bullets
              items={[
                "ABA PayWay, strictly to process payments, refunds, and payouts.",
                "Infrastructure providers that host and secure the platform (e.g. authentication and database services).",
                "Competent authorities when legally required, or where necessary to respond to fraud, stolen goods, or a valid dispute investigation.",
                "Another user, only the minimum needed for an order (e.g. your display name and delivery-relevant details) — never your identity documents or payout details.",
              ]}
            />
          </Section>

          <Section title="6. Retention">
            <Bullets
              items={[
                "Buyer account and order records are kept while your account is active and for a reasonable period afterwards for dispute and accounting purposes.",
                "Seller KYC documents are kept for as long as you are an approved seller, and for the retention period required by AML rules after your seller status ends, then securely deleted.",
                "Identity documents are deleted sooner upon request where no verification outcome, legal requirement, or active dispute requires them.",
              ]}
            />
          </Section>

          <Section title="7. Security">
            <p>
              We protect data with access controls, encrypted transport, and
              least-privilege access for staff. No system is perfectly secure;
              if a breach affecting you ever occurs, we will notify you as
              required by applicable law. Please also keep your password unique
              and never share one-time codes with anyone — including people
              claiming to be RomdoulKHShop staff.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>You can ask us to:</p>
            <Bullets
              items={[
                "Access the personal data we hold about you.",
                "Correct inaccurate data, including KYC details that have changed.",
                "Export your data in a portable format.",
                "Delete your data, subject to the retention period in Section 6 (e.g. records tied to orders or KYC obligations).",
              ]}
            />
            <p>
              Requests are made from your account settings or via the{" "}
              <Link href="/feedback" className="text-royal underline hover:text-gold">
                feedback page
              </Link>
              . We respond within a reasonable time and may ask you to verify
              your identity first before the request is actioned.
            </p>
          </Section>

          <Section title="9. Cookies & Local Storage">
            <p>
              We use cookies and local storage only for what the marketplace
              needs to work: keeping you signed in, remembering your theme and
              language preferences, and basic security. No third-party
              advertising trackers are used.
            </p>
          </Section>

          <Section title="10. Changes & Contact">
            <p>
              We will post any changes to this policy on this page with an
              updated date, and will give prominent notice for material
              changes that affect sellers&apos; KYC obligations. This policy is
              part of the main{" "}
              <Link href="/terms" className="text-royal underline hover:text-gold">
                Terms of Service
              </Link>
              ; questions are welcome anytime through in-app support.
            </p>
          </Section>
        </div>

        {/* Cross-links */}
        <nav
          aria-label="Other policies"
          className="mt-10 flex flex-wrap justify-center gap-3 text-xs"
        >
          <Link
            href="/terms"
            className="rounded-full border border-hairline bg-surface px-4 py-2 text-muted transition-colors hover:border-gold hover:text-gold"
          >
            ← Terms of Service
          </Link>
          <Link
            href="/seller-terms"
            className="rounded-full border border-hairline bg-surface px-4 py-2 text-muted transition-colors hover:border-gold hover:text-gold"
          >
            Seller Terms &amp; Guidelines →
          </Link>
        </nav>
      </article>
    </div>
  );
}
