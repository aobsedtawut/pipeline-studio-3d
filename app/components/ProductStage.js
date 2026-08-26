"use client";

import { useState } from "react";
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

  function choose(p) {
    setSelected(p);
    setMeta({
      ...meta,
      productName: p.productName,
      chosenProduct: p,
      affiliateLink: p.offerLink || p.productLink || "",
    });
    onDone();
  }

  return (
    <Stage
      num={1}
      character="product"
      accent="--accent"
      title="เลือกสินค้า (Product)"
      sub="ค้นหาสินค้า Shopee affiliate ตามคำค้น แล้วเลือกอันที่ commission สูงสุด (หรือ sales/price) เพื่อใช้ทำสคริปต์ต่อ — ขั้นตอนนี้ข้ามได้ถ้าอยากพิมพ์ชื่อสินค้าเองในขั้นตอนถัดไป"
      unlocked={unlocked}
    >
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

      {sortedProducts.map((p) => (
        <div className="scene-card" key={p.itemId} style={aiPicks[p.itemId] ? { borderColor: "var(--accent)" } : undefined}>
          <div className="scene-card-head">
            <span className="scene-badge">{p.shopName}</span>
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
          >
            {selected?.itemId === p.itemId ? "✓ เลือกแล้ว" : "เลือกสินค้านี้"}
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
