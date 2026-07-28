import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";

const slides = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=2400&q=85",
    title: "Smart Electronics.",
    highlight: "Better Prices.",
    cta: "Shop Now",
    ctaTo: "/search" as const,
    ctaSearch: { q: "" },
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=2400&q=85",
    title: "Latest Smartphones.",
    highlight: "Unbeatable Deals.",
    cta: "Shop Phones",
    ctaTo: "/category/phones" as const,
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=2400&q=85",
    title: "Powerful Laptops.",
    highlight: "Work & Play.",
    cta: "Shop Laptops",
    ctaTo: "/category/laptops" as const,
  },
  {
    id: 4,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=2400&q=85",
    title: "Stunning TVs.",
    highlight: "Cinema at Home.",
    cta: "Shop TVs",
    ctaTo: "/category/tvs" as const,
  },
  {
    id: 5,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=2400&q=85",
    title: "Premium Audio.",
    highlight: "Pure Sound.",
    cta: "Shop Audio",
    ctaTo: "/category/headphones" as const,
  },
];

export function Hero() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const next = useCallback(() => setCurrent((i) => (i + 1) % slides.length), []);
  const prev = useCallback(() => setCurrent((i) => (i - 1 + slides.length) % slides.length), []);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, next]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    setTouchStart(null);
    setTouchEnd(null);
  };

  const slide = slides[current];

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
        {/* Background slides */}
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

        {/* Lighter overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-center px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto max-w-[700px]" key={current}>
            <h1 className="animate-hero-title text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              {slide.title}
              <br />
              <span className="text-accent">{slide.highlight}</span>
            </h1>
            <div className="animate-hero-cta mt-6 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Link
                to={slide.ctaTo}
                search={slide.ctaSearch}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_10px_30px_-8px_rgb(255_107_0/0.6)] transition hover:brightness-110 hover:shadow-[0_14px_36px_-8px_rgb(255_107_0/0.75)]"
              >
                {slide.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
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

        {/* Arrows */}
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

        {/* Dots */}
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
      </div>
    </section>
  );
}
