"use client";

import { useState, useEffect } from "react";
import Stage from "./Stage";

// Shopee's Affiliate Open API is keyword-search only (no browse-by-category
// endpoint), so "categories" here are just preset keywords per department —
// a shortcut into the same search, not a real category filter.
const CATEGORY_PRESETS = [
  { label: "อาหาร", icon: "🍪", keyword: "ขนมทานเล่น" },
  { label: "ความงาม", icon: "💄", keyword: "เซรั่มหน้าใส" },
  { label: "แฟชั่นผู้หญิง", icon: "👗", keyword: "เสื้อผ้าผู้หญิง" },
  { label: "บ้าน", icon: "🏠", keyword: "ของแต่งบ้าน" },
  { label: "สัตว์เลี้ยง", icon: "🐾", keyword: "ของเล่นแมว" },
  { label: "กีฬา", icon: "🏋️", keyword: "อุปกรณ์ออกกำลังกาย" },
];

const SORT_OPTIONS = [
  { value: "commission", label: "Commission", icon: "💰" },
  { value: "sales", label: "ขายดี", icon: "🔥" },
  { value: "rating", label: "คะแนน", icon: "⭐" },
  { value: "price", label: "ราคา", icon: "💵" },
];

// Shopee and TikTok Shop have live search integrations. Lazada has no
// official affiliate/offer-search API at all (verified against its Open
// Platform docs — only third-party networks like Involve Asia offer one,
// which is a separate integration), so it and any other platform go
// through manual entry below.
const PLATFORMS = [
  { key: "shopee", label: "Shopee", icon: "🛍️" },
  { key: "tiktok", label: "TikTok Shop", icon: "🎵" },
  { key: "lazada", label: "Lazada", icon: "🅻" },
  { key: "other", label: "อื่นๆ", icon: "🔗" },
];

const TIKTOK_SORT_OPTIONS = [
  { value: "commission", label: "Commission", icon: "💰" },
  { value: "sales", label: "ขายดี", icon: "🔥" },
  { value: "price", label: "ราคา", icon: "💵" },
];

const EMPTY_MANUAL_FORM = {
  platform: "shopee",
  productName: "",
  shopName: "",
  price: "",
  commissionRate: "",
  sales: "",
  ratingStar: "",
  affiliateLink: "",
  imageUrl: "",
};

export default function ProductStage({ unlocked, meta, setMeta, done, onDone }) {
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState("commission");
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState(null); // null | "loading" | "ok" | "err"
  const [msg, setMsg] = useState("");
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(meta.chosenProduct || null);
  const [aiStatus, setAiStatus] = useState(null); // null | "loading" | "ok" | "err"
  const [aiMsg, setAiMsg] = useState("");
  const [aiPicks, setAiPicks] = useState({}); // itemId -> reason
  const [mode, setMode] = useState("search"); // "search" | "tiktok" | "manual"
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [manualMsg, setManualMsg] = useState("");
  const [tiktokConnected, setTiktokConnected] = useState(null); // null (checking) | true | false
  const [tiktokKeyword, setTiktokKeyword] = useState("");
  const [tiktokSortBy, setTiktokSortBy] = useState("commission");
  const [tiktokStatus, setTiktokStatus] = useState(null); // null | "loading" | "ok" | "err"
  const [tiktokMsg, setTiktokMsg] = useState("");
  const [choosingId, setChoosingId] = useState(null);

  useEffect(() => {
    fetch("/api/tiktok-auth/status")
      .then((r) => r.json())
      .then((d) => setTiktokConnected(!!d.connected))
      .catch(() => setTiktokConnected(false));

    const params = new URLSearchParams(window.location.search);
    const tiktokParam = params.get("tiktok");
    if (tiktokParam === "connected") {
      setMode("tiktok");
      setTiktokMsg("✓ เชื่อมต่อ TikTok Shop สำเร็จ");
    } else if (tiktokParam === "error") {
      setMode("tiktok");
      setTiktokStatus("err");
      setTiktokMsg("เชื่อมต่อ TikTok Shop ไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
    if (tiktokParam) {
      params.delete("tiktok");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  async function searchTiktok(overrideSort) {
    if (!tiktokKeyword.trim()) return;
    const sb = overrideSort ?? tiktokSortBy;
    setTiktokStatus("loading");
    setTiktokMsg("");
    setAiPicks({});
    try {
      const res = await fetch("/api/tiktok-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: tiktokKeyword, sortBy: sb, pageSize: Number(limit) }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setTiktokStatus("ok");
        if (!data.products?.length) setTiktokMsg("ไม่พบสินค้าตรงคำค้นหานี้");
      } else {
        setTiktokStatus("err");
        setTiktokMsg(data.error || "ค้นหาไม่สำเร็จ");
      }
    } catch (e) {
      setTiktokStatus("err");
      setTiktokMsg(String(e.message || e));
    }
  }

  function changeTiktokSort(value) {
    setTiktokSortBy(value);
    if (products.length) searchTiktok(value);
  }

  async function search(overrideKeyword, overrideSort) {
    const kw = overrideKeyword ?? keyword;
    const sb = overrideSort ?? sortBy;
    if (!kw.trim()) return;
    setStatus("loading");
    setMsg("");
    setAiPicks({});
    try {
      const res = await fetch("/api/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, sortBy: sb, limit: Number(limit) }),
      });
      const data = await res.json();
      if (res.ok) {
        setProducts(data.products || []);
        setStatus("ok");
        if (!data.products?.length) setMsg("ไม่พบสินค้าตรงคำค้นหานี้");
      } else {
        setStatus("err");
        setMsg(data.error || "ค้นหาไม่สำเร็จ");
      }
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  function pickCategory(preset) {
    setKeyword(preset.keyword);
    search(preset.keyword);
  }

  function changeSort(value) {
    setSortBy(value);
    if (products.length) search(keyword, value);
  }

  async function aiCurate() {
    setAiStatus("loading");
    setAiMsg("");
    try {
      const res = await fetch("/api/product-curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, keyword }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.picks)) {
        const map = {};
        data.picks.forEach((p) => (map[p.itemId] = p.reason));
        setAiPicks(map);
        setAiStatus("ok");
        if (!data.picks.length) setAiMsg("AI ไม่พบสินค้าที่น่าแนะนำในรอบนี้");
      } else {
        setAiStatus("err");
        setAiMsg(data.error || "AI คัดสินค้าไม่สำเร็จ");
      }
    } catch (e) {
      setAiStatus("err");
      setAiMsg(String(e.message || e));
    }
  }

  const sortedProducts = Object.keys(aiPicks).length
    ? [...products].sort((a, b) => (aiPicks[b.itemId] ? 1 : 0) - (aiPicks[a.itemId] ? 1 : 0))
    : products;

  function setManualField(field, value) {
    setManualForm((f) => ({ ...f, [field]: value }));
  }

  function addManualProduct() {
    setManualMsg("");
    if (!manualForm.productName.trim() || !manualForm.affiliateLink.trim()) {
      setManualMsg("ต้องกรอกอย่างน้อย ชื่อสินค้า และลิงก์ affiliate");
      return;
    }
    const platform = PLATFORMS.find((p) => p.key === manualForm.platform);
    const newProduct = {
      itemId: `manual-${Date.now()}`,
      productName: manualForm.productName.trim(),
      shopName: manualForm.shopName.trim() || platform.label,
      price: manualForm.price ? Number(manualForm.price) : undefined,
      commissionRate: manualForm.commissionRate ? Number(manualForm.commissionRate) / 100 : undefined,
      sales: manualForm.sales ? Number(manualForm.sales) : undefined,
      ratingStar: manualForm.ratingStar ? Number(manualForm.ratingStar) : undefined,
      imageUrl: manualForm.imageUrl.trim() || undefined,
      offerLink: manualForm.affiliateLink.trim(),
      productLink: manualForm.affiliateLink.trim(),
      platform: manualForm.platform,
      platformIcon: platform.icon,
    };
    setProducts((prev) => [newProduct, ...prev]);
    setManualForm({ ...EMPTY_MANUAL_FORM, platform: manualForm.platform });
  }

  async function choose(p) {
    let chosen = p;
    // TikTok search results carry the plain product page, not a
    // commission-tracked link — that needs a separate API call, made here
    // (lazily, only for the product actually picked) rather than for every
    // search result.
    if (p.platform === "tiktok" && p._tiktokProductId && !p.offerLink) {
      setChoosingId(p.itemId);
      try {
        const res = await fetch("/api/tiktok-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: p._tiktokProductId }),
        });
        const data = await res.json();
        if (res.ok && data.link) {
          chosen = { ...p, offerLink: data.link };
          setProducts((prev) => prev.map((x) => (x.itemId === p.itemId ? chosen : x)));
        } else {
          setTiktokMsg(data.error || "สร้างลิงก์ affiliate ไม่สำเร็จ — เลือกสินค้านี้ไม่ได้");
          setChoosingId(null);
          return;
        }
      } catch (e) {
        setTiktokMsg(String(e.message || e));
        setChoosingId(null);
        return;
      }
      setChoosingId(null);
    }
    setSelected(chosen);
    setMeta({
      ...meta,
      productName: chosen.productName,
      chosenProduct: chosen,
      affiliateLink: chosen.offerLink || chosen.productLink || "",
    });
    onDone();
  }

  return (
    <Stage
      num={1}
      character="product"
      accent="--accent"
      title="เลือกสินค้า (Product)"
      sub="ค้นหาสินค้า Shopee affiliate อัตโนมัติ หรือกรอกเองจากแพลตฟอร์มไหนก็ได้ (Shopee/TikTok Shop/Lazada/อื่นๆ) — เลือกอันที่ commission สูงสุด (หรือ sales/rating/price) เพื่อใช้ทำสคริปต์ต่อ"
      unlocked={unlocked}
    >
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn small secondary"
          style={mode === "search" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          onClick={() => setMode("search")}
        >
          🔍 ค้นหาอัตโนมัติ (Shopee)
        </button>
        <button
          type="button"
          className="btn small secondary"
          style={mode === "tiktok" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          onClick={() => setMode("tiktok")}
        >
          🎵 ค้นหาอัตโนมัติ (TikTok Shop)
        </button>
        <button
          type="button"
          className="btn small secondary"
          style={mode === "manual" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
          onClick={() => setMode("manual")}
        >
          ✍️ กรอกเอง (ทุกแพลตฟอร์ม)
        </button>
      </div>

      {mode === "search" && (
        <>
          <label className="field-label">หมวดหมู่ (เติมคำค้นให้อัตโนมัติ)</label>
          <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
            {CATEGORY_PRESETS.map((c) => (
              <button
                key={c.label}
                type="button"
                className="btn small secondary"
                onClick={() => pickCategory(c)}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          <label className="field-label">คำค้นหา</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="เช่น เซรั่มหน้าใส"
            onKeyDown={(e) => e.key === "Enter" && search()}
          />

          <div className="row">
            <div>
              <label className="field-label">เรียงตาม</label>
              <div className="flex gap-2 flex-wrap">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className="btn small secondary"
                    style={
                      sortBy === o.value
                        ? { borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }
                        : undefined
                    }
                    onClick={() => changeSort(o.value)}
                  >
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">จำนวนผลลัพธ์</label>
              <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} min={1} max={50} />
            </div>
          </div>

          <div className="flex gap-2.5 flex-wrap" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => search()} disabled={status === "loading"}>
              {status === "loading" ? "กำลังค้นหา…" : "🔍 ค้นหาสินค้า"}
            </button>
            {products.length > 0 && (
              <button className="btn secondary" onClick={aiCurate} disabled={aiStatus === "loading"}>
                {aiStatus === "loading" ? "กำลังให้ AI คัดสินค้า…" : "🤖 ให้ AI เลือกให้"}
              </button>
            )}
          </div>
          {msg && <div className={`hint ${status === "err" ? "warn" : ""}`}>{msg}</div>}
          {aiMsg && <div className={`hint ${aiStatus === "err" ? "warn" : ""}`}>{aiMsg}</div>}
        </>
      )}

      {mode === "tiktok" && (
        <>
          {tiktokConnected === null && <div className="hint">กำลังเช็คการเชื่อมต่อ…</div>}

          {tiktokConnected === false && (
            <div className="scene-card">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>ยังไม่ได้เชื่อมต่อ TikTok Shop</div>
              <div className="hint" style={{ marginBottom: 12 }}>
                ต้องล็อกอินด้วยบัญชี TikTok Shop Creator Affiliate ที่อนุมัติแล้วครั้งเดียว ระบบจะจำการเชื่อมต่อไว้
              </div>
              <a className="btn" href="/api/tiktok-auth/authorize">
                🎵 เชื่อมต่อ TikTok Shop
              </a>
              {tiktokMsg && <div className={`hint ${tiktokStatus === "err" ? "warn" : ""}`}>{tiktokMsg}</div>}
            </div>
          )}

          {tiktokConnected === true && (
            <>
              {tiktokMsg && !tiktokStatus && <div className="hint">{tiktokMsg}</div>}
              <label className="field-label">คำค้นหา</label>
              <input
                type="text"
                value={tiktokKeyword}
                onChange={(e) => setTiktokKeyword(e.target.value)}
                placeholder="เช่น เคสมือถือ"
                onKeyDown={(e) => e.key === "Enter" && searchTiktok()}
              />

              <label className="field-label">เรียงตาม</label>
              <div className="flex gap-2 flex-wrap">
                {TIKTOK_SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className="btn small secondary"
                    style={
                      tiktokSortBy === o.value
                        ? { borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }
                        : undefined
                    }
                    onClick={() => changeTiktokSort(o.value)}
                  >
                    {o.icon} {o.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2.5 flex-wrap" style={{ marginTop: 16 }}>
                <button className="btn" onClick={() => searchTiktok()} disabled={tiktokStatus === "loading"}>
                  {tiktokStatus === "loading" ? "กำลังค้นหา…" : "🎵 ค้นหาสินค้า"}
                </button>
                {products.length > 0 && (
                  <button className="btn secondary" onClick={aiCurate} disabled={aiStatus === "loading"}>
                    {aiStatus === "loading" ? "กำลังให้ AI คัดสินค้า…" : "🤖 ให้ AI เลือกให้"}
                  </button>
                )}
              </div>
              {tiktokMsg && <div className={`hint ${tiktokStatus === "err" ? "warn" : ""}`}>{tiktokMsg}</div>}
              {aiMsg && <div className={`hint ${aiStatus === "err" ? "warn" : ""}`}>{aiMsg}</div>}
            </>
          )}
        </>
      )}

      {mode === "manual" && (
        <div className="scene-card">
          <label className="field-label">แพลตฟอร์ม</label>
          <div className="flex gap-2 flex-wrap" style={{ marginBottom: 12 }}>
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="btn small secondary"
                style={
                  manualForm.platform === p.key
                    ? { borderColor: "var(--accent)", color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, var(--surface))" }
                    : undefined
                }
                onClick={() => setManualField("platform", p.key)}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          <label className="field-label">ชื่อสินค้า *</label>
          <input type="text" value={manualForm.productName} onChange={(e) => setManualField("productName", e.target.value)} placeholder="เช่น เซรั่มหน้าใส XYZ" />

          <label className="field-label">ลิงก์ affiliate *</label>
          <input type="text" value={manualForm.affiliateLink} onChange={(e) => setManualField("affiliateLink", e.target.value)} placeholder="https://..." />

          <div className="row">
            <div>
              <label className="field-label">ราคา (บาท)</label>
              <input type="number" value={manualForm.price} onChange={(e) => setManualField("price", e.target.value)} />
            </div>
            <div>
              <label className="field-label">Commission (%)</label>
              <input type="number" value={manualForm.commissionRate} onChange={(e) => setManualField("commissionRate", e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div>
              <label className="field-label">ยอดขาย (ถ้ามี)</label>
              <input type="number" value={manualForm.sales} onChange={(e) => setManualField("sales", e.target.value)} />
            </div>
            <div>
              <label className="field-label">คะแนน (ถ้ามี)</label>
              <input type="number" value={manualForm.ratingStar} onChange={(e) => setManualField("ratingStar", e.target.value)} min={0} max={5} step={0.1} />
            </div>
          </div>
          <label className="field-label">ชื่อร้าน (ถ้ามี)</label>
          <input type="text" value={manualForm.shopName} onChange={(e) => setManualField("shopName", e.target.value)} />
          <label className="field-label">รูปสินค้า — ลิงก์ URL (ถ้ามี)</label>
          <input type="text" value={manualForm.imageUrl} onChange={(e) => setManualField("imageUrl", e.target.value)} placeholder="https://..." />

          <button className="btn" style={{ marginTop: 14 }} onClick={addManualProduct}>
            ➕ เพิ่มสินค้านี้
          </button>
          {manualMsg && <div className="hint warn">{manualMsg}</div>}
        </div>
      )}

      {sortedProducts.map((p) => (
        <div className="scene-card" key={p.itemId} style={aiPicks[p.itemId] ? { borderColor: "var(--accent)" } : undefined}>
          <div className="scene-card-head">
            <span className="scene-badge">{p.platformIcon ? `${p.platformIcon} ` : ""}{p.shopName}</span>
            {aiPicks[p.itemId] && <span className="status-pill ok">🤖 AI แนะนำ</span>}
          </div>
          <div style={{ fontWeight: 600 }}>{p.productName}</div>
          <div className="hint">
            ราคา {p.price} · commission {p.commissionRate ? `${(Number(p.commissionRate) * 100).toFixed(1)}%` : "-"} · ขายแล้ว {p.sales ?? "-"}
            {p.ratingStar ? ` · ⭐ ${Number(p.ratingStar).toFixed(1)}` : ""}
          </div>
          {aiPicks[p.itemId] && <div className="hint" style={{ color: "var(--accent)" }}>{aiPicks[p.itemId]}</div>}
          <button
            className={`btn secondary`}
            style={{ marginTop: 10 }}
            onClick={() => choose(p)}
            disabled={choosingId === p.itemId}
          >
            {choosingId === p.itemId
              ? "กำลังสร้างลิงก์…"
              : selected?.itemId === p.itemId
                ? "✓ เลือกแล้ว"
                : "เลือกสินค้านี้"}
          </button>
        </div>
      ))}

      {done && (
        <div className="status-pill ok" style={{ marginTop: 14 }}>
          ✓ เลือกสินค้าแล้ว: {selected?.productName}
        </div>
      )}
    </Stage>
  );
}
