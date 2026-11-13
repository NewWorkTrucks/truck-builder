import Image from "next/image";
import Link from "next/link";

/** The builder's top bar: home link and a page title (the vehicle name). */
export default function BuilderHeader({ title }: { title?: string }) {
  return (
    <header className="z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
      <Link
        href="/"
        className="flex items-center gap-2 font-extrabold"
        aria-label="New Work Trucks home"
      >
        <Image src="/logo-black.webp" alt="" width={40} height={40} className="size-10 object-contain" />
        <span className="hidden sm:inline">New Work Trucks</span>
      </Link>
      <span aria-hidden className="h-5 w-px bg-border" />
      <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
    </header>
  );
}
