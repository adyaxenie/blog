"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkSidebar from "./components/WorkSidebar";
import {
  RANGES,
  DailyBrief,
  EconomicsOverlay,
  PaywallFunnel,
  PostHogWidget,
  RcHealthPanels,
  RevenueCatKpis,
  RevenueChart,
  TikTokWidget,
  WeeklyReport,
} from "./components/Widgets";
import { TikTokAdsTab } from "./components/TikTokAds";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tiktok", label: "TikTok Ads" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AdminDashboard() {
  const router = useRouter();
  const [days, setDays] = useState<number>(30);
  const [tab, setTab] = useState<TabId>("overview");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto flex max-w-[90rem] gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-semibold tracking-tight">Daily Glow</h1>
                <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                  UTC
                </span>
              </div>
              <nav className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      tab === t.id
                        ? "bg-zinc-700 font-medium text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.days}
                    onClick={() => setDays(r.days)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                      days === r.days
                        ? "bg-zinc-700 font-medium text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                onClick={logout}
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Log out
              </button>
            </div>
          </header>

          {tab === "overview" ? (
            <>
              <DailyBrief />
              <RevenueCatKpis days={days} />
              <EconomicsOverlay days={days} />
              <RevenueChart days={days} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PostHogWidget days={days} />
                <TikTokWidget days={days} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PaywallFunnel days={days} />
                <WeeklyReport />
              </div>

              <RcHealthPanels days={days} />
            </>
          ) : (
            <TikTokAdsTab days={days} />
          )}
        </div>

        <WorkSidebar />
      </div>
    </main>
  );
}
