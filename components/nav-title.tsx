import Image from 'next/image';

/**
 * Brand title for the top nav: the MenuWright mark plus wordmark.
 */
export function NavTitle() {
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/logo.svg"
        alt="MenuWright"
        width={28}
        height={28}
        priority
      />
      <span className="font-display text-lg font-semibold tracking-[-0.02em] text-fd-card-foreground">
        MenuWright
      </span>
    </span>
  );
}
