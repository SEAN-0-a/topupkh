import type {
  user_role,
  product_status,
  delivery_method,
  order_status,
  seller_status,
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
  ticket_status,
  ticket_category,
  ticket_priority,
};

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
