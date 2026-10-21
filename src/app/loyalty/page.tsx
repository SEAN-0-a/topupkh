import PlaceholderPage from "@/components/PlaceholderPage";

export default function LoyaltyPage() {
  return (
    <PlaceholderPage
      emoji="🎁"
      title="Loyalty"
      description="We're cooking up a loyalty program — earn points on every TopUpKH order and redeem them for discounts. Watch this space."
      links={[
        { href: "/marketplace", label: "Browse the marketplace" },
        { href: "/settings", label: "Account settings" },
      ]}
    />
  );
}
