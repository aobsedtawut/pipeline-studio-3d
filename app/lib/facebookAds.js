// Shared GET helper for the Marketing API — kept separate from
// app/api/ads-create/route.js's existing POST-only fb() helper so that
// working, money-safe write path is never touched by dashboard work.
const GRAPH_VERSION = "v25.0";

export async function fbGraphGet(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Facebook API error at ${path} (HTTP ${res.status})`);
  }
  return data;
}

// Fetches every page of a paginated Marketing API edge (insights, ads,
// activities, ...) via paging.next, returning the concatenated data[].
export async function fbGraphGetAllPages(path, params = {}) {
  let url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const all = [];
  let next = url.toString();
  let guard = 0;
  while (next && guard < 50) {
    guard++;
    const res = await fetch(next);
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Facebook API error at ${path} (HTTP ${res.status})`);
    }
    all.push(...(data.data || []));
    next = data.paging?.next || null;
  }
  return all;
}

// Verified against this account's live v25.0 insights response. Meta returns
// REPLIES for most Messenger campaigns and MESSAGING_PURCHASE_CONVERSION for
// campaigns optimized toward orders. Candidate arrays handle older campaigns
// whose purchase action is reported under a legacy alias.
export const OPTIMIZATION_GOAL_RESULT_ACTIONS = {
  CONVERSATIONS: ["onsite_conversion.messaging_conversation_started_7d"],
  REPLIES: ["onsite_conversion.messaging_conversation_started_7d"],
  MESSAGING_PURCHASE_CONVERSION: ["onsite_conversion.messaging_order_created_v2", "onsite_conversion.purchase"],
  LINK_CLICKS: ["link_click"],
  LANDING_PAGE_VIEWS: ["landing_page_view"],
  OFFSITE_CONVERSIONS: ["offsite_conversion.fb_pixel_purchase", "omni_purchase"],
};

export function extractResults(row) {
  const goal = row.optimization_goal;
  const actions = row.actions || [];

  if (goal === "THRUPLAY") {
    const results = (row.video_thruplay_watched_actions || []).reduce((sum, item) => sum + Number(item.value || 0), 0);
    return { results, resultType: "video_thruplay_watched_actions" };
  }
  if (goal === "REACH") return { results: Number(row.reach || 0), resultType: "reach" };
  if (goal === "IMPRESSIONS") return { results: Number(row.impressions || 0), resultType: "impressions" };

  let candidates = OPTIMIZATION_GOAL_RESULT_ACTIONS[goal];

  // Some legacy campaigns return the literal "Unknown Optimization Goal"
  // even though their actions clearly contain Messenger results.
  if (
    goal === "Unknown Optimization Goal" &&
    actions.some((a) => a.action_type === "onsite_conversion.messaging_conversation_started_7d")
  ) {
    candidates = ["onsite_conversion.messaging_conversation_started_7d"];
  }
  if (!candidates) return { results: null, resultType: null };

  const match = candidates.map((type) => actions.find((a) => a.action_type === type)).find(Boolean);
  return {
    results: match ? Number(match.value) : 0,
    resultType: match?.action_type || candidates[0],
  };
}

const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "frequency",
  "cpm",
  "ctr",
  "cpc",
  "actions",
  "video_thruplay_watched_actions",
  "objective",
  "optimization_goal",
  "date_start",
  "date_stop",
].join(",");

// Fetches normalized, per-day insight rows for one level (campaign/adset/ad)
// plus an effective_status lookup for every distinct entity at that level —
// shared by the live /api/ads-insights route and the /api/ads-sync route so
// the two never drift apart. `dateParams` is either
// { date_preset: "last_7d" } or { time_range: JSON.stringify({since,until}) }.
export async function fetchInsightRows({ act, token, level, dateParams, campaignId, statusMap: providedStatusMap }) {
  const params = {
    level,
    time_increment: 1,
    fields: INSIGHT_FIELDS,
    limit: 200,
    access_token: token,
    ...dateParams,
  };
  if (campaignId) {
    params.filtering = JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]);
  }

  const insightRows = await fbGraphGetAllPages(`${act}/insights`, params);

  let statusMap = providedStatusMap;
  if (!statusMap) {
    const entityEdge = level === "campaign" ? "campaigns" : level === "adset" ? "adsets" : "ads";
    statusMap = new Map();
    try {
      const statusRows = await fbGraphGetAllPages(`${act}/${entityEdge}`, {
        fields: "id,effective_status",
        limit: 200,
        access_token: token,
      });
      statusMap = new Map(statusRows.map((r) => [r.id, r.effective_status]));
    } catch {
      // status lookup is best-effort
    }
  }

  const idField = `${level}_id`;
  return insightRows.map((row) => {
    const spend = Number(row.spend || 0);
    const { results, resultType } = extractResults(row);
    return {
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      adsetId: row.adset_id || null,
      adsetName: row.adset_name || null,
      adId: row.ad_id || null,
      adName: row.ad_name || null,
      date: row.date_start,
      spend,
      impressions: Number(row.impressions || 0),
      reach: Number(row.reach || 0),
      clicks: Number(row.clicks || 0),
      frequency: row.frequency ? Number(row.frequency) : null,
      cpm: row.cpm ? Number(row.cpm) : null,
      ctr: row.ctr ? Number(row.ctr) : null,
      cpc: row.cpc ? Number(row.cpc) : null,
      results,
      resultType,
      costPerResult: results ? spend / results : null,
      objective: row.objective || null,
      optimizationGoal: row.optimization_goal || null,
      effectiveStatus: statusMap.get(row[idField]) || null,
    };
  });
}

export function entityIdForLevel(row, level) {
  return level === "campaign" ? row.campaignId : level === "adset" ? row.adsetId : row.adId;
}

export function entityNameForLevel(row, level) {
  return level === "campaign" ? row.campaignName : level === "adset" ? row.adsetName : row.adName;
}
