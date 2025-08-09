"use client";
import React, { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Github, Linkedin, ArrowUpRight } from "lucide-react";
import Timeline from "@/components/timeline";

/**
 * App Router: app/page.tsx
 * Bright liquid‑glass UI with a CRM‑style Projects section.
 * FIX: coerce `useReducedMotion()` (boolean | null) to a strict boolean.
 */

export default function Page() {
  const rm = useReducedMotion();
  const reduced = !!rm; // ensure boolean (not boolean | null)

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const reveal = useMemo(
    () => ({
      initial: { opacity: 0, y: reduced ? 0 : 18 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: reduced ? 0 : 0.6, ease: "easeOut" },
    }),
    [reduced]
  );

  return (
    <div className="relative min-h-screen antialiased text-slate-900 selection:bg-sky-300/40 selection:text-slate-900">
      <LiquidBackground reduced={reduced} />

      {/* NAV */}
      <nav aria-label="Primary" className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] md:w-[90%]">
        <div className="backdrop-blur-2xl bg-white/60 border border-white/80 shadow-[0_8px_40px_rgba(15,23,42,0.08)] rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between">
          <button onClick={() => scrollTo("landing")} className="text-lg md:text-xl font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 rounded-lg px-1">
            Adrian Axenie
          </button>
          <div className="hidden md:flex items-center gap-6">
            {[
              { id: "projects", label: "Projects" },
              { id: "timeline", label: "Experience" },
              { id: "about", label: "About" },
            ].map((i) => (
              <button
                key={i.id}
                onClick={() => scrollTo(i.id)}
                className="text-sm md:text-[15px] text-slate-700 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 rounded-lg px-2 py-1"
              >
                {i.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <IconLink href="https://www.linkedin.com/in/adrian-axenie/" ariaLabel="LinkedIn">
              <Linkedin className="h-5 w-5" />
            </IconLink>
            <IconLink href="https://github.com/adyaxenie" ariaLabel="GitHub">
              <Github className="h-5 w-5" />
            </IconLink>
          </div>
        </div>
      </nav>

      {/* LANDING */}
      <section id="landing" className="relative pt-40 md:pt-48 pb-16 md:pb-24">
        <div className="mx-auto w-[92%] md:w-[80%] max-w-6xl">
          <motion.div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Hi there,
              <br className="hidden md:block" /> I&apos;m Adrian.
            </h1>
            <p className="mt-5 text-base md:text-lg text-slate-600">
              Software Developer & Product Manager — I like to build things.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={() => scrollTo("projects")}
                className="rounded-2xl px-5 py-3 bg-white text-slate-900 font-medium shadow-[0_6px_18px_rgba(15,23,42,0.08)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)] border border-white/80 transition"
              >
                View Portfolio
              </button>
              <button
                onClick={() => scrollTo("about")}
                className="rounded-2xl px-5 py-3 border border-white/80 backdrop-blur-xl bg-white/50 hover:bg-white/70 transition text-slate-800"
              >
                About Me
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PROJECTS — CRM-style focus on PDF Dino */}
      <section id="projects" className="relative py-10 md:py-20">
        <div className="mx-auto w-[92%] md:w-[90%] max-w-7xl">
          <Header title="Live Projects" subtitle="Currently shipping" />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 pt-4">
            {/* PDF Dino — featured with video */}
            <div className="md:col-span-7">
              <GlassCard className="group">
              <div className="relative">
                <div className="aspect-[16/9] w-full overflow-hidden">
                <video
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src="/demo.mp4" type="video/mp4" />
                </video>
                </div>
                <div className="p-5 md:p-6 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {["PDF → JSON/CSV", "LLM parsing", "Next.js + Supabase"].map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-white/70 border border-white/80 text-[12px] text-slate-700">
                    {t}
                  </span>
                  ))}
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                  <h3 className="text-xl md:text-2xl font-semibold">PDF Dino</h3>
                  <p className="text-slate-700 text-sm md:text-base mt-1">
                    AI‑assisted PDF extraction to clean, structured data.
                  </p>
                  </div>
                  <a
                  href="https://pdfdino.com"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-white/80 bg-white/70 hover:bg-white/90 transition px-3 py-2 text-sm text-slate-900"
                  >
                  Open PDF Dino <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
                </div>
              </div>
              </GlassCard>
            </div>

            {/* Right column: SupBot status + CRM metrics */}
            <div className="md:col-span-5 grid grid-rows-2 gap-6">
              <MetricsCard
                metrics={[
                  { label: "Users", value: "3.3K" },
                  { label: "Visitors", value: "25K" },
                  { label: "Revenue", value: "$200" },
                  { label: "Status", value: "Live" },
                ]}
              />

              <StatusProject
                title="SupBot AI"
                href="https://supbot.io"
                status="Failed"
                description="Autonomous support agent that learned your docs and handled FAQs. Project discontinued."
              />
            </div>
          </div>
        </div>
      </section>

      {/* TIMELINE (placeholder) */}
      <section id="timeline" className="relative py-10 md:py-20">
        <div className="mx-auto w-[92%] md:w-[85%] max-w-6xl">
          <Header title="Experience" subtitle="A quick walk through what I&apos;ve built and led" />
          <GlassCard>
            <div className="p-6">
              <Timeline />
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="relative py-10 md:py-20">
        <div className="mx-auto w-[92%] md:w-[85%] max-w-6xl">
          <Header title="About" subtitle="Tools I use & the person behind them" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <GlassCard>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2">About Me</h3>
                <p className="text-slate-700 text-sm md:text-base">
                  I build practical software, ship fast, and iterate. Lately: PDF Dino, RL.TCG, Quant Trading, and AI workflows. In winter I ski, in summer I chase mountain bike trails, climb, and play soccer.
                </p>
                <p className="text-slate-700 text-sm md:text-base mt-4">
                  Contact: <span className="font-semibold">adyaxenie@gmail.com</span>
                </p>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-4">Skills</h3>
                <ul className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm md:text-base text-slate-800">
                  <li>Next.js</li>
                  <li>React</li>
                  <li>Tailwind</li>
                  <li>Supabase</li>
                  <li>Django</li>
                  <li>Python / Sklearn</li>
                  <li>AWS</li>
                  <li>MySQL</li>
                  <li>OpenAI</li>
                </ul>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative pb-10 pt-8">
        <div className="mx-auto w-[92%] md:w-[85%] max-w-6xl">
          <div className="backdrop-blur-2xl bg-white/60 border border-white/80 rounded-2xl px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
            <p className="text-sm text-slate-700">© {new Date().getFullYear()} Adrian Axenie</p>
            <div className="flex items-center gap-3">
              <IconLink href="https://www.linkedin.com/in/adrian-axenie/" ariaLabel="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </IconLink>
              <IconLink href="https://github.com/adyaxenie" ariaLabel="GitHub">
                <Github className="h-5 w-5" />
              </IconLink>
            </div>
          </div>
        </div>
      </footer>

      <SectionDots sections={["landing", "projects", "timeline", "about"]} />
    </div>
  );
}

/*** Reusable UI ***/
function IconLink({ href, ariaLabel, children }: { href: string; ariaLabel: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/80 bg-white/60 hover:bg-white/80 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 text-slate-900"
    >
      {children}
    </a>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/80 bg-white/60 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-xs md:text-sm text-slate-700">{subtitle}</span>
      </div>
      <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl border border-white/80 bg-white/60 backdrop-blur-2xl overflow-hidden shadow-[0_8px_40px_rgba(15,23,42,0.08)] ${className}`}>
      <div className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity">
        <div className="absolute -inset-1 rounded-[22px] bg-gradient-to-br from-white via-white/70 to-transparent blur-xl" />
      </div>
      {children}
    </div>
  );
}

function FeatureProjectVideo({
  title,
  href,
  videoSrc,
  poster,
  tags,
  description,
  cta,
}: {
  title: string;
  href: string;
  videoSrc: string;
  poster: string;
  tags: string[];
  description: string;
  cta: string;
}) {
  return (
    <GlassCard className="group">
      <div className="relative">
        <div className="aspect-[16/9] w-full overflow-hidden">
          <video className="h-full w-full object-cover" autoPlay loop muted playsInline poster={poster}>
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>
        <div className="p-5 md:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-white/70 border border-white/80 text-[12px] text-slate-700">
                {t}
              </span>
            ))}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl md:text-2xl font-semibold">{title}</h3>
              <p className="text-slate-700 text-sm md:text-base mt-1">{description}</p>
            </div>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-white/80 bg-white/70 hover:bg-white/90 transition px-3 py-2 text-sm text-slate-900"
            >
              {cta} <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function StatusProject({ title, href, status, description }: { title: string; href: string; status: "Live" | "Failed" | "Paused"; description: string }) {
  const statusColor = status === "Failed" ? "bg-rose-500" : status === "Paused" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <GlassCard>
      <div className="p-6 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between">
          <h3 className="text-lg md:text-xl font-semibold">{title}</h3>
          <span className={`px-2.5 py-1 rounded-full text-xs text-white ${statusColor}`}>{status}</span>
        </div>
        <p className="text-slate-700 text-sm md:text-[15px] mt-2">{description}</p>
        <div className="mt-4">
          <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/80 bg-white/70 hover:bg-white/90 transition px-3 py-2 text-sm text-slate-900">
            Visit <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </GlassCard>
  );
}

function MetricsCard({ metrics }: { metrics: { label: string; value: string }[] }) {
  return (
    <GlassCard>
      <div className="p-6 mt-10 flex justify-center grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-2xl md:text-3xl font-semibold">{m.value}</div>
            <div className="text-xs md:text-sm text-slate-600 mt-1">{m.label}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function SectionDots({ sections }: { sections: string[] }) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const id = e.target.getAttribute("id");
          if (!id) return;
          const link = document.querySelector(`[data-dot='${id}']`);
          if (!link) return;
          if (e.isIntersecting) link.classList.add("opacity-100", "scale-100");
          else link.classList.remove("opacity-100", "scale-100");
        });
      },
      { threshold: 0.5 }
    );

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-3">
      {sections.map((s) => (
        <a key={s} href={`#${s}`} data-dot={s} className="h-2.5 w-2.5 rounded-full bg-slate-400/60 hover:bg-slate-700 transition transform opacity-40 scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60" aria-label={`Jump to ${s}`} />
      ))}
    </div>
  );
}

function LiquidBackground({ reduced }: { reduced: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(191,219,254,0.7),transparent),radial-gradient(700px_500px_at_5%_20%,rgba(186,230,253,0.55),transparent),radial-gradient(900px_600px_at_95%_10%,rgba(219,234,254,0.6),transparent),linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)]" />

      <div className={`absolute -top-24 -left-16 h-[42vmax] w-[42vmax] rounded-full bg-white/70 blur-3xl ${reduced ? "" : "animate-blob"}`} />
      <div className={`absolute top-32 -right-24 h-[38vmax] w-[38vmax] rounded-full bg-sky-200/80 blur-3xl ${reduced ? "" : "animate-blob animation-delay-2000"}`} />
      <div className={`absolute -bottom-20 left-1/3 h-[36vmax] w-[36vmax] rounded-full bg-blue-100/80 blur-3xl ${reduced ? "" : "animate-blob animation-delay-4000"}`} />

      <svg className="absolute h-0 w-0">
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </svg>

      <div className="absolute inset-0 opacity-[0.05] mix-blend-soft-light" style={{ filter: "url(#goo)" }}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>
    </div>
  );
}

/* --- Tailwind additions (put in globals.css) ---
@layer utilities {
  .animation-delay-2000 { animation-delay: 2s; }
  .animation-delay-4000 { animation-delay: 4s; }
  .animate-blob { animation: blob 12s infinite; }
}
@keyframes blob {
  0%, 100% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(20px, -30px) scale(1.05); }
  66% { transform: translate(-15px, 20px) scale(0.97); }
}
*/
