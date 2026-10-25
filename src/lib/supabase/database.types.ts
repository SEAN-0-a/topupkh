/**
 * Hand-maintained Supabase `Database` types for the PAYMENTS plane
 * (docs/PAYMENTS.md §4 — the ABA webhook + Top-Up Crediting Engine).
 *
 * ⚠️ Keep this file in lock-step with `supabase/migrations/` — every group of
 * columns below quotes the migration that defines it:
 *   orders / profiles / payment tables / notifications → 0001_marketplace_schema.sql
 *   products.template_id                               → 0007_product_offers.sql
 *   game_name / original_email / open_email_access /
 *   warranty_days / delivery_time / inventory_value / images → 0013
 *   voucher_codes + fulfillment_events + claim_voucher_codes() → 0022
 *     topup_crediting.sql
 *
 * §4 status-name mapping (the DB enum has no literal uppercase values):
 *   engine FULFILLED           → order_status "delivering"/"delivered"
 *                                (delivery_payload holds the credited codes)
 *   engine COMPLETED           → order_status "completed"
 *   engine NEEDS_MANUAL_REVIEW → order_status "needs_manual_review"
 *
 * Only postgrest-reachable tables used by these flows are declared. New
 * `createSupabaseAdminClient()` callers touching another table must extend
 * THIS (or swap in `supabase gen types` output) — a missing table is a
 * compile error, which is exactly the point of typing the client.
 */

import type { Json } from "@/lib/db-types";
import type {
  order_status,
  product_status,
  delivery_method,
  user_role,
} from "@/lib/db-enums";

/** payment_status enum — 0001_marketplace_schema.sql (0001 line 58). */
export type payment_status = "pending" | "confirmed" | "failed" | "cancelled" | "refunded";
/** voucher_code_status enum — 0022_topup_crediting.sql. */
export type voucher_code_status = "available" | "claimed";

/* ------------------------------------------------------------------ orders */

type OrdersRow = {
  id: number;
  /** 'KH-000123' — unique, provider-facing transaction key. */
  public_ref: string;
  buyer_id: string;
  product_id: number;
  quantity: number;
  /** money snapshots — server-recomputed at creation (migration 0002 guard). */
  unit_price: number;
  subtotal: number;
  commission_rate: number;
  platform_fee: number;
  seller_proceeds: number;
  currency: string;
  status: order_status;
  /** seller or crediting-engine payload; order pages render it raw. */
  delivery_payload: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrdersInsert = {
  buyer_id: string;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  commission_rate: number;
  platform_fee: number;
  seller_proceeds: number;
  currency?: string;
  status?: order_status;
  delivery_payload?: string | null;
};

type OrdersUpdate = Partial<OrdersRow>;

/* ---------------------------------------------------------------- products */

type ProductsRow = {
  id: number;
  seller_id: number;
  game_id: number;
  experience_id: number | null;
  category_id: number;
  template_id: number | null; // 0007
  title: string;
  description: string;
  game_name: string | null; // 0013
  image_url: string | null;
  images: string[]; // 0013
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
  original_email: boolean; // 0013
  open_email_access: boolean; // 0013
  warranty_days: number; // 0013
  delivery_time: string | null; // 0013
  inventory_value: string | null; // 0013
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type ProductsInsert = {
  seller_id: number;
  game_id: number;
  category_id: number;
  title: string;
  description?: string;
  image_url?: string | null;
  price_usd: number;
  original_price_usd?: number | null;
  delivery_method?: delivery_method;
  delivery_details?: string;
  stock?: number;
  stock_is_unlimited?: boolean;
  estimated_minutes?: number | null;
  refund_policy?: string;
  ownership_note?: string;
  status?: product_status;
};

type ProductsUpdate = Partial<ProductsRow>;

/* ----------------------------------------------------- voucher codes (0022) */

type VoucherCodesRow = {
  id: number;
  product_id: number;
  /** the secret pin delivered to the buyer — never logged raw. */
  code: string;
  status: voucher_code_status;
  claimed_by_order_id: number | null;
  claimed_at: string | null;
  created_at: string;
};

type VoucherCodesInsert = {
  product_id: number;
  code: string;
  status?: voucher_code_status;
};

type VoucherCodesUpdate = Partial<VoucherCodesRow>;

/* ------------------------------------------------ fulfillment events (0022) */

type FulfillmentEventsRow = {
  id: number;
  order_id: number;
  event_type: string;
  /** masked refs/counts only — the order row owns the raw codes. */
  detail: Json;
  created_at: string;
};

type FulfillmentEventsInsert = {
  order_id: number;
  event_type: string;
  detail?: Json;
};

type FulfillmentEventsUpdate = Partial<FulfillmentEventsRow>;

/* --------------------------------------------------- payments (0001) */

type PaymentAttemptsRow = {
  id: number;
  order_id: number;
  provider: string;
  provider_ref: string | null;
  amount: number;
  currency: string;
  status: payment_status;
  qr_raw: string | null;
  created_at: string;
  confirmed_at: string | null;
};

type PaymentAttemptsInsert = {
  order_id: number;
  provider: string;
  amount: number;
  currency?: string;
  provider_ref?: string | null;
  status?: payment_status;
  qr_raw?: string | null;
  confirmed_at?: string | null;
};

type PaymentAttemptsUpdate = Partial<PaymentAttemptsRow>;

type PaymentEventsRow = {
  id: number;
  payment_attempt_id: number;
  event_type: string;
  /** raw provider webhook payload for reconciliation/audit. */
  payload: Json;
  signature_verified: boolean;
  received_at: string;
};

type PaymentEventsInsert = {
  payment_attempt_id: number;
  event_type: string;
  payload?: Json;
  signature_verified?: boolean;
};

type PaymentEventsUpdate = Partial<PaymentEventsRow>;

/* ----------------------------------------- notifications + profiles (0001) */

type NotificationsRow = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type NotificationsInsert = {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string | null;
};

type NotificationsUpdate = Partial<NotificationsRow>;

type ProfilesRow = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  locale: string;
  role: user_role;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
};

// profiles are provisioned by the on-auth trigger; the payments plane only
// reads them here, but GenericTable requires all three shapes.
type ProfilesInsert = ProfilesRow;
type ProfilesUpdate = Partial<ProfilesRow>;

/* ---------------------------------------------------------------- Database */

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: OrdersRow;
        Insert: OrdersInsert;
        Update: OrdersUpdate;
        Relationships: []; // buyer→profiles, product_ref enforced app-side
      };
      products: {
        Row: ProductsRow;
        Insert: ProductsInsert;
        Update: ProductsUpdate;
        Relationships: [];
      };
      voucher_codes: {
        Row: VoucherCodesRow;
        Insert: VoucherCodesInsert;
        Update: VoucherCodesUpdate;
        Relationships: [];
      };
      fulfillment_events: {
        Row: FulfillmentEventsRow;
        Insert: FulfillmentEventsInsert;
        Update: FulfillmentEventsUpdate;
        Relationships: [];
      };
      payment_attempts: {
        Row: PaymentAttemptsRow;
        Insert: PaymentAttemptsInsert;
        Update: PaymentAttemptsUpdate;
        Relationships: [];
      };
      payment_events: {
        Row: PaymentEventsRow;
        Insert: PaymentEventsInsert;
        Update: PaymentEventsUpdate;
        Relationships: [];
      };
      notifications: {
        Row: NotificationsRow;
        Insert: NotificationsInsert;
        Update: NotificationsUpdate;
        Relationships: [];
      };
      profiles: {
        Row: ProfilesRow;
        Insert: ProfilesInsert;
        Update: ProfilesUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      /** 0022_topup_crediting.sql — atomic, transactional pin claim + credit.
       *  service_role-only EXECUTE; returns the claimed codes, [] when out of
       *  pins, and raises ORDER_NOT_CREDITABLE when the state guard loses. */
      claim_voucher_codes: {
        Args: { p_order_id: number; p_quantity: number };
        Returns: string[];
      };
    };
    Enums: {
      order_status: order_status;
      product_status: product_status;
      delivery_method: delivery_method;
      user_role: user_role;
      payment_status: payment_status;
      voucher_code_status: voucher_code_status;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
