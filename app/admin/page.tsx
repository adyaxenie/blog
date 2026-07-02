"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TodoList from "./components/TodoList";
import {
  RANGES,
  PostHogWidget,
  RevenueCatKpis,
  RevenueChart,
  TikTokWidget,
} from "./components/Widgets";

export default function AdminDashboard() {
  const router = useRouter();
  const [days, setDays] = useState<number>(30);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Daily Glow</h1>
            <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              UTC
            </span>
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

        <RevenueCatKpis days={days} />
        <RevenueChart days={days} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PostHogWidget days={days} />
          <TikTokWidget days={days} />
        </div>

        <TodoList />
      </div>
    </main>
  );
}
