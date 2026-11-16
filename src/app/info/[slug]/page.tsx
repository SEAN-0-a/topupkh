import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getInfoPage, INFO_SLUGS, type Block } from "@/lib/info-content";

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
      {/* breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-gray-400">
        <Link href="/" className="transition-colors hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/info/help-center" className="transition-colors hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white">
          Info
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-gray-200">{page.title}</span>
      </nav>

      {/* header */}
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">{page.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">{page.subtitle}</p>
        <span className="mt-3 inline-block rounded-full border border-gray-700 bg-slate-900/60 px-3 py-1 text-[10px] font-semibold text-gray-500">
          {page.updated}
        </span>
      </header>

      {/* content blocks */}
      <article className="space-y-6">
        {page.blocks.map((block, i) => (
          <InfoBlock key={i} block={block} />
        ))}
      </article>

      {/* footer cross-navigation */}
      <div className="mt-10 border-t border-hairline pt-6">
        <Link
          href="/info/help-center"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 transition-colors hover:text-emerald-400"
        >
          ← Back to the Help Center
        </Link>
      </div>
    </div>
  );
}

/* ── Block renderer ─────────────────────────────────────────────────── */

const CALLOUT_TONE: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  red: "border-red-500/40 bg-red-500/10 text-red-200",
};

function InfoBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "p":
      return <p className="text-sm leading-relaxed text-gray-300">{block.text}</p>;

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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
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
                    <th key={i} className="px-4 py-3 font-bold text-emerald-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-t border-hairline">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 align-top text-gray-300">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="border-t border-hairline bg-surface px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
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
              <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{card.text}</p>
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
              <span className="text-emerald-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                →
              </span>
              <span>
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{link.label}</span>
                <span className="block text-xs text-gray-500">{link.text}</span>
              </span>
            </Link>
          ))}
        </div>
      );

    default:
      return null;
  }
}
