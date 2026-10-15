import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Fixed server-side prices to prevent price manipulation
const PRICE_MAP: Record<string, number> = {
  "80 Robux": 0.99,
  "400 Robux": 4.99,
  "800 Robux": 9.99,
  "1,700 Robux": 19.99,
  "4,500 Robux": 49.99,
  "10,000 Robux": 99.99,
};

export async function POST(request: Request) {
  try {
    const { player_id, package_name } = await request.json();

    if (!player_id || !package_name || !PRICE_MAP[package_name]) {
      return NextResponse.json(
        { error: "ព័ត៌មានមិនត្រឹមត្រូវ (Invalid order details)" },
        { status: 400 }
      );
    }

    const price = PRICE_MAP[package_name];

    // 1. Insert order into Supabase
    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          player_id,
          game_name: "Roblox",
          package_name,
          price,
          status: "PENDING",
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Send Telegram Notification (Optional if BOT_TOKEN is configured)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const message = `🛍️ *ការបញ្ជាទិញថ្មី (New Order #${data.id})*\n\n🎮 *ហ្គេម:* Roblox\n👤 *User ID:* \`${player_id}\` \n📦 *កញ្ចប់:* ${package_name}\n💵 *តម្លៃ:* $${price.toFixed(2)}\n⏳ *ស្ថានភាព:* PENDING`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
    }

    return NextResponse.json({ success: true, order: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}