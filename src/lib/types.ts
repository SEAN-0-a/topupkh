import type {
  user_role,
  product_status,
  delivery_method,
  order_status,
  seller_status,
  seller_type_enum,
  verification_status_type,
  payout_status_enum,
  ticket_status,
  ticket_category,
  ticket_priority,
} from "@/lib/db-enums";
import type { Json } from "@/lib/db-types";

export type {
  user_role,
  product_status,
  delivery_method,
  order_status,
  seller_status,
  seller_type_enum,
  verification_status_type,
  payout_status_enum,
  ticket_status,
  ticket_category,
  ticket_priority,
};

/**
 * `profiles` row as readable through the public/safe column grant (0001
 * policies + 0010 column privileges). Sensitive KYC/wallet columns (phone,
 * bank details, ID paths, balances, review notes) are NOT selectable via
 * PostgREST — they come through the get_my_seller_profile() definer RPC
 * (SellerKycProfile below).
 */
export type Profile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  locale: "km" | "en";
  role: user_role;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
  seller_type?: seller_type_enum;
  shop_name?: string | null;
  verification_status?: verification_status_type;
};

/**
 * Full seller/KYC/wallet snapshot for the signed-in user, returned by the
 * get_my_seller_profile() SECURITY DEFINER RPC (migration 0010).
 */
export type SellerKycProfile = Profile & {
  phone_number: string | null;
  payout_bank_name: string | null;
  payout_account_number: string | null;
  payout_account_name: string | null;
  id_document_front_url: string | null;
  id_document_back_url: string | null;
  verification_status: verification_status_type;
  verification_note: string | null;
  verified_at: string | null;
  available_balance: number;
  pending_escrow_balance: number;
  sellers_status: seller_status | null;
  completed_sales: number;
};

/** Row of payout_requests as selected by its owner (RLS seller read). */
export type PayoutRequestRow = {
  id: string;
  seller_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: payout_status_enum;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type Game = {
  id: number;
  slug: string;
  name: string;
  icon_url: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductCategory = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  default_eligibility: "allowed" | "prohibited" | "needs_review";
  stock_model: "finite" | "unlimited";
  created_at: string;
};

export type Seller = {
  id: number;
  user_id: string;
  display_name: string;
  about: string | null;
  status: seller_status;
  payout_method: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  rating_sum: number;
  rating_count: number;
  completed_sales: number;
  rejection_note: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: number;
  seller_id: number;
  game_id: number;
  experience_id: number | null;
  category_id: number;
  template_id: number | null;
  title: string;
  description: string;
  image_url: string | null;
  price_usd: number;
  original_price_usd: number | null;
  delivery_method: delivery_method;
  delivery_details: string;
  stock: number;
  stock_is_unlimited: boolean;
  estimated_minutes: number | null;
  refund_policy: string;
  ownership_note: string;
  status: product_status;
  moderation_note: string | null;
  moderated_by: string | null;
  view_count: number;
  sold_count: number;
  rating_sum: number;
  rating_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  joined?: {
    games: Pick<Game, "name" | "slug">;
    product_categories: Pick<ProductCategory, "name" | "slug">;
    sellers: Pick<Seller, "display_name" | "rating_sum" | "rating_count" | "completed_sales">;
  };
};

export type Order = {
  id: number;
  public_ref: string;
  buyer_id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  commission_rate: number;
  platform_fee: number;
  seller_proceeds: number;
  currency: string;
  status: order_status;
  delivery_payload: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformSettingsMap = {
  commission_rate: string;
  currency_display: string;
  khr_rate_demo: string;
  min_payout_usd: string;
};

export type { Json };
