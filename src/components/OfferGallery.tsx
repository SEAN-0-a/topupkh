"use client";

import { useState } from "react";
import SafeProductImage from "@/components/SafeProductImage";

type Props = {
  /** Gallery URLs (already de-duplicated by the caller). */
  images: string[];
  title: string;
  /** Placeholder SVG shown when there are no images at all. */
  fallback: string;
};

/**
 * Eldorado-style gallery: big main image + thumbnail strip below.
 * Pure client state (active index); server page just feeds the URL list.
 */
export default function OfferGallery({ images, title, fallback }: Props) {
  const [active, setActive] = useState(0);
  const src = images[active] ?? fallback;
  const hasThumbs = images.length > 1;

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900">
      <div className="aspect-[16/10] w-full overflow-hidden bg-gray-950">
        {/* SafeProductImage on every slot — one dead gallery URL swaps itself
            for the placeholder instead of showing a broken-image icon. */}
        <SafeProductImage
          src={src}
          alt={title}
          loading="eager"
          className="h-full w-full object-cover"
        />
      </div>
      {hasThumbs && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {images.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl border transition-all ${
                i === active
                  ? "border-emerald-500 ring-1 ring-emerald-500/60"
                  : "border-gray-800 opacity-70 hover:opacity-100"
              }`}
            >
              <SafeProductImage src={u} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
