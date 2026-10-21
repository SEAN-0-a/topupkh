import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import MarkAllReadButton from "@/components/MarkAllReadButton";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/**
 * /notifications — reads the caller's rows from public.notifications (RLS:
 * user sees their own via notifications_self). "Mark all read" is a server
 * action, so nothing here is writable from untrusted input.
 */
export default async function NotificationsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login?next=/notifications");

  const supabase = await createSupabaseServerClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (notifications ?? []) as NotificationRow[];
  const unreadCount = rows.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Notifications</h1>
            <p className="mt-0.5 text-xs text-gray-400">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
            </p>
          </div>
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>

        <div className="mt-5 space-y-2">
          {rows.length === 0 && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center text-xs text-gray-400">
              🔔 No notifications yet. Order updates and escrow messages will appear here.
            </div>
          )}
          {rows.map((n) => {
            const unread = !n.read_at;
            const content = (
              <div
                className={`rounded-xl border bg-gray-900 p-4 transition-all ${
                  unread ? "border-emerald-500/40" : "border-gray-800 hover:border-gray-700"
                } ${n.link ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    {unread && <span className="mr-1.5 text-emerald-400">•</span>}
                    {n.title}
                  </p>
                  <span className="whitespace-nowrap text-[10px] text-gray-500">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                {n.body && <p className="mt-1 text-[11px] leading-relaxed text-gray-400">{n.body}</p>}
              </div>
            );
            return n.link && n.link.startsWith("/") ? (
              <Link key={n.id} href={n.link}>
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link href="/marketplace" className="text-xs font-bold text-emerald-400 hover:underline">
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
