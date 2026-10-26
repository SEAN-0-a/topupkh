import Link from "next/link";

/**
 * /seller-terms — Seller Terms & Guidelines. Static content page styled with
 * the RomdoulKHShop brand tokens (surface / hairline / gold / muted) so it
 * renders correctly in both dark and light themes.
 */
export const metadata = {
  title: "Seller Terms & Guidelines — RomdoulKHShop",
  description:
    "The rules for sellers on RomdoulKHShop — KYC verification, listing standards, escrow delivery, prohibited items, payouts, and dispute handling.",
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

export default function SellerTermsPage() {
  return (
    <div className="bg-page">
      <article className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <header className="pb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold">
            Legal · For Sellers
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            Seller Terms &amp; Guidelines
          </h1>
          <p className="mt-3 text-sm text-muted">
            Last updated: October 26, 2026 · RomdoulKHShop
          </p>
        </header>

        <div className="space-y-6">
          <Section title="1. Becoming a Seller">
            <p>
              Anyone can buy on RomdoulKHShop, but selling requires approval.
              By applying through{" "}
              <Link href="/seller/verify" className="text-royal underline hover:text-gold">
                Become a seller
              </Link>{" "}
              you agree to:
            </p>
            <Bullets
              items={[
                "Complete identity verification (KYC) as described in the Privacy & Seller KYC Policy.",
                "Maintain a buyer account in good standing with accurate contact details.",
                "Keep your KYC information current — changes to your legal name, ID, or payout details must be re-verified.",
              ]}
            />
            <p>
              Approval is at RomdoulKHShop&apos;s discretion and may be revoked
              at any time for violations of these guidelines.
            </p>
          </Section>

          <Section title="2. Listing Standards">
            <Bullets
              items={[
                "List only items you are authorized to sell and can deliver as described.",
                "Write honest titles and descriptions, and accurately state the item type, quantity, region/server, validity period, and any restrictions.",
                "Use real images of the exact product or a truthful representation. Stock images must match what the buyer receives.",
                "Set a delivery window you can reliably meet, and keep stock counts accurate.",
                "Set prices honestly — no bait pricing, hidden fees, or prices that only take effect after the buyer contacts you.",
              ]}
            />
          </Section>

          <Section title="3. Fulfillment & Escrow">
            <p>
              Every sale runs through escrow: the buyer pays via KHQR (ABA
              PayWay), RomdoulKHShop holds the funds, and you are paid only
              after delivery is confirmed. This protects you as much as the
              buyer — delivered goods are guaranteed to be paid.
            </p>
            <Bullets
              items={[
                "Deliver within your stated delivery window. If you cannot, proactively message the buyer and cancel in good time.",
                "Deliver through the platform&apos;s delivery flow (code deliveries, account handovers, or upload of proof) so the record exists for disputes.",
                "Never ask the buyer to confirm receipt before the goods are actually delivered and working.",
                "Undelivered orders are auto-refunded to the buyer after the stated window.",
                "Orders that are not disputed by the buyer within the review window may be auto-confirmed, releasing your payout — this is your protection against slow confirmations.",
              ]}
            />
          </Section>

          <Section title="4. Prohibited Items & Behavior">
            <p>The following are strictly banned and result in removal and possible permanent suspension:</p>
            <Bullets
              items={[
                "Stolen, hijacked, recovered, or fraudulently obtained accounts, codes, or goods.",
                "Cheats, hacks, boosts performed with bots, or any service that violates a game publisher&apos;s terms of service.",
                "Items priced or described in a way that misleads buyers, and fake or duplicate listings.",
                "Requests to pay off-platform (direct bank transfers, Telegram payments, etc.) to bypass escrow.",
                "Threatening, harassing, or abusive communications with buyers or staff.",
                "Anything unlawful under Cambodian law or the rules of our payment partner.",
              ]}
            />
          </Section>

          <Section title="5. Payouts">
            <Bullets
              items={[
                "Payouts are released after delivery confirmation (or auto-confirmation) and any dispute period ends.",
                "RomdoulKHShop deducts its stated commission before payout — the net amount is shown on each order.",
                "Payouts are sent to the verified payout method on your seller profile. Keep it current; failed payouts caused by outdated details may take extra time to reissue.",
                "Payouts on orders under active investigation are held until the review concludes.",
              ]}
            />
          </Section>

          <Section title="6. Disputes & Penalties">
            <p>
              When a buyer disputes an order, we review the on-platform
              evidence from both sides. Outcomes include full or partial
              refunds, release of funds to you, or a shared resolution.
            </p>
            <p>
              Repeated loss of disputes, patterned late delivery, or resale of
              disputed goods before resolution leads to strikes, listing
              restrictions, and eventual suspension. Serious violations
              (fraud, stolen goods) skip the warnings stage entirely.
            </p>
          </Section>

          <Section title="7. Relationship & Changes">
            <p>
              Sellers are independent participants on the marketplace — not
              employees, agents, or partners of RomdoulKHShop. These
              guidelines supplement the main{" "}
              <Link href="/terms" className="text-royal underline hover:text-gold">
                Terms of Service
              </Link>
              , and we may update them with notice on the seller dashboard.
              Continued selling after an update takes effect means you accept
              the changes.
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
