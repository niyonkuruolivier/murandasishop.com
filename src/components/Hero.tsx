import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type HeroSlide = {
  id: string;
  image: string;
  title: string;
  highlight: string;
  cta_label: string;
  cta_href: string;
  sort_order: number;
  active: boolean;
};

const FALLBACK: HeroSlide[] = [
  {
    id: "f1",
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=2400&q=85",
    title: "Smart Electronics.",
    highlight: "Better Prices.",
    cta_label: "Shop Now",
    cta_href: "/search",
    sort_order: 1,
    active: true,
  },
];

export function useHeroSlides() {
  return useQuery({
    queryKey: ["hero-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_slides")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HeroSlide[];
    },
  });
}

export function Hero() {
  const { data } = useHeroSlides();
  const slides = data && data.length > 0 ? data : FALLBACK;

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const next = useCallback(() => setCurrent((i) => (i + 1) % slides.length), [slides.length]);
  const prev = useCallback(() => setCurrent((i) => (i - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (current >= slides.length) setCurrent(0);
  }, [slides.length, current]);

  useEffect(() => {
    if (isPaused || slides.length < 2) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, next, slides.length]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    setTouchStart(null);
    setTouchEnd(null);
  };

  const slide = slides[Math.min(current, slides.length - 1)];

  return (
    <section className="pt-4 sm:pt-6">
      <div
        className="relative mx-auto h-[50vh] max-h-[420px] min-h-[260px] max-w-7xl overflow-hidden rounded-3xl sm:rounded-[32px]"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className={`absolute inset-0 ${i === current ? "animate-hero-zoom" : ""}`}>
              <img
                src={s.image}
                alt={s.title}
                className="h-full w-full object-cover"
                loading={i === 0 ? "eager" : "lazy"}
              />
            </div>
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

        <div className="relative flex h-full flex-col items-center justify-center px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto max-w-[700px]" key={current}>
            <h1 className="animate-hero-title text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              {slide.title}
              {slide.highlight && (
                <>
                  <br />
                  <span className="text-accent">{slide.highlight}</span>
                </>
              )}
            </h1>
            <div className="animate-hero-cta mt-6 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <a
                href={slide.cta_href || "/search"}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_10px_30px_-8px_rgb(255_107_0/0.6)] transition hover:brightness-110 hover:shadow-[0_14px_36px_-8px_rgb(255_107_0/0.75)]"
              >
                {slide.cta_label || "Shop Now"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#categories"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
              >
                <LayoutGrid className="h-4 w-4" />
                Explore Categories
              </a>
            </div>
          </div>
        </div>

        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/15 p-2 text-white backdrop-blur-md transition hover:bg-white/25 sm:flex"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/15 p-2 text-white backdrop-blur-md transition hover:bg-white/25 sm:flex"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === current ? "w-6 bg-accent" : "w-2 bg-white/50 hover:bg-white/75"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
