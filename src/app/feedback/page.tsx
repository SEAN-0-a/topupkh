import PlaceholderPage from "@/components/PlaceholderPage";

export default function FeedbackPage() {
  return (
    <PlaceholderPage
      emoji="📝"
      title="Feedback"
      description="We'd love to hear how RomdoulKHShop can improve — feedback forms, seller reviews wear-in, and disputes resolution are on the way."
      backHref="/marketplace"
      backLabel="Back to Marketplace"
      links={[
        { href: "/orders", label: "My orders" },
        { href: "/notifications", label: "Notifications" },
      ]}
    />
  );
}
