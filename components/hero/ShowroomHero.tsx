import Image from "next/image";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import HeroStage from "./HeroStage";
import type { HeroTheme } from "../showroom/scene-config";
import "./showroom-hero.css";

// Chips describe the build in HERO_BUILD (scene-config.ts); keep them in sync.
const CHIPS = [
  { title: "Service body", detail: "696J" },
  { title: "Utility rack", detail: "added" },
  { title: "Step bumper", detail: "added" },
];

const STAGE_LABEL =
  "3D RAM 2500HD crew cab work truck with a 696J service body, utility rack and step bumper, rotating on a turntable. Drag or use the left and right arrow keys to spin it.";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#upfits", label: "Upfits" },
  { href: "#faq", label: "FAQ" },
];

/** Ellipse-clipped perspective floor grid. Coordinates are in a 100×100 box. */
function FloorGrid() {
  const rows = [58, 62, 67, 73, 80, 88, 97];
  const rays = [-20, 0, 20, 40, 60, 80, 100];
  return (
    <svg className="sh-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {rows.map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} />
      ))}
      {rays.map((x) => (
        <line key={x} x1="50" y1="42" x2={x} y2="100" />
      ))}
    </svg>
  );
}

export default function ShowroomHero({ 
  model,
  theme
}: {
  theme: HeroTheme;
  /** Optional GLB URL; defaults to the catalog build shown by the chips. */
  model?: string;
}) {
  return (
  <section className="sh-hero !h-screen" data-theme={theme}>
      <FloorGrid />

      <header className="sh-header">
        <Link href="/" className="sh-logo">
          <Image src="/logo.webp" alt="New Work Trucks" width={40} height={40} />
        </Link>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      <div className="sh-text">
        <p className="sh-eyebrow">New Work Trucks · 3D builder</p>
        <h1>See it before you sign.</h1>
        <p className="sh-sub">
          Spin your truck, swap the upfits, and know it fits before our team sends the quote.
        </p>
      </div>

      <HeroStage theme={theme} model={model} label={STAGE_LABEL}>
        <></>
      </HeroStage>

      <p className="sh-hint">Drag to spin · real 3D</p>

      <ul className="sh-chips">
        {CHIPS.map((c, i) => (
          <li key={c.title} className={`sh-chip sh-chip-${i + 1}`}>
            <CircleCheck aria-hidden />
            <span>
              <strong>{c.title}</strong> · {c.detail}
            </span>
          </li>
        ))}
      </ul>

      <div className="sh-ctas">
        <Link href="/builder" className="sh-btn sh-btn-primary">
          Start building →
        </Link>
        <a href="#faq" className="sh-btn sh-btn-secondary">
          Talk to our team
        </a>
      </div>
    </section>
  );
}
