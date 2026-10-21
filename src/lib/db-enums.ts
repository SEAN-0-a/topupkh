export type user_role = "buyer" | "seller" | "support" | "admin";
export type product_status = "draft" | "pending_review" | "approved" | "rejected" | "paused";
export type delivery_method = "in_game" | "instructions" | "digital_file" | "creator_services";
export type order_status =
  | "pending_payment"
  | "paid"
  | "processing"
  | "delivering"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed";
export type seller_status = "pending" | "approved" | "suspended" | "rejected";
export type ticket_status = "open" | "in_progress" | "resolved" | "closed";
export type ticket_category =
  | "payment_issue"
  | "delivery_problem"
  | "refund_request"
  | "account_issue"
  | "report_seller"
  | "other";
export type ticket_priority = "low" | "normal" | "high" | "urgent";
