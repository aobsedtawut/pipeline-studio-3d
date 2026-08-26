"use client";

import { useState } from "react";
import Stage from "./Stage";

export default function ProductStage({ unlocked, meta, setMeta, done, onDone }) {
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState("commission");
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState(null); // null | "loading" | "ok" | "err"
  const [msg, setMsg] = useState("");
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(meta.chosenProduct || null);

  async function search() {
    if (!keyword.trim()) return;
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, sortBy, limit: Number(limit) }),
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
      title="เลือกสินค้า (Product)"
      sub="ค้นหาสินค้า Shopee affiliate ตามคำค้น แล้วเลือกอันที่ commission สูงสุด (หรือ sales/price) เพื่อใช้ทำสคริปต์ต่อ — ขั้นตอนนี้ข้ามได้ถ้าอยากพิมพ์ชื่อสินค้าเองในขั้นตอนถัดไป"
      unlocked={unlocked}
    >
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
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="commission">Commission สูงสุด</option>
            <option value="sales">ยอดขายสูงสุด</option>
            <option value="price">ราคาสูงสุด</option>
          </select>
        </div>
        <div>
          <label className="field-label">จำนวนผลลัพธ์</label>
          <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} min={1} max={50} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn" onClick={search} disabled={status === "loading"}>
          {status === "loading" ? "กำลังค้นหา…" : "🔍 ค้นหาสินค้า"}
        </button>
      </div>
      {msg && <div className={`hint ${status === "err" ? "warn" : ""}`}>{msg}</div>}

      {products.map((p) => (
        <div className="scene-card" key={p.itemId}>
          <div className="scene-card-head">
            <span className="scene-badge">{p.shopName}</span>
          </div>
          <div style={{ fontWeight: 600 }}>{p.productName}</div>
          <div className="hint">
            ราคา {p.price} · commission {p.commissionRate ? `${(Number(p.commissionRate) * 100).toFixed(1)}%` : "-"} · ขายแล้ว {p.sales ?? "-"}
          </div>
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
