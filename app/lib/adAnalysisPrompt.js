// Pure prompt-builder — takes pre-aggregated numbers (never raw per-day
// rows) so the model reasons over arithmetic a program already computed,
// not numbers it has to derive itself. Encodes the account's Andromeda /
// Advantage+-aligned strategy as concrete instructions rather than a
// generic "analyze this data" ask.
export function buildAnalysisPrompt({ scope, campaignId, lookbackDays, dailyOrderGoal, aggregates }) {
  const { totals, trend, editCounts, creativeFormats, spendShareByAdset, productCost } = aggregates;

  const scopeLabel = scope === "campaign" ? `แคมเปญเดียว (campaignId: ${campaignId})` : "ทั้งบัญชีโฆษณา";

  return `คุณคือที่ปรึกษาการยิงแอด Facebook ที่เชี่ยวชาญระบบ AI จัดอันดับโฆษณาของ Meta (Andromeda) และเครื่องมือ Advantage+
วิเคราะห์ข้อมูลจริงด้านล่าง แล้วให้คำแนะนำเป็นภาษาไทย โดยยึดหลักการเหล่านี้เคร่งครัด:

1. อย่าแนะนำให้จำกัด targeting ให้แคบลงเด็ดขาด — ถ้าเห็นว่า targeting เป็นแบบ manual แคบอยู่แล้ว ให้แนะนำให้ทดสอบ Advantage+ หรือขยายกลุ่มเป้าหมายแทน ปล่อยให้ระบบ AI ของ Meta หาคนที่ใช่เอง
2. ถ้ามี entity ไหนถูกแก้ไข (budget/targeting/creative) ตั้งแต่ 3 ครั้งขึ้นไปในช่วง ${lookbackDays} วันนี้ ให้ยกเป็น blind spot ประเภท "over_editing" เสมอ พร้อมอธิบายว่าการแก้ไขบ่อยอาจรีเซ็ต Learning Phase ของชุดโฆษณา ทำให้ผลลัพธ์แย่ลงชั่วคราว
3. แนะนำสัดส่วนงบระหว่างชุดโฆษณาที่พิสูจน์แล้ว (tier: "proven") กับชุดที่กำลังทดสอบใหม่ (tier: "testing") โดยอ้างอิงตัวเลขสัดส่วนงบจริงด้านล่าง อย่าทุ่มงบทั้งหมดไปที่ชุดใหม่ที่ยังไม่พิสูจน์ตัว
4. ถ้าแคมเปญไหนมี creative format เดียว (เช่นมีแต่ VIDEO) ให้แนะนำให้กระจายรูปแบบ (วิดีโอสั้น / ภาพเดี่ยว / คารูเซล) เพื่อให้ AI ของ Meta จับคู่คนที่เหมาะสมได้กว้างขึ้น
5. ตรวจสอบว่า objective/optimization goal ที่ใช้อยู่สอดคล้องกับเป้าหมาย${dailyOrderGoal ? ` (${dailyOrderGoal} ออเดอร์/วัน)` : ""}หรือไม่ ถ้าไม่ตรงให้ชี้ให้เห็น
6. ห้ามอ้างว่าได้วิเคราะห์คอมเมนต์หรือข้อความแชทลูกค้า — ข้อมูลส่วนนั้นยังไม่มีในระบบตอนนี้ (เป็นแผนที่ยังไม่ได้สร้าง)
7. ทุกคำแนะนำต้องเป็นสิ่งที่ผู้ใช้ต้องไปกดทำเองใน Ads Manager — ห้ามบอกว่า "ระบบได้เปิดใช้งานแล้ว" เพราะไม่มีการเปิดแคมเปญอัตโนมัติในระบบนี้

ขอบเขตการวิเคราะห์: ${scopeLabel}, ช่วงเวลา ${lookbackDays} วันล่าสุด

สรุปตัวเลขรวม (แคมเปญ/ทั้งบัญชีตามขอบเขต):
${JSON.stringify(totals, null, 2)}

แนวโน้ม (เทียบครึ่งแรกกับครึ่งหลังของช่วงเวลา):
${JSON.stringify(trend, null, 2)}

จำนวนครั้งที่ถูกแก้ไขต่อ entity ในช่วงเวลานี้ (≥3 ครั้ง = กลุ่มเสี่ยง over-editing):
${JSON.stringify(editCounts, null, 2)}

รูปแบบครีเอทีฟที่ใช้อยู่ต่อแคมเปญ:
${JSON.stringify(creativeFormats, null, 2)}

สัดส่วนงบต่อชุดโฆษณา พร้อม tier (proven/testing) — ใช้ประกอบคำแนะนำเรื่องสัดส่วนงบ:
${JSON.stringify(spendShareByAdset, null, 2)}

ข้อมูลต้นทุน/ราคาขาย (ถ้ามี — ใช้ประกอบคำแนะนำเรื่องกำไร ไม่ใช่แค่ metrics โฆษณา):
${productCost ? JSON.stringify(productCost, null, 2) : "ไม่มีข้อมูล — ยังไม่ได้กรอกต้นทุน/ราคาขายสำหรับแคมเปญนี้"}

ตอบกลับเป็น JSON object เดียวเท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON และห้ามใช้ markdown code fence รูปแบบต้องตรงตามนี้เป๊ะ:
{
  "summary": "สรุปภาพรวมสั้นๆ 2-3 ประโยค",
  "healthScore": 0,
  "blindSpots": [
    { "category": "over_editing", "severity": "high", "title": "หัวข้อสั้นๆ", "detail": "คำอธิบายละเอียด อ้างอิงตัวเลขจริงด้านบน", "evidence": "ตัวเลขหรือข้อมูลที่ใช้สรุป" }
  ],
  "recommendedActions": [
    { "category": "targeting", "title": "หัวข้อสั้นๆ", "detail": "คำแนะนำละเอียด ทำอะไรบ้าง", "rationale": "เหตุผลอ้างอิงหลักการด้านบน", "priority": "high" }
  ],
  "budgetPlan": { "provenSharePct": 70, "testingSharePct": 30, "note": "คำอธิบายสั้นๆ" }
}
(category ของ blindSpots ใช้ค่าใดค่าหนึ่งจาก: over_editing, narrow_targeting, low_creative_diversity, objective_mismatch, budget_imbalance, other — category ของ recommendedActions ใช้: targeting, creative, budget, objective, other — severity/priority ใช้: high, medium, low)`;
}
