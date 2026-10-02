import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing env variables. SUPABASE_URL: ${!!supabaseUrl}, SUPABASE_ANON_KEY: ${!!supabaseAnonKey}`,
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const body = await req.json();
    const { playerId, gameName, packageName, price } = body;

    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          player_id: playerId,
          game_name: gameName,
          package_name: packageName,
          price: price,
          status: 'PENDING',
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data[0] });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}