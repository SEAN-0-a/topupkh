import Link from "next/link";

/**
 * Clean placeholder for routes that exist so links never 404 while the real
 * feature is unbuilt. Always offers navigation back and onward.
 */
export default function PlaceholderPage({
  emoji = "🚧",
  title,
  description,
  backHref = "/",
  backLabel = "Back to Home",
  links = [],
}: {
  emoji?: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  links?: { href: string; label: string }[];
}) {
  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center shadow-2xl">
        <div className="text-4xl">{emoji}</div>
        <h1 className="mt-3 text-lg font-bold text-white">{title}</h1>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">{description}</p>

        <div className="mt-6 flex flex-col gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-200 transition-all hover:bg-gray-700 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={backHref}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/20"
          >
            ← {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
