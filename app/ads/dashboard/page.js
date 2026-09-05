"use client";

import { Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Logo from "../../components/Logo";
import Topbar from "../../components/Topbar";
import KpiStrip from "../../components/ads/KpiStrip";
import AdsTable from "../../components/ads/AdsTable";
import TrendChart from "../../components/ads/TrendChart";
import AnalysisPanel from "../../components/ads/AnalysisPanel";
import ProfitPanel from "../../components/ads/ProfitPanel";
import { fetchJson } from "../../lib/clientApi";

const TABS = [
  { key: "insights", label: "📈 Insights" },
  { key: "analysis", label: "🧠 Analysis" },
  { key: "profit", label: "💰 Profit" },
];

const LEVELS = [
  { key: "campaign", label: "แคมเปญ" },
  { key: "adset", label: "ชุดโฆษณา" },
  { key: "ad", label: "โฆษณา" },
];

const DATE_PRESETS = [
  { key: "today", label: "วันนี้" },
  { key: "yesterday", label: "เมื่อวาน" },
  { key: "last_7d", label: "7 วันล่าสุด" },
  { key: "last_30d", label: "30 วันล่าสุด" },
];

function AdsDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const requestedTab = searchParams.get("tab");
  const requestedLevel = searchParams.get("level");
  const requestedDate = searchParams.get("date");
  const tab = TABS.some((item) => item.key === requestedTab) ? requestedTab : "insights";
  const level = LEVELS.some((item) => item.key === requestedLevel) ? requestedLevel : "campaign";
  const datePreset = DATE_PRESETS.some((item) => item.key === requestedDate) ? requestedDate : "last_7d";
  const campaignId = searchParams.get("campaign") || "";

  function updateUrl(values) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const campaignsQuery = useQuery({
    queryKey: ["ads", "campaigns"],
    queryFn: () => fetchJson("/api/ads-campaigns"),
  });
  const campaigns = campaignsQuery.data?.campaigns || [];

  const insightsQuery = useQuery({
    queryKey: ["ads", "insights", level, datePreset, campaignId],
    queryFn: () => {
      const params = new URLSearchParams({ level, datePreset });
      if (campaignId) params.set("campaignId", campaignId);
      return fetchJson(`/api/ads-insights?${params.toString()}`);
    },
    enabled: tab === "insights",
  });
  const rows = insightsQuery.data?.rows || [];
  const totals = insightsQuery.data?.totals || null;

  const syncMutation = useMutation({
    mutationFn: () =>
      fetchJson("/api/ads-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ads", "campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["ads", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["ads", "analysis"] }),
        queryClient.invalidateQueries({ queryKey: ["ads", "roi"] }),
      ]);
    },
  });

  return (
    <>
      <Topbar />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "var(--accent)" }}>
            <Logo size={32} />
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>Ads Dashboard</h1>
        </div>
        <p className="hint" style={{ marginBottom: 20 }}>
          ดูผลลัพธ์แคมเปญจริง วิเคราะห์จุดบอด และคำนวณกำไร — ทั้งหมดเป็นการอ่านข้อมูลเท่านั้น ไม่มีการเปิดใช้งานแคมเปญอัตโนมัติ
        </p>

        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="btn small secondary"
              style={tab === t.key ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
              onClick={() => updateUrl({ tab: t.key })}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "insights" && (
          <div className="stage unlocked">
            <div className="flex gap-2" style={{ flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className="btn small secondary"
                  style={level === l.key ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
                  onClick={() => updateUrl({ level: l.key })}
                >
                  {l.label}
                </button>
              ))}
              <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
              {DATE_PRESETS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="btn small secondary"
                  style={datePreset === d.key ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
                  onClick={() => updateUrl({ date: d.key })}
                >
                  {d.label}
                </button>
              ))}
              {campaigns.length > 0 && (
                <select value={campaignId} onChange={(e) => updateUrl({ campaign: e.target.value })} style={{ maxWidth: 220 }}>
                  <option value="">ทุกแคมเปญ</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {campaignsQuery.isError && <span className="hint warn">{campaignsQuery.error.message}</span>}
              <button className="btn small" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} style={{ marginLeft: "auto" }}>
                {syncMutation.isPending ? "กำลังซิงค์…" : "🔄 ซิงค์ข้อมูลล่าสุด"}
              </button>
            </div>
            {syncMutation.isSuccess && (
              <div className="status-pill ok" style={{ marginBottom: 12 }}>
                ซิงค์แล้ว {syncMutation.data.upserted.snapshots} snapshot, {syncMutation.data.upserted.editEvents} เหตุการณ์แก้ไข
              </div>
            )}
            {syncMutation.isError && <div className="status-pill err" style={{ marginBottom: 12 }}>{syncMutation.error.message}</div>}

            {insightsQuery.isPending && <div className="hint">กำลังโหลดข้อมูล…</div>}
            {insightsQuery.isError && <div className="hint warn">{insightsQuery.error.message}</div>}
            {insightsQuery.isSuccess && (
              <>
                <KpiStrip totals={totals} />
                <div style={{ marginTop: 20, marginBottom: 20 }}>
                  <TrendChart rows={rows} metric="spend" label="งบที่ใช้ต่อวัน (฿)" decimals={0} />
                </div>
                <AdsTable rows={rows} level={level} />
              </>
            )}
          </div>
        )}

        {tab === "analysis" && (
          <div className="stage unlocked">
            <AnalysisPanel campaigns={campaigns} campaignId={campaignId} onCampaignChange={(id) => updateUrl({ campaign: id })} />
          </div>
        )}

        {tab === "profit" && (
          <div className="stage unlocked">
            <ProfitPanel campaigns={campaigns} campaignId={campaignId} onCampaignChange={(id) => updateUrl({ campaign: id })} />
          </div>
        )}
      </div>
    </>
  );
}

export default function AdsDashboardPage() {
  return (
    <Suspense fallback={<div className="hint" style={{ padding: 40 }}>กำลังโหลด Dashboard…</div>}>
      <AdsDashboardContent />
    </Suspense>
  );
}
