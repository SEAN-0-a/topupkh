/**
 * Animated Telegram community pill.
 * CSS-only motion; reduced-motion users keep the static pill.
 */
type TelegramBannerProps = {
  telegramUrl?: string;
};

export function TelegramBanner({
  telegramUrl = "https://t.me/RomdoulKHshop",
}: TelegramBannerProps) {
  return (
    <a
      href={telegramUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join the RomdoulKHShop Telegram community"
      className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-cyan-400/30 bg-[#0b1120]/90 px-5 py-2.5 shadow-[0_0_24px_-4px_rgba(34,211,238,0.4)] transition-all duration-300 will-change-transform hover:border-cyan-300/60 hover:bg-[#0b1120] hover:shadow-[0_0_36px_-4px_rgba(34,211,238,0.55)] motion-safe:hover:-translate-y-0.5"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        {/* Pulsing gradient aura */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-400 to-blue-600 opacity-50 blur-md motion-safe:animate-pulse group-hover:opacity-80"
        />

        {/* Telegram gradient mark */}
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] shadow-[0_2px_10px_rgba(34,158,217,0.45)] transition-transform duration-500 motion-safe:group-hover:rotate-12">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-[#ffffff]"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </span>
      </span>

      <span className="flex flex-col text-left leading-tight">
        <span className="text-sm font-bold text-[#ffffff]">Join community</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67e8f9]">
          TELEGRAM · FREE
        </span>
      </span>

      {/* Cyan bottom highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent"
      />
    </a>
  );
}
