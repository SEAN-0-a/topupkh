/**
 * Round avatar with letter fallback. `src="https://…"` renders the image
 * (Supabase Storage public URL), otherwise the first letter of `name`.
 */
export default function Avatar({
  src,
  name = "",
  sizePx = 32,
  className = "",
}: {
  src: string | null | undefined;
  name?: string;
  sizePx?: number;
  className?: string;
}) {
  const style = { width: sizePx, height: sizePx };
  const letter = (name.trim()[0] ?? "?").toUpperCase();

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        style={style}
        className={`rounded-full border border-gray-700 object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      aria-label={name || "Avatar"}
      className={`flex items-center justify-center rounded-full bg-gray-700 text-xs font-black text-gray-200 ${className}`}
    >
      {letter}
    </div>
  );
}
