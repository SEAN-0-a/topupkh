import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Dev-only seed: POST /api/seed inserts ONE approved, in-stock listing for an
 * approved seller, then revalidates the pages that render it (same title reuses
 * the row). The live `products` table has no category_id, so the category is
 * resolved via eligibility_rules to an ALLOWED game_id (default top-ups →
 * free-fire) and echoed in the response. Production needs SEED_TOKEN.
 */
export const dynamic = "force-dynamic";

type SeedBody = {
  sellerId?: number | string; categorySlug?: string; gameSlug?: string;
  title?: string; priceUsd?: number | string; imageUrl?: string;
};
type SellerRow = { id: number; display_name: string | null; status: string };
type CategoryRow = { id: number; slug: string; name: string };
type GameRow = { id: number; slug: string; name: string; icon_url: string | null };
type ProductRow = {
  id: number; title: string; status: string; price_usd: number; seller_id: number;
  game_id: number; image_url: string | null; created_at: string;
};

const PRODUCT_SELECT =
  "id, title, status, price_usd, seller_id, game_id, image_url, created_at";
const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (error: string, status = 500) => json({ ok: false, error }, status);

function guard(req: Request): Response | null {
  if (process.env.NODE_ENV !== "production") return null;
  const expected = process.env.SEED_TOKEN;
  if (expected && req.headers.get("x-seed-token") === expected) return null;
  return fail("Seed endpoint is disabled in production.", 403);
}

/** PostgREST may embed a to-one FK as an object or a single-element array. */
function pickGame(value: unknown): GameRow | null {
  const row = (Array.isArray(value) ? value[0] : value) as GameRow | null;
  return row?.id ? row : null;
}

export async function GET(req: Request) {
  return guard(req) ?? json({
    ok: true,
    usage: "POST /api/seed — body: { sellerId?, categorySlug?, gameSlug?, title?, priceUsd?, imageUrl? }",
  });
}

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const raw = (await req.json().catch(() => ({}))) as SeedBody;

  try {
    const supabase = createSupabaseAdminClient() as unknown as SupabaseClient;

    // 1. approved seller (catalog joins filter on sellers.status)
    const sellerId = Number(raw.sellerId);
    const sellerQuery = supabase.from("sellers").select("id, display_name, status");
    const { data: sellerData, error: sellerError } = await (
      Number.isSafeInteger(sellerId) && sellerId > 0
        ? sellerQuery.eq("id", sellerId).maybeSingle()
        : sellerQuery.eq("status", "approved")
            .order("completed_sales", { ascending: false }).limit(1).maybeSingle()
    );
    const seller = sellerData as SellerRow | null;
    if (sellerError) return fail(sellerError.message);
    if (!seller) return fail("No approved seller found. Pass { sellerId }.", 400);
    if (seller.status !== "approved") {
      return fail(`Seller ${seller.id} is "${seller.status}", not approved.`, 400);
    }

    // 2. category → eligibility-ALLOWED game
    const categorySlug =
      (typeof raw.categorySlug === "string" && raw.categorySlug.trim()) || "top-ups";
    const { data: categoryData, error: categoryError } = await supabase
      .from("product_categories").select("id, slug, name")
      .eq("slug", categorySlug).maybeSingle();
    if (categoryError) return fail(categoryError.message);
    const category = categoryData as CategoryRow | null;
    if (!category) return fail(`Unknown category slug "${categorySlug}".`, 400);

    const { data: ruleRows, error: ruleError } = await supabase
      .from("eligibility_rules")
      .select("games!inner(id, slug, name, icon_url)")
      .eq("category_id", category.id).eq("status", "allowed")
      .order("game_id", { ascending: true });
    if (ruleError) return fail(ruleError.message);

    const allowedGames = (ruleRows ?? [])
      .map((row: { games: unknown }) => pickGame(row.games))
      .filter((game: GameRow | null): game is GameRow => game !== null);
    const requestedGame =
      (typeof raw.gameSlug === "string" && raw.gameSlug.trim()) || "";
    const wantedGame = requestedGame || "free-fire";
    const game = allowedGames.find((g) => g.slug === wantedGame)
      ?? (requestedGame ? null : allowedGames[0] ?? null);
    if (!game) {
      return fail(requestedGame
        ? `Game "${requestedGame}" is not eligibility-allowed for "${category.slug}".`
        : `No eligibility-allowed game for category "${category.slug}".`, 400);
    }

    // 3. validated payload (only columns that exist on the live table)
    const title = (
      (typeof raw.title === "string" && raw.title.trim()) ||
      `${game.name} — 220 Diamonds Instant Top-Up`
    ).slice(0, 120);
    const price = Number(raw.priceUsd ?? 4.99);
    if (!Number.isFinite(price) || price <= 0) {
      return fail("priceUsd must be a positive number.", 400);
    }
    const imageUrl =
      (typeof raw.imageUrl === "string" && raw.imageUrl.trim()) || game.icon_url || "";
    if (!imageUrl || imageUrl.startsWith("blob:")) {
      return fail("A public imageUrl is required (blank/blob covers are rejected by the DB).", 400);
    }

    // 4. idempotent insert: same title → return the existing row
    const { data: existingData } = await supabase
      .from("products").select(PRODUCT_SELECT)
      .eq("title", title).eq("is_deleted", false).limit(1).maybeSingle();
    let product = existingData as ProductRow | null;
    let created = false;

    if (product) {
      console.info(`[seed] reusing product id=${product.id} title="${product.title}"`);
    } else {
      const { data, error } = await supabase.from("products").insert({
        seller_id: seller.id,
        game_id: game.id,
        title,
        description: `${title} — seeded listing for fresh-product verification. Delivered to the in-game account shortly after payment.`,
        image_url: imageUrl,
        images: [imageUrl],
        price_usd: Number(price.toFixed(2)),
        original_price_usd: Number((price * 1.2).toFixed(2)),
        delivery_method: "instructions",
        delivery_details:
          "Send your player ID at checkout. Credited within 5 minutes of payment confirmation.",
        stock: 0,
        stock_is_unlimited: true,
        estimated_minutes: 5,
        refund_policy: "Full refund if the top-up cannot be delivered.",
        ownership_note:
          "Top-up executed by our licensed recharge partner; no account credentials required.",
        status: "approved",
      }).select(PRODUCT_SELECT).single();
      if (error) {
        console.error("[seed] insert failed:", error.message);
        return fail(error.message);
      }
      product = data as ProductRow;
      created = true;
      console.info(
        `[seed] inserted product id=${product.id} title="${product.title}" status=${product.status}`,
      );
    }

    // 5. revalidate home + catalog + game catalog + product page
    const revalidated = [
      "/", "/marketplace",
      `/marketplace/${game.slug}/${category.slug}`,
      `/product/${product.id}`,
    ];
    for (const path of revalidated) revalidatePath(path);

    return json({
      ok: true,
      created,
      product: {
        id: product.id,
        title: product.title,
        price: product.price_usd,
        category: { slug: category.slug, name: category.name },
        game: { slug: game.slug, name: game.name },
        image_url: product.image_url,
        seller_id: product.seller_id,
        status: product.status,
        created_at: product.created_at,
      },
      published: product.status === "approved",
      revalidated,
      links: {
        home: "/",
        catalog: "/marketplace",
        gameCatalog: `/marketplace/${game.slug}/${category.slug}`,
        product: `/product/${product.id}`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown seed error";
    console.error("[seed] failed:", message);
    return fail(message);
  }
}
