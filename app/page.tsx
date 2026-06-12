"use client";

import { useRef } from "react";
import Link from "next/link";
import { Space_Grotesk, Inter } from "next/font/google";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Sparkles } from "lucide-react";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const STATUS_STYLES: Record<string, string> = {
  Live: "text-emerald-400 border-emerald-400/30",
  Building: "text-amber-400 border-amber-400/30",
  Paused: "text-yellow-500 border-yellow-500/30",
  Failed: "text-rose-400 border-rose-400/30",
};

const WORK = [
  {
    name: "PDF Dino",
    domain: "pdfdino.com",
    url: "https://pdfdino.com",
    description: "AI-assisted PDF extraction to clean, structured data",
    status: "Live",
  },
  {
    name: "Daily Glowup",
    domain: "dailyglowup.app",
    url: "https://dailyglowup.app",
    description: "Consumer app, shipping daily",
    status: "Live",
  },
  {
    name: "SupBot AI",
    domain: "supbot.io",
    url: "https://supbot.io",
    description: "Autonomous support agent that learned your docs",
    status: "Failed",
  },
  {
    name: "RL TCG",
    domain: "rltcg.com",
    url: "https://rltcg.com",
    description: "Trading card experiment — sunset",
    status: "Failed",
  },
];

const EXPERIENCE = [
  {
    time: "May 2023 — Present",
    title: "Product Manager · Voter.Vote",
    points: [
      "Leading product for a political outreach platform handling millions of voters.",
      "Full-stack from backend architecture to frontend design — React, Django, AWS.",
    ],
  },
  {
    time: "Aug 2019 — May 2023",
    title: "San Jose State University",
    points: ["BBA — Entrepreneurship. Dean's Scholar (2022), Ideas Entrepreneurial Club."],
  },
];

const SKILLS = [
  "Next.js",
  "React",
  "Tailwind",
  "Supabase",
  "Django",
  "Python",
  "AWS",
  "MySQL",
  "OpenAI",
];

const MARQUEE_ITEMS = ["PDF DINO", "DAILY GLOWUP", "VOTER.VOTE", "SUPBOT AI", "RL TCG"];

export default function Page() {
  const reduced = !!useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const reveal = {
    initial: { opacity: 0, y: reduced ? 0 : 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <div
      className={`${grotesk.variable} ${inter.variable} relative min-h-screen bg-[#0a0a0a] text-white antialiased selection:bg-white selection:text-black`}
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <Grain />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 mix-blend-difference">
        <div className="flex items-center justify-between px-6 md:px-12 py-6 text-sm">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="font-medium tracking-tight"
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            Adrian Axenie
          </button>
          <div className="flex items-center gap-6">
            {[
              { id: "work", label: "Work" },
              { id: "experience", label: "Experience" },
              { id: "about", label: "About" },
              { id: "contact", label: "Contact" },
            ].map((i) => (
              <button
                key={i.id}
                onClick={() => scrollTo(i.id)}
                className="hidden md:block text-white/60 hover:text-white transition-colors"
              >
                {i.label}
              </button>
            ))}
            <Link
              href="/ascii"
              className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> ascii
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section ref={heroRef} className="relative flex min-h-screen flex-col justify-center px-6 md:px-12 pt-24 pb-16">
        <motion.div style={{ y: heroY, opacity: heroOpacity }}>
          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-sm md:text-base text-white/50 tracking-widest uppercase"
          >
            Product engineer & founder — Bay Area
          </motion.p>

          <h1
            className="text-[15vw] md:text-[11vw] font-bold leading-[0.88] tracking-[-0.04em]"
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            <RevealLine text="Adrian" delay={0.15} reduced={reduced} />
            <RevealLine text="Axenie" delay={0.3} reduced={reduced} className="text-white/40" />
          </h1>

          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-10 flex flex-col md:flex-row md:items-end md:justify-between gap-8"
          >
            <p className="max-w-md text-base md:text-lg text-white/60 leading-relaxed">
              I design, build, and ship products end-to-end — some live, some
              dead, all shipped.
            </p>
            <button
              onClick={() => scrollTo("work")}
              className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm hover:bg-white hover:text-black transition-colors"
            >
              Selected work
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/30 tracking-widest uppercase"
        >
          Scroll
        </motion.div>
      </section>

      {/* MARQUEE */}
      <div className="relative overflow-hidden border-y border-white/10 py-5">
        <div className={`flex w-max gap-12 whitespace-nowrap ${reduced ? "" : "animate-marquee"}`}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-12 text-2xl md:text-4xl font-semibold tracking-tight text-white/20"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              {item} <span className="text-white/10">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* WORK */}
      <section id="work" className="px-6 md:px-12 py-24 md:py-36">
        <SectionLabel index="01" label="Selected work" />
        <div className="mt-12">
          {WORK.map((project, i) => (
            <motion.a
              key={project.domain}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              {...reveal}
              transition={{ ...reveal.transition, delay: reduced ? 0 : i * 0.05 }}
              className="group relative block border-t border-white/10 last:border-b"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-10 md:py-12 transition-colors duration-300 group-hover:px-4 md:group-hover:px-6">
                <div className="flex items-baseline gap-6 md:gap-10">
                  <span className="text-sm text-white/30 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3
                      className="text-3xl md:text-5xl font-semibold tracking-tight group-hover:text-white text-white/90 transition-colors"
                      style={{ fontFamily: "var(--font-grotesk)" }}
                    >
                      {project.name}
                    </h3>
                    <p className="mt-2 text-sm md:text-base text-white/40">
                      {project.description} · {project.domain}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 pl-12 md:pl-0">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[project.status] ?? "text-white/60 border-white/20"}`}
                  >
                    {project.status}
                  </span>
                  <ArrowUpRight className="h-6 w-6 text-white/30 transition-all duration-300 group-hover:text-white group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.a>
          ))}
        </div>
      </section>

      {/* EXPERIENCE */}
      <section id="experience" className="px-6 md:px-12 py-24 md:py-36">
        <SectionLabel index="02" label="Experience" />
        <div className="mt-12 space-y-0">
          {EXPERIENCE.map((item) => (
            <motion.div
              key={item.title}
              {...reveal}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-8 border-t border-white/10 py-10 last:border-b"
            >
              <div className="md:col-span-4 text-sm text-white/40 font-mono pt-1">
                {item.time}
              </div>
              <div className="md:col-span-8">
                <h3
                  className="text-xl md:text-2xl font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-grotesk)" }}
                >
                  {item.title}
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {item.points.map((p) => (
                    <li key={p} className="text-sm md:text-base text-white/50 leading-relaxed">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="px-6 md:px-12 py-24 md:py-36">
        <SectionLabel index="03" label="About" />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-12">
          <motion.div {...reveal} className="md:col-span-7">
            <p
              className="text-2xl md:text-4xl leading-snug tracking-tight text-white/80"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              I build practical software, ship fast, and iterate. In winter I
              ski; in summer I chase mountain bike trails, climb, and play
              soccer.
            </p>
          </motion.div>
          <motion.div {...reveal} className="md:col-span-5">
            <p className="text-xs uppercase tracking-widest text-white/30 mb-4">
              Tools I reach for
            </p>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/60 hover:border-white/40 hover:text-white transition-colors"
                >
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="px-6 md:px-12 pt-24 md:pt-36 pb-12">
        <SectionLabel index="04" label="Contact" />
        <motion.div {...reveal} className="mt-12">
          <p className="text-white/40 text-sm md:text-base mb-4">
            Have an idea worth building?
          </p>
          <a
            href="mailto:adyaxenie@gmail.com"
            className="group inline-block text-[9vw] md:text-[6vw] font-bold tracking-[-0.03em] leading-none hover:text-white/60 transition-colors"
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            adyaxenie@gmail.com
            <span className="block h-[2px] max-w-0 group-hover:max-w-full bg-white/60 transition-all duration-500" />
          </a>
        </motion.div>

        <div className="mt-24 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-t border-white/10 pt-8 text-sm text-white/40">
          <p>© {new Date().getFullYear()} Adrian Axenie</p>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/adyaxenie"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/adrian-axenie/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Linkedin className="h-4 w-4" /> LinkedIn
            </a>
            <Link href="/ascii" className="flex items-center gap-2 hover:text-white transition-colors">
              <Sparkles className="h-4 w-4" /> ASCII universe
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* Staggered hero line reveal */
function RevealLine({
  text,
  delay,
  reduced,
  className = "",
}: {
  text: string;
  delay: number;
  reduced: boolean;
  className?: string;
}) {
  return (
    <span className="block overflow-hidden">
      <motion.span
        initial={{ y: reduced ? 0 : "100%" }}
        animate={{ y: 0 }}
        transition={{ duration: reduced ? 0 : 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
        className={`block ${className}`}
      >
        {text}
      </motion.span>
    </span>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-4 text-xs uppercase tracking-widest text-white/30">
      <span className="tabular-nums">{index}</span>
      <span className="h-px w-12 bg-white/20" />
      <span>{label}</span>
    </div>
  );
}

/* Fixed film-grain overlay */
function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 opacity-[0.04]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
