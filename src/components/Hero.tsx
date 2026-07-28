import { Link } from "@tanstack/react-router";
import { ArrowRight, LayoutGrid } from "lucide-react";

export function Hero() {
  return (
    <section className="pt-4 sm:pt-6">
      <div className="relative mx-auto h-[50vh] max-h-[420px] min-h-[260px] max-w-7xl overflow-hidden rounded-3xl sm:rounded-[32px]">
        {/* Background */}
        <div className="absolute inset-0 animate-hero-zoom">
          <img
            src="https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=2400&q=85"
            alt="Premium electronics workspace"
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-center px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto max-w-[700px]">
            <h1 className="animate-hero-title text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              Smart Electronics.
              <br />
              <span className="text-accent">Better Prices.</span>
            </h1>
            <p className="animate-hero-sub mx-auto mt-4 max-w-lg text-sm text-white/85 sm:mt-5 sm:text-base">
              Discover quality electronics, accessories, and smart devices
              delivered across Rwanda.
            </p>
            <div className="animate-hero-cta mt-6 flex flex-col items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <Link
                to="/search"
                search={{ q: "" }}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_10px_30px_-8px_rgb(255_107_0/0.6)] transition hover:brightness-110 hover:shadow-[0_14px_36px_-8px_rgb(255_107_0/0.75)]"
              >
                Shop Now
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
      </div>
    </section>
  );
}
