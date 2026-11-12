"use client";
import Link from "next/link";
import { ArrowDown, CircleCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import HeroStage from "../hero/HeroStage";
import type { ScrollStory as Story } from "../showroom/ScrollDirector";
import { heroColors, samplePose } from "./scroll-story";

const STAGE_LABEL =
  "3D RAM 2500HD crew cab work truck with a 696J service body, utility rack and step bumper. As you scroll, the camera circles the truck, the parts separate with each one labelled, and come back together.";

const PARTS = [
  { title: "Service body", detail: "696J" },
  { title: "Utility rack", detail: "added" },
  { title: "Step bumper", detail: "added" },
];

/** Chapters in order; each lines up with a beat in scroll-story.ts. */
const CHAPTER_COUNT = 5;

/** The truck stays in its stock white. */
const COLORS = heroColors("white");

/**
 * The landing page's opening: a 3D truck that plays like a video as you
 * scroll. The stage stays pinned while the chapters scroll over it; the
 * scene reads how far through the section the page is (ScrollDirector).
 */
export default function ScrollStory() {
  const [track, setTrack] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(0);

  const story = useMemo<Story | undefined>(
    () => (track ? { track, pose: samplePose } : undefined),
    [track],
  );

  // The chapter crossing the middle of the viewport is the one in focus.
  useEffect(() => {
    if (!track) return;
    const chapters = [...track.querySelectorAll<HTMLElement>("[data-chapter]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(chapters.indexOf(e.target as HTMLElement));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    chapters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [track]);

  return (
    <section
      ref={setTrack}
      className="story"
      aria-label="Build a work truck, step by step"
      data-active={active}
    >
      <div className="story-pin">
        <HeroStage
          theme="dark"
          label={STAGE_LABEL}
          className="story-stage"
          partColors={COLORS}
          story={story}
        >
          <></>
        </HeroStage>
        <ol className="story-rail" aria-hidden>
          {Array.from({ length: CHAPTER_COUNT }, (_, i) => (
            <li key={i} data-on={i === active || undefined} />
          ))}
        </ol>
      </div>

      <div className="story-chapters">
        <article className="story-chapter" data-chapter data-side="top" data-on={active === 0 || undefined}>
          <div className="story-card story-card-hero">
            <p className="story-eyebrow">New Work Trucks · 3D builder</p>
            <h1>See it before you sign.</h1>
            <p className="story-lede">
              Spin your truck, swap the upfits, and know it fits before our team sends the quote.
            </p>
            <div className="story-actions">
              <Link href="/builder" className="story-btn story-btn-primary">
                Start building →
              </Link>
              <a href="#faq" className="story-btn story-btn-secondary">
                Talk to our team
              </a>
            </div>
            <p className="story-scroll">
              Scroll to explore <ArrowDown aria-hidden />
            </p>
          </div>
        </article>

        <article className="story-chapter" data-chapter data-side="right" data-on={active === 1 || undefined}>
          <div className="story-card">
            <p className="story-step">01 · Chassis</p>
            <h2>Start with the right truck.</h2>
            <p className="story-lede">
              Pick the cab and chassis that suit your job, your budget and the rest of your fleet.
              The truck you choose is the one you see.
            </p>
          </div>
        </article>

        <article className="story-chapter" data-chapter data-side="left" data-on={active === 2 || undefined}>
          <div className="story-card">
            <p className="story-step">02 · Upfits</p>
            <h2>Add the body, rack and bumper.</h2>
            <p className="story-lede">
              Watch each upfit lift away from the chassis, so you can see exactly what is on the
              build.
            </p>
            <ul className="story-parts">
              {PARTS.map((p) => (
                <li key={p.title}>
                  <CircleCheck aria-hidden />
                  <span>
                    <strong>{p.title}</strong> · {p.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="story-chapter" data-chapter data-side="right" data-on={active === 3 || undefined}>
          <div className="story-card">
            <p className="story-step">03 · Fit</p>
            <h2>Every piece in its place.</h2>
            <p className="story-lede">
              Walk around the whole build before anything is ordered. Our team reviews your
              configuration and helps you find the right fit.
            </p>
          </div>
        </article>

        <article className="story-chapter" data-chapter data-side="bottom" data-on={active === 4 || undefined}>
          <div className="story-card story-card-end mb-8 lg:mb-[32em] ">
            <h2>Now build yours.</h2>
            <p className="story-lede">
              Choose a vehicle, add upfits and send it to our team.
            </p>
            <div className="story-actions">
              <Link href="/builder" className="story-btn story-btn-primary">
                Start building →
              </Link>
              <a href="#services" className="story-btn story-btn-secondary">
                What we offer
              </a>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
