// =============================================================================
// info-content.ts — the content library behind /info/[slug]
// =============================================================================
// Every footer info page is defined here as structured blocks, rendered by
// src/app/info/[slug]/page.tsx. Core policy pages (TradeShield, withdrawals,
// refund policy, fees, contact) are written for CAMBODIAN commerce reality:
// USD/KHR dual pricing, Bakong/ABA KHQR payments, Phnom Penh ICT hours, and
// local banking (ABA Bank, Wing) — adapted from Eldorado's escrow/fee/anti-
// fraud structure. Secondary pages stay shorter but still real.
// =============================================================================

export type Block =
  | { type: "p"; text: string }
  | { type: "callout"; tone: "emerald" | "amber" | "sky" | "red"; text: string }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "bullets"; items: string[] }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { type: "cards"; items: { title: string; text: string }[] }
  | { type: "links"; items: { href: string; label: string; text: string }[] };

export interface InfoPage {
  slug: string;
  title: string;
  subtitle: string;
  updated: string;
  blocks: Block[];
}

const UPDATED = "Last updated · November 2026";

/** Shared CTA rows reused across pages. */
const CONTACT_BLOCK: Block = {
  type: "callout",
  tone: "sky",
  text: "Need a human? Message our Telegram support (@RomdoulKHShopSupport) — daily 9:00–21:00 ICT, 24/7 for payment and escrow emergencies — or open a dispute from your order page.",
};

const SELLER_CTA: Block = {
  type: "callout",
  tone: "emerald",
  text: "Ready to sell? Verification (KYC) takes about one business day, and your first listing can go live the same week. Start at /seller/register.",
};

// -----------------------------------------------------------------------------
// CORE PAGES — detailed, Cambodia-tailored
// -----------------------------------------------------------------------------

const TRADESHIELD_BUYING: InfoPage = {
  slug: "tradeshield-buying",
  title: "TradeShield for Buyers",
  subtitle:
    "Every purchase on RomdoulKHShop is protected by escrow. Your money is held safely until your digital item is delivered and confirmed — the seller never touches it first.",
  updated: UPDATED,
  blocks: [
    {
      type: "callout",
      tone: "emerald",
      text: "🔒 Golden rule: NEVER pay a seller directly via Telegram, Messenger, or a personal KHQR code. Payments made outside TradeShield are not protected and cannot be refunded.",
    },
    { type: "p", text: "TradeShield is our built-in buyer protection for gaming top-ups, digital codes, and game accounts. When you check out, your payment (USD via KHQR through ABA PayWay, or KHR through Bakong) goes into a protected escrow balance — not to the seller. The seller is paid only after your item is delivered and you confirm it works." },
    {
      type: "steps",
      items: [
        { title: "1 · You pay into escrow", text: "Scan the KHQR at checkout (ABA PayWay or Bakong). USD is the listing currency; KHR is accepted at the Bakong reference rate shown before you pay." },
        { title: "2 · The seller delivers", text: "The seller sends your code, top-up, or account details through the order page within the delivery time stated on the listing — always inside RomdoulKHShop, never over Telegram." },
        { title: "3 · You check the item", text: "Test the code or log in promptly. You have at least 24 hours to inspect, and accounts carry a warranty window (see Account Warranty)." },
        { title: "4 · Funds release or refund", text: "Happy? Confirm receipt and the seller is paid. Problem? Open a dispute within the inspection window — escrow freezes and our staff review the evidence." },
      ],
    },
    {
      type: "table",
      caption: "What TradeShield covers",
      headers: ["Covered", "Not covered"],
      rows: [
        ["Code is invalid, already redeemed, or region-locked without disclosure", "You confirmed delivery, then changed your mind"],
        ["Seller never delivers within the stated time + 24h grace", "Game ban caused by your own account misuse after delivery"],
        ["Wrong product delivered (different game, package, or amount)", "Off-platform payments (Telegram, direct KHQR)"],
        ["Account reclaimed or email recovered by the seller during warranty", "Damage from sharing the account with friends after delivery"],
      ],
    },
    { type: "p", text: "Disputes are reviewed by our Phnom Penh support team in Khmer or English, normally within 24 hours (ICT). If the evidence supports you, the escrowed amount is refunded to your RomdoulKHShop wallet instantly, or to your original KHQR payment source within 3–5 business days." },
    CONTACT_BLOCK,
  ],
};

const TRADESHIELD_SELLING: InfoPage = {
  slug: "tradeshield-selling",
  title: "TradeShield for Sellers",
  subtitle:
    "TradeShield also protects sellers: buyers pay first into escrow, so you deliver knowing the money is already secured — and it releases automatically once delivery is confirmed.",
  updated: UPDATED,
  blocks: [
    { type: "p", text: "When a buyer checks out, their USD/KHR payment is held in escrow before you deliver anything. Deliver correctly, and the money is released to your wallet balance — ready to withdraw to ABA Bank, Wing, or any Bakong-connected account." },
    {
      type: "steps",
      items: [
        { title: "1 · Order arrives", text: "You get a notification with the buyer's requirements. The buyer's payment is already secured in escrow." },
        { title: "2 · Deliver inside RomdoulKHShop", text: "Send the code, top-up proof, or account details through the order page within your listing's stated delivery time. Attach screenshots as delivery proof — they decide disputes." },
        { title: "3 · Buyer confirms", text: "Funds release when the buyer confirms receipt. If they don't respond, escrow auto-releases 72 hours after you mark the delivery complete (buyers can extend this once)." },
        { title: "4 · Withdraw anytime", text: "Released funds move to your available balance. Request payout to ABA, Wing, or Bakong/KHQR — see Withdrawals." },
      ],
    },
    {
      type: "callout",
      tone: "amber",
      text: "⚠️ A dispute freezes the escrowed amount until staff rule. Keep delivery proof (screenshots, videos of the code working) inside the order page — that evidence wins disputes.",
    },
    {
      type: "bullets",
      items: [
        "Deliver exactly what the listing promises — game, package size, region, and warranty days.",
        "Never ask buyers to pay outside TradeShield; that voids your TradeShield seller coverage and is grounds for suspension.",
        "Honor your stated warranty: if an account you sold is reclaimed during the warranty window, the buyer is refunded.",
        "Repeat disputes or evidence of fraud lead to wallet holds and account suspension.",
      ],
    },
    { type: "p", text: "TradeShield commission (5%) is deducted when escrow releases — there are no listing fees and no charge to publish offers." },
    SELLER_CTA,
    CONTACT_BLOCK,
  ],
};

const WITHDRAWALS: InfoPage = {
  slug: "withdrawals",
  title: "Withdrawals & Payouts",
  subtitle:
    "Get your seller balance out to Cambodian bank accounts and mobile wallets — ABA, Wing, or any bank through Bakong/KHQR. Requested in USD, paid in USD or KHR, your choice.",
  updated: UPDATED,
  blocks: [
    { type: "p", text: "Sales revenue sits in your available balance after escrow releases. Request a withdrawal from your Wallet page, review our staff confirm the payout details match your verified KYC, and the transfer goes out." },
    {
      type: "table",
      caption: "Payout methods",
      headers: ["Method", "Fee", "Timeline"],
      rows: [
        ["ABA Bank account (internal transfer)", "Free", "Same business day"],
        ["Any Cambodian bank via Bakong / KHQR", "Free (Bakong network)", "1–2 business days"],
        ["Wing Money wallet", "1% (min $0.50)", "Within 24 hours"],
      ],
    },
    {
      type: "bullets",
      items: [
        "Minimum withdrawal: $5.00 (or ៛20,000 KHR equivalent).",
        "Requests are processed Monday–Saturday, 9:00–17:00 ICT (Phnom Penh). Khmer New Year, Pchum Ben, and other public holidays add 1–2 business days.",
        "The payout account name must match your verified KYC documents exactly — payouts to third-party accounts are rejected.",
        "KHR payouts are converted at the Bakong reference rate on the processing day; the applied rate is shown in your payout record.",
        "First-time withdrawals, or payouts to a newly changed bank account, are held for an extra 24-hour security review.",
      ],
    },
    {
      type: "callout",
      tone: "amber",
      text: "⚠️ Funds still in escrow (pending orders or open disputes) are not withdrawable yet — only released balances are.",
    },
    { type: "p", text: "You can track every payout in Wallet → Payout History. If a transfer is late beyond the stated timeline, message support with your payout reference — ABA/Bakong traces usually resolve within one business day." },
    CONTACT_BLOCK,
  ],
};

const REFUND_POLICY: InfoPage = {
  slug: "refund-policy",
  title: "Refund Policy",
  subtitle:
    "Clear, standardized refund terms for digital goods — when you get your money back, how fast, and where it lands.",
  updated: UPDATED,
  blocks: [
    { type: "p", text: "Digital items are judged on one standard: does it work, exactly as the listing promised? These terms apply to all purchases on RomdoulKHShop and follow Cambodian consumer standards — the buyer is protected against items that don't function, aren't delivered, or don't match the listing." },
    {
      type: "cards",
      items: [
        { title: "Full refund", text: "Code invalid, already redeemed, or wrong region (when not disclosed) · wrong product delivered · item never delivered within stated time + 24h grace · account reclaimed or email-recovered by the seller during its warranty window." },
        { title: "Partial refund", text: "Item works but materially differs from the listing (e.g. smaller package, missing bonuses) — refund equals the difference, settled by staff during the dispute." },
        { title: "No refund", text: "You confirmed delivery and the item worked · refund requested after redeeming/misusing the product · bans caused by your own gameplay, sharing, or cheating after delivery · change of mind once a code is visible to you." },
      ],
    },
    {
      type: "steps",
      items: [
        { title: "1 · Open a dispute", text: "From Orders → the specific order, within the inspection window (24h minimum; warranty-period claims anytime within warranty)." },
        { title: "2 · Evidence review", text: "Staff review delivery proof from both sides within 24 hours (ICT). Screenshots/video of the failing code speed this up." },
        { title: "3 · Outcome", text: "Approved refunds land in your RomdoulKHShop wallet instantly (reusable on any listing), or return to your original KHQR source within 3–5 business days on request." },
      ],
    },
    {
      type: "callout",
      tone: "sky",
      text: "💱 KHR refunds are returned at the Bakong reference rate on the refund day — the applied rate appears in your refund record.",
    },
    CONTACT_BLOCK,
  ],
};

const FEES: InfoPage = {
  slug: "fees",
  title: "Fees & Commissions",
  subtitle: "Transparent, published pricing. No listing fees, no hidden cuts — what you see is what everyone pays.",
  updated: UPDATED,
  blocks: [
    {
      type: "table",
      caption: "Seller fees",
      headers: ["Fee", "Amount", "When"],
      rows: [
        ["Publishing a listing", "Free", "Always"],
        ["TradeShield commission", "5% of sale price", "Deducted when escrow releases"],
        ["Withdrawal — ABA internal", "Free", "Per payout"],
        ["Withdrawal — Bakong/KHQR to other banks", "Free", "Per payout"],
        ["Withdrawal — Wing", "1% (min $0.50)", "Per payout"],
      ],
    },
    {
      type: "table",
      caption: "Buyer fees",
      headers: ["Fee", "Amount"],
      rows: [
        ["KHQR payment (ABA PayWay / Bakong)", "Free"],
        ["Listing price markup", "None — you pay the listed price"],
        ["Dispute filing", "Free"],
      ],
    },
    {
      type: "bullets",
      items: [
        "Example: on a $10.00 sale, the 5% commission ($0.50) is deducted at release — $9.50 lands in your available balance.",
        "Prices are set in USD. KHR amounts displayed at checkout use the Bakong reference rate at payment time; sellers receive USD unless they choose a KHR payout.",
        "Commission or payout-fee changes are announced on this page at least 14 days before taking effect; sales already in escrow keep the fee in force when you listed.",
      ],
    },
    CONTACT_BLOCK,
  ],
};

const CONTACT_US: InfoPage = {
  slug: "contact-us",
  title: "Contact Us",
  subtitle:
    "Real support from Phnom Penh — in Khmer and English, on the channels Cambodians actually use.",
  updated: UPDATED,
  blocks: [
    {
      type: "cards",
      items: [
        { title: "💬 Telegram (primary)", text: "@RomdoulKHShopSupport — fastest channel. Daily 9:00–21:00 ICT. Payment, escrow, and login emergencies: 24/7." },
        { title: "📦 Order disputes", text: "Open directly from Orders → your order. Disputes route straight to staff with the delivery evidence attached — fastest way to a refund ruling." },
        { title: "📧 Email", text: "support@romdoulkhshop.com — replies within one business day (ICT). Include your order reference (RMK-XXXX)." },
        { title: "🌐 In-app messaging", text: "Use the message icon in the header to reach support or a seller without leaving the site." },
      ],
    },
    {
      type: "bullets",
      items: [
        "Support hours: 9:00–21:00 ICT, seven days a week (Phnom Penh time). Escrow/payment emergencies answered 24/7.",
        "We reply in Khmer or English — your choice.",
        "Never share your password or OTP with anyone, including support. Staff will never ask for them.",
        "Business correspondence: RomdoulKHShop, Phnom Penh, Cambodia.",
      ],
    },
    {
      type: "callout",
      tone: "red",
      text: "🚨 Beware of fake support accounts. Our staff never DM first from personal accounts and never ask for payment outside the platform. Verify the handle before sending anything.",
    },
  ],
};

// -----------------------------------------------------------------------------
// SECONDARY PAGES — concise, still real
// -----------------------------------------------------------------------------

const HELP_CENTER: InfoPage = {
  slug: "help-center",
  title: "Help Center",
  subtitle: "Start here — the shortest path to the answer or policy you need.",
  updated: UPDATED,
  blocks: [
    {
      type: "links",
      items: [
        { href: "/info/tradeshield-buying", label: "TradeShield for Buyers", text: "How escrow protects your payment until delivery is confirmed." },
        { href: "/info/tradeshield-selling", label: "TradeShield for Sellers", text: "Escrow release, delivery proof, and payout flow." },
        { href: "/info/withdrawals", label: "Withdrawals", text: "ABA / Wing / Bakong payout options and timelines." },
        { href: "/info/refund-policy", label: "Refund Policy", text: "When you get a refund and how fast it arrives." },
        { href: "/info/fees", label: "Fees", text: "Full commission and transaction fee breakdown." },
        { href: "/info/account-warranty", label: "Account Warranty", text: "Warranty windows and the reclaim process." },
        { href: "/info/seller-rules", label: "Seller Rules", text: "Marketplace conduct rules and prohibited items." },
        { href: "/info/changing-username", label: "Changing Username", text: "How to request a username change." },
      ],
    },
    CONTACT_BLOCK,
  ],
};

const ABOUT_US: InfoPage = {
  slug: "about-us",
  title: "About Us",
  subtitle: "Cambodia's gaming top-up marketplace — built in Phnom Penh, for Khmer gamers.",
  updated: UPDATED,
  blocks: [
    { type: "p", text: "RomdoulKHShop started with a simple frustration: buying game credits in Cambodia meant trusting strangers over Telegram, sending KHQR first and hoping the code actually worked. We built the marketplace we wished existed — KHQR payments (ABA PayWay and Bakong), escrow that holds funds until delivery is confirmed, and sellers who are verified before they can list." },
    {
      type: "bullets",
      items: [
        "What we sell: gaming top-ups, digital codes, game accounts, and P2P digital items — Roblox, PUBG Mobile, Free Fire, Mobile Legends and more.",
        "Where we operate: Cambodia, with support in Khmer and English from Phnom Penh (ICT, UTC+7).",
        "How we keep it safe: KYC-verified sellers, TradeShield escrow on every order, and a dispute team that rules on evidence, not reputation.",
      ],
    },
    { type: "p", text: "Romdoul (រំដួល) — the fragrant Cambodian flower — because trust, like scent, is hard to fake and impossible to hide." },
  ],
};

const CAREERS: InfoPage = {
  slug: "careers",
  title: "Careers",
  subtitle: "Help build Cambodia's safest digital marketplace.",
  updated: UPDATED,
  blocks: [
    {
      type: "cards",
      items: [
        { title: "Support Agent (Khmer/English)", text: "Phnom Penh or remote · shifts within 9:00–21:00 ICT · dispute handling and Telegram support." },
        { title: "Trust & Safety Moderator", text: "Remote · review listings, delivery evidence, and fraud signals." },
        { title: "Community & Content (Khmer)", text: "Remote · TikTok/Telegram community, game guides, campaign content." },
      ],
    },
    { type: "p", text: "Send a short intro + CV to support@romdoulkhshop.com with the role in the subject line, or message @RomdoulKHShopSupport on Telegram. Applications are reviewed within one week (ICT)." },
  ],
};

const BUG_BOUNTY: InfoPage = {
  slug: "bug-bounty",
  title: "Bug Bounty",
  subtitle: "Found a security hole? Report it responsibly and earn from your wallet balance.",
  updated: UPDATED,
  blocks: [
    {
      type: "table",
      caption: "Rewards (paid in USD to your RomdoulKHShop wallet)",
      headers: ["Severity", "Examples", "Reward"],
      rows: [
        ["Critical", "Auth bypass, escrow manipulation, cross-tenant data access", "$100–$200"],
        ["High", "Broken access control on orders/payouts, SQLi, stored XSS", "$50–$100"],
        ["Medium", "CSRF on sensitive actions, info disclosure", "$20–$50"],
        ["Low", "Reflected XSS, missing rate limits", "$10–$20"],
      ],
    },
    {
      type: "bullets",
      items: [
        "In scope: romdoulkhshop.com web app and API. Out of scope: brute force, automated scanning, social engineering, Denial of Service.",
        "Report to support@romdoulkhshop.com with reproduction steps. First reporter wins.",
        "Give us 30 days to fix before public disclosure. No testing against real users' accounts.",
      ],
    },
    CONTACT_BLOCK,
  ],
};

const BLOG: InfoPage = {
  slug: "blog",
  title: "Blog",
  subtitle: "Guides, price trackers, and safety explainers for Khmer gamers.",
  updated: UPDATED,
  blocks: [
    { type: "p", text: "We publish game top-up guides, Robux/PUBG UC price roundups, scam-pattern warnings, and seller success stories. The blog section is being written now — in the meantime, the Help Center and our Telegram channel carry the freshest announcements." },
    {
      type: "links",
      items: [
        { href: "/info/help-center", label: "Help Center", text: "All policies in one place." },
        { href: "/info/tradeshield-buying", label: "TradeShield", text: "How escrow protects every order." },
      ],
    },
  ],
};

const INFLUENCER_PROGRAM: InfoPage = {
  slug: "influencer-program",
  title: "Influencer Program",
  subtitle: "Khmer content creators — earn commission on every sale your audience makes.",
  updated: UPDATED,
  blocks: [
    {
      type: "bullets",
      items: [
        "Who: TikTok / Facebook / YouTube / Telegram creators with 5,000+ followers and gaming-focused content.",
        "How it works: you get a tracked link or promo code; every completed escrow order through it earns you commission (paid to your wallet balance, withdrawable like any seller payout).",
        "Commission: 5% of the first 30 days of purchases from your referred buyers, tiered up to 8% for top partners.",
        "Requirements: original Khmer content, disclosure that it's sponsored, and no scam-style promotion (we check).",
      ],
    },
    { type: "p", text: "Apply via @RomdoulKHShopSupport on Telegram with your channel links. Review takes 2–3 business days (ICT)." },
  ],
};

const BECOME_AFFILIATE: InfoPage = {
  slug: "become-an-affiliate",
  title: "Become an Affiliate",
  subtitle: "No camera needed — share your referral link, earn on completed orders.",
  updated: UPDATED,
  blocks: [
    {
      type: "bullets",
      items: [
        "Generate your referral link from your account settings — no minimum audience required.",
        "Earn commission on completed (escrow-released) orders from buyers who joined through your link, for their first 30 days.",
        "Commissions land in your RomdoulKHShop wallet and can be withdrawn via ABA / Wing / Bakong.",
        "Self-referrals, spam, and fake orders are disqualified and forfeit earnings.",
      ],
    },
    CONTACT_BLOCK,
  ],
};

const BECOME_SELLER: InfoPage = {
  slug: "become-a-seller",
  title: "Become a Seller",
  subtitle: "Sell game credits, codes, and accounts to thousands of Khmer gamers — with escrow doing the trust work for you.",
  updated: UPDATED,
  blocks: [
    {
      type: "steps",
      items: [
        { title: "1 · Register", text: "Create your account and open the seller onboarding at /seller/register." },
        { title: "2 · Verify (KYC)", text: "Submit ID documents and payout details (ABA / Wing / Bakong account in your name). Review takes about one business day." },
        { title: "3 · List & sell", text: "Publish offers with photos and delivery times. TradeShield collects the buyer's payment into escrow before you deliver — no more 'pay first, trust later'." },
      ],
    },
    {
      type: "bullets",
      items: [
        "5% commission on sales, no listing fees — full breakdown under Fees.",
        "Payouts to ABA, Wing, or any Bakong-connected bank — see Withdrawals.",
        "Read the Seller Rules and Account Seller Rules before listing.",
      ],
    },
    SELLER_CTA,
  ],
};

const ACCOUNT_WARRANTY: InfoPage = {
  slug: "account-warranty",
  title: "Account Warranty",
  subtitle: "Game accounts carry a warranty window — here is exactly what it covers and how to claim.",
  updated: UPDATED,
  blocks: [
    {
      type: "table",
      caption: "Warranty windows by category",
      headers: ["Category", "Warranty"],
      rows: [
        ["Fresh game accounts (no top-up history claim)", "Set by the seller — shown on the listing (3–30 days)"],
        ["Accounts with original email included", "Set by the seller — shown on the listing"],
        ["Top-ups and digital codes", "Until first redemption attempt + 24h"],
      ],
    },
    {
      type: "bullets",
      items: [
        "Covered: seller reclaims the account, recovers the linked email, or the credentials stop working during the warranty window — full refund.",
        "Not covered: bans from your own gameplay, sharing credentials with others, enabling two-factor on a device you later lose, or issues after the warranty window ends.",
        "Claim: open a dispute from the order page with screenshots of the failure — staff rule within 24h (ICT).",
        "Sellers must disclose account history honestly; hidden bans or reclaim history void the seller's dispute protection.",
      ],
    },
    CONTACT_BLOCK,
  ],
};

const ACCOUNT_SELLER_RULES: InfoPage = {
  slug: "account-seller-rules",
  title: "Account Seller Rules",
  subtitle: "Extra rules for selling game accounts — ownership, disclosure, and binding removal.",
  updated: UPDATED,
  blocks: [
    {
      type: "bullets",
      items: [
        "Own it: you may only sell accounts you created or legitimately acquired. Selling stolen, hijacked, recovered, or fraudulently obtained accounts is an immediate permanent ban and a report to authorities where applicable.",
        "Disclose honestly: list the real server/region, level, skins/inventory value, linked email status, and any previous bans. Omissions that materially mislead the buyer are refundable at the buyer's option.",
        "Full handover: at delivery, transfer all credentials you control — linked email + password, and remove or hand over any recovery phone. Keeping a recovery path after sale counts as a warranty reclaim.",
        "No binding tricks: binding the account to a second device/number you still control after sale is prohibited and treated as fraud.",
        "Warranty is binding: the warranty days you state on the listing are a commitment, not a suggestion.",
      ],
    },
    {
      type: "callout",
      tone: "red",
      text: "🚨 Violations freeze your wallet pending review. Fraud (stolen accounts, reclaim scams) means permanent ban and forfeiture of disputed escrow to the buyer.",
    },
    CONTACT_BLOCK,
  ],
};

const SELLER_RULES: InfoPage = {
  slug: "seller-rules",
  title: "Seller Rules",
  subtitle: "The marketplace conduct rules — what you may sell, how you must deliver, and what gets you banned.",
  updated: UPDATED,
  blocks: [
    {
      type: "bullets",
      items: [
        "Deliver inside RomdoulKHShop only. Off-platform payment requests (Telegram, direct KHQR) are prohibited and unprotected for both sides.",
        "Deliver within your stated time. Mark delivery complete only when the item is actually in the buyer's hands.",
        "List honestly: real photos of the actual item, correct game/package/region, real stock counts. Stock you can't deliver gets the order refunded and strikes your account.",
        "Prohibited items: stolen accounts, shared/revolving subscriptions, hacked or generated codes, account boosting using cheats/hacks, real-money gambling, and anything illegal under Cambodian law.",
        "One strike policy for fraud; three delivery-failure strikes in 30 days suspend listing rights.",
        "Keep KYC payout details current — payouts to mismatched names are held for review.",
      ],
    },
    {
      type: "links",
      items: [
        { href: "/info/account-seller-rules", label: "Account Seller Rules", text: "Extra rules for selling game accounts." },
        { href: "/info/tradeshield-selling", label: "TradeShield for Sellers", text: "Escrow flow, delivery proof, and dispute handling." },
      ],
    },
  ],
};

const CHANGE_USERNAME: InfoPage = {
  slug: "changing-username",
  title: "Changing Username",
  subtitle: "How to request a username change without losing your history.",
  updated: UPDATED,
  blocks: [
    {
      type: "steps",
      items: [
        { title: "1 · Request", text: "Message @RomdoulKHShopSupport on Telegram from your registered contact, or email support@romdoulkhshop.com with your current username and the new one." },
        { title: "2 · Review", text: "Usernames are unique marketplace identities (buyers recognize their sellers), so staff check the new handle for impersonation of other sellers or brands. Usually within one business day." },
        { title: "3 · Done", text: "Your order history, ratings, and wallet stay attached to the account — only the handle changes." },
      ],
    },
    {
      type: "bullets",
      items: [
        "First change is free; further changes may carry a small fee to deter impersonation.",
        "Usernames impersonating staff, brands, or other sellers are rejected.",
      ],
    },
  ],
};

const PWA: InfoPage = {
  slug: "app-on-iphone-pwa",
  title: "App on iPhone (PWA)",
  subtitle: "Install RomdoulKHShop on your iPhone home screen — no App Store needed.",
  updated: UPDATED,
  blocks: [
    {
      type: "steps",
      items: [
        { title: "1 · Open in Safari", text: "Go to romdoulkhshop.com in Safari (required — Chrome on iOS can't install PWAs)." },
        { title: "2 · Share → Add to Home Screen", text: "Tap the Share button, scroll, and choose 'Add to Home Screen'." },
        { title: "3 · Launch like an app", text: "The RomdoulKHShop icon opens full-screen with your session kept — order tracking, escrow status, and KHQR checkout in one tap." },
      ],
    },
    { type: "p", text: "Android users can install the same way via Chrome → ⋮ → 'Add to Home screen'. Notifications for escrow releases and order updates arrive through Telegram — join the official channel." },
  ],
};

const TERMS: InfoPage = {
  slug: "terms",
  title: "Terms of Service",
  subtitle: "The framework for using RomdoulKHShop — summary here, full document one click away.",
  updated: UPDATED,
  blocks: [
    {
      type: "bullets",
      items: [
        "RomdoulKHShop is a marketplace: sellers list digital goods, buyers pay into TradeShield escrow, funds release on confirmed delivery.",
        "Accounts are personal — one person, no sharing of seller accounts; KYC identity must be real.",
        "Payments are USD-denominated (KHR accepted at Bakong reference rate) via KHQR only — off-platform payment is prohibited and unprotected.",
        "Governing framework: Cambodian marketplace and consumer standards; disputes are first mediated by our staff team in Phnom Penh (ICT).",
      ],
    },
    {
      type: "callout",
      tone: "sky",
      text: "📄 The complete Terms of Service document lives at /terms — the full seller contract is at /seller-terms.",
    },
  ],
};

const PRIVACY: InfoPage = {
  slug: "privacy",
  title: "Privacy Policy",
  subtitle: "What data we hold, why, and how Cambodian users stay in control.",
  updated: UPDATED,
  blocks: [
    {
      type: "bullets",
      items: [
        "We store what trading requires: account identity (email, display name, avatar), KYC documents for sellers (encrypted, staff-access only), order records, and payment references — never your KHQR PIN or bank passwords.",
        "KYC documents are used solely for payout verification and fraud prevention.",
        "Session cookies keep you signed in; analytics are aggregate only.",
        "Full document: /privacy.",
      ],
    },
    CONTACT_BLOCK,
  ],
};

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

export const INFO_PAGES: Record<string, InfoPage> = Object.fromEntries(
  [
    TRADESHIELD_BUYING,
    TRADESHIELD_SELLING,
    WITHDRAWALS,
    REFUND_POLICY,
    FEES,
    CONTACT_US,
    HELP_CENTER,
    ABOUT_US,
    CAREERS,
    BUG_BOUNTY,
    BLOG,
    INFLUENCER_PROGRAM,
    BECOME_AFFILIATE,
    BECOME_SELLER,
    ACCOUNT_WARRANTY,
    ACCOUNT_SELLER_RULES,
    SELLER_RULES,
    CHANGE_USERNAME,
    PWA,
    TERMS,
    PRIVACY,
  ].map((p) => [p.slug, p]),
);

export const INFO_SLUGS = Object.keys(INFO_PAGES);

export function getInfoPage(slug: string): InfoPage | null {
  return INFO_PAGES[slug] ?? null;
}
