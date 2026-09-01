// Creates a full Campaign -> Ad Set -> (video upload) -> Ad Creative -> Ad
// chain via the Facebook Marketing API — verified live against Meta's
// reference docs (ad-campaign-group, ad-campaign, ad-creative,
// ad-account/advideos) rather than guessed.
//
// Every object is created PAUSED. This route never sets anything ACTIVE —
// that's a deliberate line: turning an ad set live starts real ad spend,
// so activating it is left as a manual step in Ads Manager (the response
// includes a direct link there). This mirrors the pattern used for the
// account's past campaigns (engagement objective, Messenger destination,
// Thailand/20-65+ targeting) seen in its historical exports, but any of
// that can be overridden from the request body.
const GRAPH_VERSION = "v25.0";

async function fb(path, params) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Facebook API error at ${path} (HTTP ${res.status})`);
  }
  return data;
}

export async function POST(request) {
  const userToken = process.env.FB_USER_ACCESS_TOKEN;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;
  if (!userToken || !adAccountId) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า FB_USER_ACCESS_TOKEN / FB_AD_ACCOUNT_ID ใน Environment Variables" },
      { status: 400 }
    );
  }
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const {
    campaignName,
    pageId,
    dailyBudgetTHB,
    countries,
    ageMin,
    ageMax,
    genders, // "all" | "male" | "female"
    videoUrl,
    message,
  } = body;

  if (!campaignName || !pageId || !dailyBudgetTHB || !videoUrl || !message) {
    return Response.json(
      { error: "ต้องระบุ campaignName, pageId, dailyBudgetTHB, videoUrl, message" },
      { status: 400 }
    );
  }

  try {
    // 1) Campaign — outcome-driven engagement objective, matches the
    // Messenger-conversation pattern already proven in this account's past
    // campaigns. special_ad_categories is a required field even when none
    // of the regulated categories (housing/employment/credit/etc.) apply.
    const campaign = await fb(`${act}/campaigns`, {
      access_token: userToken,
      name: campaignName,
      objective: "OUTCOME_ENGAGEMENT",
      special_ad_categories: [],
      status: "PAUSED",
    });

    // 2) Ad set — budget in satang (THB smallest unit) per Marketing API
    // convention (integer, minor currency unit).
    const genderCodes = genders === "male" ? [1] : genders === "female" ? [2] : [];
    const adSet = await fb(`${act}/adsets`, {
      access_token: userToken,
      campaign_id: campaign.id,
      name: `${campaignName} — ชุดโฆษณา`,
      daily_budget: Math.round(Number(dailyBudgetTHB) * 100),
      billing_event: "IMPRESSIONS",
      optimization_goal: "CONVERSATIONS",
      destination_type: "MESSENGER",
      promoted_object: { page_id: pageId },
      targeting: {
        geo_locations: { countries: countries?.length ? countries : ["TH"] },
        age_min: ageMin || 20,
        age_max: ageMax || 65,
        ...(genderCodes.length ? { genders: genderCodes } : {}),
      },
      status: "PAUSED",
    });

    // 3) Video — Facebook fetches the file itself from the Blob URL, same
    // pattern as /api/reel-publish.
    const video = await fb(`${act}/advideos`, {
      access_token: userToken,
      file_url: videoUrl,
    });

    // 4) Ad creative — page post with the uploaded video, Messenger CTA.
    const creative = await fb(`${act}/adcreatives`, {
      access_token: userToken,
      object_story_spec: {
        page_id: pageId,
        video_data: {
          video_id: video.video_id || video.id,
          message,
          call_to_action: { type: "MESSAGE_PAGE", value: { app_destination: "MESSENGER" } },
        },
      },
    });

    // 5) Ad — ties the ad set and creative together, still paused.
    const ad = await fb(`${act}/ads`, {
      access_token: userToken,
      name: `${campaignName} — โฆษณา`,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });

    return Response.json({
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      manageUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace("act_", "")}`,
    });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
