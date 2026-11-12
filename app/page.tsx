import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import HudRings from "@/components/landing/HudRings";
import ScrollStory from "@/components/landing/ScrollStory";
import "@/components/landing/landing.css";
import { CATEGORIES, UPFITS, VEHICLES } from "@/lib/catalog";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#upfits", label: "Upfits" },
  { href: "#faq", label: "FAQ" },
];

const pill =
  "inline-flex min-h-14 items-center justify-center rounded-full px-7 text-lg";

const services: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Truck,
    title: "Trucks and vans",
    text: "Light-, medium-, and heavy-duty trucks and vans from major work-truck brands.",
  },
  {
    icon: Wrench,
    title: "Upfits and configurations",
    text: "Specialized bodies, racks, and bumpers so each vehicle is ready for its job.",
  },
  {
    icon: ShieldCheck,
    title: "Fleet programs",
    text: "Fleet programs that include maintenance and warranty coverage.",
  },
];

const steps = [
  {
    title: "Choose a vehicle",
    text: "Start with a chassis that suits your job, budget, and fleet.",
  },
  {
    title: "Add upfits",
    text: "Add bodies, racks, and bumpers and see them on the truck in 3D.",
  },
  {
    title: "Get help from our team",
    text: "We review your build and help you find the right fit.",
  },
];

const stats = [
  { value: "30+", label: "Years of automotive experience" },
  { value: "3", label: "Duty classes: light, medium, and heavy" },
  { value: "U.S.", label: "Businesses served nationwide" },
];

const faqs = [
  {
    q: "What kinds of vehicles do you offer?",
    a: "Light-, medium-, and heavy-duty trucks, plus vans from major work-truck brands.",
  },
  {
    q: "Can you help me choose upfits?",
    a: "Yes. Our team helps you pick specialized upfits and configurations so the vehicle is ready for the work it needs to do. You can try them out in the builder first.",
  },
  {
    q: "What do fleet programs include?",
    a: "Our fleet programs include maintenance and warranty coverage.",
  },
];

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7cc4ff]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
    </div>
  );
}

export default function Home() {
  return (
    <main className="landing dark flex-1 overflow-x-clip">
      <header className="landing-header">
        <Link href="/" className="landing-logo">
          <Image src="/logo.webp" alt="New Work Trucks" width={100} height={100} priority />
        </Link>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <Link href="/builder" className="story-btn story-btn-primary !min-h-12 !px-5 !text-base">
          Start building
        </Link>
      </header>

      <ScrollStory />

      <section id="services" className="relative isolate scroll-mt-16 overflow-hidden">
        <HudRings variant="b" className="-top-40 -right-56 w-[620px] opacity-45" />
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <SectionHeading eyebrow="What we offer" title="Everything a work truck needs." />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {services.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <Icon aria-hidden className="size-7 text-[#3ea6ff]" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-[#a9b1bd]">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="upfits"
        className="relative isolate overflow-hidden border-y border-white/10 bg-white/[0.02] py-24"
      >
        <HudRings variant="c" className="top-1/2 -left-72 w-[680px] -translate-y-1/2 opacity-40" />
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <SectionHeading eyebrow="Upfits" title="Pick the gear. See it on the truck." />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div key={c.id}>
                <h3 className="text-xl font-semibold">{c.label}</h3>
                <ul className="mt-4 space-y-3 text-lg text-[#a9b1bd]">
                  {UPFITS.filter((u) => u.category === c.id).map((u) => (
                    <li key={u.id} className="border-t border-white/10 pt-3">
                      {u.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 text-lg text-[#a9b1bd]">
            Available on {VEHICLES.map((v) => v.name).join(" and ")}.
          </p>
        </div>
      </section>

      <section className="relative isolate overflow-hidden">
        <HudRings variant="a" className="-right-64 -bottom-48 w-[640px] opacity-40" />
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <SectionHeading eyebrow="How it works" title="Three steps to a quote." />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 p-6">
                <span className="text-sm font-semibold tracking-[0.18em] text-[#7cc4ff]">
                  0{i + 1}
                </span>
                <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-lg leading-relaxed text-[#a9b1bd]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="relative isolate overflow-hidden border-y border-white/10 bg-white/[0.02]">
        <HudRings
          variant="b"
          className="top-1/2 left-1/2 w-[560px] -translate-x-1/2 -translate-y-1/2 opacity-30"
        />
        <dl className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3 sm:px-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-5xl font-bold tracking-tight text-[#3ea6ff]">{s.value}</dd>
              <p className="mt-2 text-lg text-[#a9b1bd]" aria-hidden>
                {s.label}
              </p>
            </div>
          ))}
        </dl>
      </section>

      <section id="faq" className="relative isolate scroll-mt-16 overflow-hidden">
        <HudRings variant="c" className="top-1/2 -right-80 w-[640px] -translate-y-1/2 opacity-40" />
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-8">
          <SectionHeading eyebrow="FAQ" title="Questions, answered." />
          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 text-xl font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden
                    className="text-2xl text-[#3ea6ff] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-lg leading-relaxed text-[#a9b1bd]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-8">
        <div className="relative isolate mx-auto flex max-w-6xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_0%,#1d2938,transparent_70%)] px-6 py-16 text-center">
          <HudRings variant="a" className="-bottom-56 left-1/2 w-[660px] -translate-x-1/2 opacity-40" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            See it before you sign.
          </h2>
          <p className="max-w-xl text-lg text-[#a9b1bd]">
            Build your truck in 3D, then send it to our team.
          </p>
          <Link href="/builder" className={`${pill} bg-[#3ea6ff] font-bold text-[#04121f]`}>
            Start building →
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-[#8693a6]">
        © New Work Trucks
      </footer>
    </main>
  );
}
