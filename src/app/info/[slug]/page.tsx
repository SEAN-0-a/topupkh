import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getInfoPage, INFO_SLUGS, type Block } from "@/lib/info-content";
import InfoPageHeader, { InfoBackLink } from "./InfoPageHeader";

/**
 * /info/[slug] — the dynamic informational & policy system.
 *
 * Every footer info page (TradeShield, withdrawals, refund policy, fees,
 * contact, seller rules, …) is defined as structured blocks in
 * src/lib/info-content.ts and rendered here. Content is Cambodia-tailored:
 * USD/KHR + Bakong/ABA KHQR payments, ICT (UTC+7) hours, local banking.
 *
 * generateStaticParams pre-renders every known slug at build time and
 * `dynamicParams = false` makes any unknown slug a clean 404.
 *
 * THEME CONTRACT (contrast audit): all prose/metadata colors are explicit
 * slate pairs (`text-slate-… dark:text-slate-…`) — no legacy dark-first
 * gray-family or inverted classes that washed out on light surfaces. The
 * breadcrumbs,
 * heading, subtitle and the "Last updated" badge live in the client
 * InfoPageHeader component so they re-render in Khmer on language switch.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return INFO_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getInfoPage(slug);
  if (!page) return { title: "Not found — RomdoulKHShop" };
  return {
    title: `${page.title} — RomdoulKHShop`,
    description: page.subtitle,
  };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getInfoPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 text-slate-900 dark:text-white">
      <InfoPageHeader slug={page.slug} title={page.title} subtitle={page.subtitle} updated={page.updated} />

      {/* content blocks */}
      <article className="space-y-6">
        {page.blocks.map((block, i) => (
          <InfoBlock key={i} block={block} />
        ))}
      </article>

      {/* footer cross-navigation */}
      <div className="mt-10 border-t border-hairline pt-6">
        <InfoBackLink />
      </div>
    </div>
  );
}

/* ── Block renderer ─────────────────────────────────────────────────── */

const CALLOUT_TONE: Record<string, string> = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
  sky: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200",
};

function InfoBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{block.text}</p>;

    case "callout":
      return (
        <div
          className={`rounded-2xl border p-4 text-sm leading-relaxed ${CALLOUT_TONE[block.tone] ?? CALLOUT_TONE.sky}`}
        >
          {block.text}
        </div>
      );

    case "steps":
      return (
        <ol className="space-y-3">
          {block.items.map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-2xl border border-hairline bg-surface p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <figure className="overflow-hidden rounded-2xl border border-hairline">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-surface">
                  {block.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-t border-hairline">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="border-t border-hairline bg-surface px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    case "cards":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {block.items.map((card, i) => (
            <div key={i} className="rounded-2xl border border-hairline bg-surface p-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white">{card.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{card.text}</p>
            </div>
          ))}
        </div>
      );

    case "links":
      return (
        <div className="space-y-2">
          {block.items.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="group flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 transition-colors hover:border-emerald-500/40"
            >
              <span className="text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400" aria-hidden="true">
                →
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{link.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{link.text}</span>
              </span>
            </Link>
          ))}
        </div>
      );

    default:
      return null;
  }
}
