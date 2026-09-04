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

// Maps a Marketing API optimization_goal to the actions[] action_type this
// account's results should be counted from. CONVERSATIONS/Messenger is the
// pattern already proven in this account's own past campaigns (see
// ads-create/route.js) — the exact action_type string below is a
// best-effort guess and MUST be verified against a real /insights call
// (fields=actions,optimization_goal) before being relied on; see the
// Phase 1 verification step in the plan.
export const OPTIMIZATION_GOAL_RESULT_ACTION = {
  CONVERSATIONS: "onsite_conversion.messaging_conversation_started_7d",
  LINK_CLICKS: "link_click",
  LANDING_PAGE_VIEWS: "landing_page_view",
  OFFSITE_CONVERSIONS: "offsite_conversion.fb_pixel_purchase",
  REACH: "impression",
  IMPRESSIONS: "impression",
};

export function extractResults(row) {
  const goal = row.optimization_goal;
  const actionType = OPTIMIZATION_GOAL_RESULT_ACTION[goal];
  const actions = row.actions || [];
  if (!actionType) return { results: null, resultType: null };
  const match = actions.find((a) => a.action_type === actionType);
  return { results: match ? Number(match.value) : 0, resultType: actionType };
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
