/**
 * UI translations for TopUpKH — English (en) and Khmer (km).
 *
 * Key-based dictionary consumed by LanguageContext's `t(key)` helper:
 * missing km entries fall back to English, and unknown keys render the key
 * string itself as a last resort (never undefined/blank).
 *
 * Inline pairs `t(english, khmer)` are still supported via the `tf` helper
 * for legacy call sites that haven't been keyed yet.
 */

export type Language = "en" | "km";

const en = {
  // ---- navigation ----
  "nav.brand": "TopUpKH",
  "nav.marketplace": "Marketplace",
  "nav.my_orders": "My Orders",
  "nav.sell": "Sell",
  "nav.new_offer": "+ New Offer",
  "nav.verify_to_sell": "🔒 Verify to sell",
  "nav.wallet": "💼 Wallet",
  "nav.login": "Login",
  "nav.logout": "Log out",
  "nav.account": "My account",

  // ---- category tabs ----
  "cat.currency": "Currency",
  "cat.accounts": "Accounts",
  "cat.topups": "Top Ups",
  "cat.items": "Items",
  "cat.boosting": "Boosting",
  "cat.gift_cards": "Gift Cards",

  // ---- common buttons ----
  "common.buy_now": "Buy Now",
  "common.add_to_cart": "Add to cart",
  "common.submit": "Submit",
  "common.save": "Save",
  "common.save_changes": "Save changes",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.retry": "Retry",
  "common.loading": "Loading…",
  "common.saving": "Saving…",
  "common.view_all": "View all",
  "common.price": "Price",
  "common.stock": "Stock",
  "common.sold_out": "Sold out",
  "common.escrow_protected": "Escrow protected",
  "common.seller": "Seller",

  // ---- titles / headings ----
  "title.marketplace": "Marketplace",
  "title.my_orders": "My Orders",
  "title.wallet": "Wallet",
  "title.cart": "Cart",
  "title.notifications": "Notifications",
  "title.messages": "Messages",
  "title.settings": "Settings",
  "title.support": "Support",
  "title.topup": "Top Up",

  // ---- marketplace ----
  "market.search": "Search listings…",
  "market.filters": "Filters",
  "market.all_games": "All games",
  "market.all_categories": "All categories",
  "market.sort_by": "Sort by",
  "market.no_results": "No listings found.",

  // ---- wallet / payouts ----
  "wallet.available_balance": "Available Balance",
  "wallet.pending_escrow": "Pending Escrow Balance",
  "wallet.request_payout": "Request Payout",
  "wallet.history": "Withdrawal history",
  "wallet.empty_history": "No withdrawal requests yet.",
};

const km: Partial<typeof en> = {
  // ---- navigation ----
  "nav.brand": "TopUpKH",
  "nav.marketplace": "ផ្សារទំនិញ",
  "nav.my_orders": "កំណត់ត្រាទិញ",
  "nav.sell": "លក់ Roblox",
  "nav.new_offer": "+ បង្ហោះលក់",
  "nav.verify_to_sell": "🔒 ផ្ទៀងផ្ទាត់ដើម្បីលក់",
  "nav.wallet": "កាបូបប្រាក់",
  "nav.login": "ចូលគណនី",
  "nav.logout": "ចាកចេញ",
  "nav.account": "គណនីរបស់ខ្ញុំ",

  // ---- category tabs ----
  "cat.currency": "រូបិយប័ណ្ណ",
  "cat.accounts": "គណនី",
  "cat.topups": "ដាក់លុយ",
  "cat.items": "វត្ថុ",
  "cat.boosting": "ជំនួយជើង",
  "cat.gift_cards": "ប័ណ្ណជូនពរ",

  // ---- common buttons ----
  "common.buy_now": "ទិញឥឡូវនេះ",
  "common.add_to_cart": "ដាក់ក្នុងក្រឡា",
  "common.submit": "ដាក់ស្នើ",
  "common.save": "រក្សាទុក",
  "common.save_changes": "រក្សាទុកការផ្លាស់ប្ដូរ",
  "common.cancel": "បោះបង់",
  "common.delete": "លុប",
  "common.edit": "កែសម្រួល",
  "common.retry": "ព្យាយាមម្តងទៀត",
  "common.loading": "កំពុងផ្ទុក…",
  "common.saving": "កំពុងរក្សាទុក…",
  "common.view_all": "មើលទាំងអស់",
  "common.price": "តម្លៃ",
  "common.stock": "ស្តុក",
  "common.sold_out": "អស់ស្តុក",
  "common.escrow_protected": "ការការពារ Escrow",
  "common.seller": "អ្នកលក់",

  // ---- titles / headings ----
  "title.marketplace": "ផ្សារទំនិញ",
  "title.my_orders": "កំណត់ត្រាទិញ",
  "title.wallet": "កាបូបប្រាក់",
  "title.cart": "ក្រឡាទិញជាដុំ",
  "title.notifications": "ការជូនដំណឹង",
  "title.messages": "សារ",
  "title.settings": "ការកំណត់",
  "title.support": "ជំនួយ",
  "title.topup": "ដាក់លុយ",

  // ---- marketplace ----
  "market.search": "ស្វែងរកបញ្ជី…",
  "market.filters": "តម្រង",
  "market.all_games": "ហ្គេមទាំងអស់",
  "market.all_categories": "ប្រភេទទាំងអស់",
  "market.sort_by": "តម្រៀបតាម",
  "market.no_results": "រកមិនឃើញបញ្ជី",

  // ---- wallet / payouts ----
  "wallet.available_balance": "ប្រាក់អាចដកបាន",
  "wallet.pending_escrow": "ប្រាក់កំពុងរក្សាទុក (Escrow)",
  "wallet.request_payout": "ស្នើសុំដកប្រាក់",
  "wallet.history": "ប្រវត្តិដកប្រាក់",
  "wallet.empty_history": "មិនទាន់មានប្រវត្តិដកប្រាក់",
};

export const translations: { en: typeof en; km: Partial<typeof en> } = { en, km };

/** LocalStorage key used by the LanguageProvider to remember the choice. */
export const LANG_STORAGE_KEY = "topupkh-lang";
