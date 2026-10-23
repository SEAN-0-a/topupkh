/**
 * UI translations for TopUpKH — English (en) and Khmer (km).
 *
 * Key-based dictionary consumed by LanguageContext's `t(key)` helper:
 * missing km entries fall back to English, and unknown keys render the key
 * string itself as a last resort (never undefined/blank).
 *
 * Placeholders: `{name}`, `{n}`, `{total}` — replaced by the caller (e.g.
 * the shared <T k="…" vars={{ … }} /> component).
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

  // ---- marketplace header / search ----
  "market.header": "Marketplace",
  "market.subtitle_all": "All games & categories",
  "market.approved_count": "{n} approved product{s}",
  "market.search_placeholder": "Search products…",
  "market.search_btn": "Search",

  // ---- filters ----
  "market.filters": "Filters",
  "market.filter_game": "Game",
  "market.filter_category": "Category",
  "market.filter_price": "Price (USD)",
  "market.filter_delivery": "Delivery method",
  "market.filter_sort": "Sort by",
  "market.all_games": "All games",
  "market.all_categories": "All categories",
  "market.any_method": "Any method",
  "market.delivery_in_game": "Delivered in game",
  "market.delivery_instructions": "Guided instructions",
  "market.delivery_digital_file": "Digital file",
  "market.delivery_creator_service": "Creator service",
  "market.sort_popular": "Most popular",
  "market.sort_newest": "Newest",
  "market.sort_price_asc": "Price: low → high",
  "market.sort_price_desc": "Price: high → low",
  "market.sort_top_rated": "Top rated",
  "market.min": "min",
  "market.max": "max",
  "market.go_btn": "Go",
  "market.clear_filters": "Clear all filters",
  "market.loading_filters": "· loading…",

  // ---- marketplace states ----
  "market.no_results": "No products match these filters yet.",
  "market.no_results_hint": "Try clearing filters, or check back — new offers from verified sellers are published instantly.",
  "market.prev": "← Prev",
  "market.next": "Next →",
  "market.page_of": "Page {n} of {total}",
  "prohibited.title": "🚫 “{name}” is not available for trading on TopUpKH",
  "prohibited.reason":
    "This is a platform policy enforced in the database — listings in this category cannot be published or purchased. If you believe an exception applies (e.g. you hold written authorization), contact support to have an admin review the eligibility rule.",
  "market.browse_categories": "Browse available categories",
  "market.contact_support": "Contact support",

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

  // ---- wallet / payouts ----
  "wallet.available_balance": "Available Balance",
  "wallet.pending_escrow": "Pending Escrow Balance",
  "wallet.request_payout": "Request Payout",
  "wallet.history": "Withdrawal history",
  "wallet.empty_history": "No withdrawal requests yet.",

  // ---- seller offer creation ----
  "sell.form_title": "Create a seller offer",
  "sell.form_banner":
    "Your offer goes on a shared product page where buyers compare all sellers by price and delivery speed. Funds are held in escrow until delivery is confirmed — the platform commission is deducted at settlement, never upfront.",
  "sell.form_banner_create":
    "Build a full Eldorado-style listing: gallery, specs (original email, warranty, delivery time, inventory value) and a Markdown description. Funds are held in escrow until the delivery is confirmed — commission is deducted at settlement, never upfront.",
  "sell.step1": "1 · What are you offering",
  "sell.step2": "2 · Listing details",
  "sell.step3": "3 · Price, stock & delivery",
  "sell.step4": "4 · Policies",
  "sell.f_title_label": "Title (this becomes the shared product page name — 5–120 chars)",
  "sell.f_title_placeholder": "e.g. Roblox UI Kit — Dark Theme, 40 components",
  "sell.f_desc_label": "Description (Markdown supported — see the formatting tips below)",
  "sell.f_desc_placeholder": "Describe exactly what is included…",
  "sell.f_game_name_label": "Game name (shown in the offer specs — add server/region if relevant)",
  "sell.f_price_label": "Your price (USD)",
  "sell.f_original_price_label": "Strikethrough price (optional — shows the discount badge)",
  "sell.f_delivery_time": "Delivery time estimate (free text)",
  "sell.f_delivery_time_placeholder": 'e.g. "Instant" or "1 day"',
  "sell.f_inventory_value": "Inventory value (optional — what the stock/contents are worth)",
  "sell.f_warranty": "Warranty (days — 0 = sold as-is)",
  "sell.f_original_email": "Original email included (account sales)",
  "sell.f_open_email": "Open email access (buyer can access the mail account)",
  "sell.f_delivery_method": "Delivery method",
  "sell.f_est_minutes": "Estimated fulfilment time (minutes, optional)",
  "sell.f_delivery_details": "Delivery details (what the buyer receives after payment)",
  "sell.f_refund_label": "Refund policy (shown on the offer)",
  "sell.f_ownership_label": "Ownership / authorization note (how you got the right to sell this)",
  "sell.submit": "Submit offer for review",
  "sell.submitting": "Submitting…",
};

const km: Partial<typeof en> = {
  // ---- navigation ----
  "nav.brand": "TopUpKH",
  "nav.marketplace": "ផ្សារទំនិញ",
  "nav.my_orders": "ការបញ្ជាទិញរបស់ខ្ញុំ",
  "nav.sell": "លក់",
  "nav.new_offer": "+ បង្ហោះលក់",
  "nav.verify_to_sell": "🔒 ផ្ទៀងផ្ទាត់ដើម្បីលក់",
  "nav.wallet": "💼 កាបូបប្រាក់",
  "nav.login": "ចូលគណនី",
  "nav.logout": "ចាកចេញ",
  "nav.account": "គណនីរបស់ខ្ញុំ",

  // ---- category tabs ----
  "cat.currency": "រូបិយប័ណ្ណ",
  "cat.accounts": "គណនី",
  "cat.topups": "បញ្ចូលទឹកប្រាក់",
  "cat.items": "ទំនិញ",
  "cat.boosting": "បង្កើនល្បឿន",
  "cat.gift_cards": "ប័ណ្ណជំនូន",

  // ---- marketplace header / search ----
  "market.header": "ផ្សារទំនិញ",
  "market.subtitle_all": "ហ្គេម និងប្រភេទទាំងអស់",
  "market.approved_count": "{n} ផលិតផលដែលបានអនុម័ត",
  "market.search_placeholder": "ស្វែងរកទំនិញ…",
  "market.search_btn": "ស្វែងរក",

  // ---- filters ----
  "market.filters": "តម្រង",
  "market.filter_game": "ហ្គេម",
  "market.filter_category": "ប្រភេទ",
  "market.filter_price": "តម្លៃ (USD)",
  "market.filter_delivery": "វិធីសាស្ត្រប្រគល់",
  "market.filter_sort": "តម្រៀបតាម",
  "market.all_games": "ហ្គេមទាំងអស់",
  "market.all_categories": "ប្រភេទទាំងអស់",
  "market.any_method": "គ្រប់វិធីសាស្ត្រ",
  "market.delivery_in_game": "ប្រគល់ក្នុងហ្គេម",
  "market.delivery_instructions": "ការណែនាំវិធីប្រើប្រាស់",
  "market.delivery_digital_file": "ឯកសារឌីជីថល",
  "market.delivery_creator_service": "សេវាអ្នកបង្កើត",
  "market.sort_popular": "ពេញនិយមបំផុត",
  "market.sort_newest": "ថ្មីបំផុត",
  "market.sort_price_asc": "តម្លៃ៖ ថោក → ខ្ពស់",
  "market.sort_price_desc": "តម្លៃ៖ ខ្ពស់ → ថោក",
  "market.sort_top_rated": "កំពូលវាយតម្លៃ",
  "market.min": "តិចបំផុត",
  "market.max": "ច្រើនបំផុត",
  "market.go_btn": "អនុវត្ត",
  "market.clear_filters": "សម្អាតតម្រងទាំងអស់",
  "market.loading_filters": "· កំពុងផ្ទុក…",

  // ---- marketplace states ----
  "market.no_results": "មិនមានផលិតផលត្រូវនឹងតម្រងទាំងនេះទេ។",
  "market.no_results_hint":
    "សូមព្យាយាមសម្អាតតម្រង ឬត្រឡប់មកវិញ — ផលិតផលទាំងអស់ត្រូវឆ្លងកាត់ការអនុម័តរបស់អ្នកគ្រប់គ្រងជាមុនសិន។",
  "market.prev": "← មុន",
  "market.next": "បន្ទាប់ →",
  "market.page_of": "ទំព័រ {n} / {total}",
  "prohibited.title": "🚫 “{name}” មិនអាចជួញដូរនៅលើ TopUpKH ទេ",
  "prohibited.reason":
    "នេះជាគោលនយោបាយវេទិកាដែលអនុវត្តក្នុងមូលដ្ឋានទិន្នន័យ — បញ្ជីក្នុងប្រភេទនេះមិនអាចផ្សាយ ឬទិញបានទេ។ បើអ្នកជឿថាមានលើកលែង (ឧ. មានឯកសារអនុញ្ញាតជាលាយលក្ខណ៍អក្សរ) សូមទាក់ទងជំនួយដើម្បីឱ្យអ្នកគ្រប់គ្រងពិនិត្យលក្ខខណ្ឌសិទ្ធិ។",
  "market.browse_categories": "មើលប្រភេទដែលអាចលក់បាន",
  "market.contact_support": "ទាក់ទងជំនួយ",

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
  "title.my_orders": "ការបញ្ជាទិញរបស់ខ្ញុំ",
  "title.wallet": "កាបូបប្រាក់",
  "title.cart": "ក្រឡាទិញជាដុំ",
  "title.notifications": "ការជូនដំណឹង",
  "title.messages": "សារ",
  "title.settings": "ការកំណត់",
  "title.support": "ជំនួយ",
  "title.topup": "ដាក់លុយ",

  // ---- wallet / payouts ----
  "wallet.available_balance": "ប្រាក់អាចដកបាន",
  "wallet.pending_escrow": "ប្រាក់កំពុងរក្សាទុក (Escrow)",
  "wallet.request_payout": "ស្នើសុំដកប្រាក់",
  "wallet.history": "ប្រវត្តិដកប្រាក់",
  "wallet.empty_history": "មិនទាន់មានប្រវត្តិដកប្រាក់",

  // ---- seller offer creation ----
  "sell.form_title": "បង្កើតការផ្ដល់ជូនអ្នកលក់",
  "sell.form_banner":
    "ការផ្ដល់ជូនរបស់អ្នកនឹងបង្ហាញនៅលើទំព័រផលិតផលរួម ដែលអ្នកទិញអាចប្រៀបធៀបអ្នកលក់ទាំងអស់តាមតម្លៃ និងល្បឿនប្រគល់។ ប្រាក់ត្រូវរក្សាទុកក្នុង Escrow រហូតដល់ការប្រគល់ត្រូវបានបញ្ជាក់ — កម្រៃវេទិកាត្រូវកាត់នៅពេលចប់សព្វគ្រប់ មិនមែនទូទាត់មុនឡើយ។",
  "sell.form_banner_create":
    "បង្កើតបញ្ជីបែប Eldorado ពេញលេញ៖ វិចិត្រសាលរូបភាព បញ្ជីលក្ខណៈសម្បត្តិ (អ៊ីមែលដើម ការធានា ពេលវេលាប្រគល់ តម្លៃស្តុក) និងការពណ៌នា Markdown។ ប្រាក់ត្រូវរក្សាទុកក្នុង Escrow រហូតដល់ការប្រគល់ត្រូវបានបញ្ជាក់ — កម្រៃត្រូវកាត់នៅពេលចប់ មិនទូទាត់មុនឡើយ។",
  "sell.step1": "១ - អ្វីដែលអ្នកកំពុងផ្ដល់ជូន",
  "sell.step2": "២ - ព័ត៌មានលម្អិតនៃការផ្ដល់ជូន",
  "sell.step3": "៣ - តម្លៃ ស្តុក និងការប្រគល់",
  "sell.step4": "៤ - គោលនិយាយ",
  "sell.f_title_label": "ចំណងជើង (គឺជាឈ្មោះទំព័រផលិតផលរួម — ៥–១២០ តួអក្សរ)",
  "sell.f_title_placeholder": "ឧ. Roblox UI Kit — ធីមខ្មៅ, សមាសភាគ ៤០",
  "sell.f_desc_label": "ការពណ៌នា (គាំទ្រ Markdown — សូមមើលគន្លឹះរចនានៅខាងក្រោម)",
  "sell.f_desc_placeholder": "អធិប្បាយឱ្យច្បាស់អំពីអ្វីដែលរួមបញ្ចូល…",
  "sell.f_game_name_label": "ឈ្មោះហ្គេម (បង្ហាញក្នុងលក្ខណៈសម្បត្តិ — បន្ថែមម៉ាស៊ីនបម្រើ/តំបន់បើចាំបាច់)",
  "sell.f_price_label": "តម្លៃរបស់អ្នក (USD)",
  "sell.f_original_price_label": "តម្លៃវាយដៅ (ស្រេចចិត្ត — បង្ហាញស្លាកបញ្ចុះតម្លៃ)",
  "sell.f_delivery_time": "ពេលវេលាប្រគល់ប៉ាន់ស្មាន (សរសេរសេរី)",
  "sell.f_delivery_time_placeholder": "ឧ. \"ភ្លាមៗ\" ឬ \"១ ថ្ងៃ\"",
  "sell.f_inventory_value": "តម្លៃស្តុក (ស្រេចចិត្ត — តម្លៃរបស់ទំនិញក្នុងស្តុក)",
  "sell.f_warranty": "ការធានា (ថ្ងៃ — ០ = លក់ដូចដើម)",
  "sell.f_original_email": "អ៊ីមែលដើមរួមបញ្ចូល (លក់គណនី)",
  "sell.f_open_email": "សិទ្ធិបើកអ៊ីមែល (អ្នកទិញអាចចូលប្រើអ៊ីមែល)",
  "sell.f_delivery_method": "វិធីសាស្ត្រប្រគល់",
  "sell.f_est_minutes": "ពេលវេលាប្រគល់ប៉ាន់ស្មាន (នាទី, ស្រេចចិត្ត)",
  "sell.f_delivery_details": "ព័ត៌មានលម្អិតការប្រគល់ (អ្វីដែលអ្នកទិញទទួលបានបន្ទាប់ពីទូទាត់)",
  "sell.f_refund_label": "គោលការណ៍បង្វិលសងប្រាក់ (បង្ហាញនៅលើការផ្ដល់ជូន)",
  "sell.f_ownership_label": "សម្គាល់កម្មសិទ្ធិ/ការអនុញ្ញាត (អ្នកទទួលបានសិទ្ធិលក់ពីណា)",
  "sell.submit": "ដាក់ស្នើការផ្ដល់ជូនដើម្បីពិនិត្យ",
  "sell.submitting": "កំពុងដាក់ស្នើ…",
};

export const translations: { en: typeof en; km: Partial<typeof en> } = { en, km };

/** LocalStorage key used by the LanguageProvider to remember the choice. */
export const LANG_STORAGE_KEY = "topupkh-lang";
