"use client";
import dynamic from "next/dynamic";
import {
  Component,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ScrollStory } from "../showroom/ScrollDirector";
import "./showroom-hero.css";
import { HERO_BUILD, type HeroTheme } from "../showroom/scene-config";

// three.js and the scene are fetched only after hydration (see mount effect).
const ShowroomScene = dynamic(() => import("../showroom/ShowroomScene"), {
  ssr: false,
});

const MOBILE_QUERY = "(max-width: 767px)";
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** WebGL or model failure: render nothing and let the poster stay. */
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HeroStage({
  theme,
  model,
  label,
  className = "sh-stage",
  partColors,
  story,
  lightsOn,
  children,
}: {
  theme: HeroTheme;
  model?: string;
  label: string;
  /** Replaces the hero's stage layout, e.g. a full-viewport sticky stage. */
  className?: string;
  /** Repaints the build; see ShowroomScene. */
  partColors?: Record<string, Record<string, string>>;
  /** Scroll drives the scene instead of drag and auto-rotate. */
  story?: ScrollStory;
  /** Headlights and taillights; omitted, the truck has no lamps. */
  lightsOn?: boolean;
  /** Server-rendered poster image. */
  children: ReactNode;
}) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tabShown, setTabShown] = useState(true);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );

  // Defer the 3D bundle until the page is interactive and the browser is idle.
  useEffect(() => {
    const start = () => setMounted(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!stage) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(stage);
    const onVis = () => setTabShown(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [stage]);

  const onReady = useCallback((r: boolean) => r && setReady(true), []);

  return (
    <div
      ref={setStage}
      className={className}
      data-ready={ready || undefined}
      role="img"
      aria-label={label}
      tabIndex={story ? undefined : 0}
    >
      {/* {children} */}
      {/* Never a blank stage while loading (3D-MODELING-GUIDELINES §5). */}
      {!ready && !failed && (
        <p className="sh-loading" aria-hidden>
          Loading your truck…
        </p>
      )}
      {mounted && (
        <SceneBoundary onError={() => setFailed(true)}>
          <ShowroomScene
            {...HERO_BUILD}
            interaction="turntable"
            theme={theme}
            model={model}
            mobile={mobile}
            active={visible && tabShown}
            inputTarget={story ? null : stage}
            partColors={partColors}
            story={story}
            lightsOn={lightsOn}
            onReady={onReady}
          />
        </SceneBoundary>
      )}
    </div>
  );
}
