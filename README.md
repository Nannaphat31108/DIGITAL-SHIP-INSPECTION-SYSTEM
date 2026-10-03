# Digital Ship Inspection & Engineering Analysis System (DSIS)

เว็บแอปพลิเคชันหน้าเดียวสำหรับ **บันทึกผลการตรวจสอบเรือ ประเมินความเสียหายของโครงสร้าง และจำลองการทรงตัวของเรือเบื้องต้น**
พัฒนาเป็นโครงงาน / Portfolio ด้านวิศวกรรม ระดับ ม.6

> ⚠️ **เพื่อการศึกษาเท่านั้น** — ผลการคำนวณใช้สูตรอย่างง่ายและเกณฑ์ที่กำหนดขึ้นเพื่อการเรียนรู้
> ไม่ใช่การรับรองความปลอดภัยของเรือ และไม่ใช้แทน Surveyor / วิศวกรเรือ หรือซอฟต์แวร์ Naval Architecture จริง

---

## วิธีเปิดใช้งาน

1. ดาวน์โหลด / clone โฟลเดอร์นี้ทั้งหมด
2. ดับเบิลคลิก `index.html` เพื่อเปิดด้วย Chrome / Edge / Firefox ได้ทันที
3. (แนะนำสำหรับการนำเสนอ) ไปที่เมนู **Methodology & Data → Load Demo Data** เพื่อโหลดข้อมูลตัวอย่าง

- ไม่ต้องติดตั้งโปรแกรม ไม่ต้องมี Server / Database / Internet
- ข้อมูลบันทึกไว้ใน **LocalStorage** ของเบราว์เซอร์ (ปิดแล้วเปิดใหม่ข้อมูลยังอยู่ ถ้าใช้เบราว์เซอร์และเครื่องเดิม)
- ถ้าอยากเผยแพร่ออนไลน์ฟรี ใช้ GitHub Pages ได้ (Settings → Pages → Deploy from branch) — ไม่ต้องซื้อ Hosting

## โครงสร้างไฟล์

```
index.html               โครงหน้าเว็บทั้งหมด (Sidebar, Topbar, 7 หน้า)
css/style.css            ธีม Navy Engineering Dashboard, Responsive, รูปแบบสำหรับพิมพ์ Report
js/calc-inspection.js    Logic Module 1: ตรวจสอบ Input, IMO check digit, นับ Findings, ประเมินสถานะ
js/calc-assessment.js    Logic Module 2: สูตรความหนา, คะแนนความเสียหาย, Severity, คำแนะนำ
js/calc-stability.js     Logic Module 3: Volume, Displacement, KB, BM, GM, GZ, เกณฑ์ IMO
js/storage.js            จัดการ LocalStorage
js/utils.js              ฟังก์ชันช่วย (DOM, format, แสดง error, modal, toast)
js/charts.js             กราฟ SVG ที่เขียนเอง (Bar, Donut, Line) ไม่ใช้ Library ภายนอก
js/shipmap.js            ภาพด้านข้างเรือ (SVG) สำหรับคลิกเลือกตำแหน่งและแสดง Marker
js/inspection.js         หน้า Ship Particulars และ Findings (เพิ่ม/ค้นหา/กรอง/เรียง/ดู/ลบ)
js/report.js             สร้าง Inspection Report จากข้อมูลจริง + Print / Save PDF
js/assessment.js         หน้า Module 2
js/stability.js          หน้า Module 3 (คำนวณสด, Diagram ภาคตัดขวาง, กราฟ GZ, กราฟ KB/KM)
js/app.js                Routing, Dashboard, Demo data, Clear data
tests/run-tests.js       Unit test ของสูตรคำนวณทั้งหมด
```

ไฟล์ `calc-*.js` เป็นฟังก์ชันคำนวณล้วน ๆ (ไม่ยุ่งกับหน้าเว็บ) จึงทดสอบด้วย Node.js ได้:

```
node tests/run-tests.js      → 28 passed, 0 failed
```

---

## Module 1 — Digital Ship Inspection System

| ฟังก์ชัน | รายละเอียด |
|---|---|
| ข้อมูลเรือ | Ship ID, ชื่อ, ประเภท, ปีสร้าง, IMO, L, B, Draft, Depth, ผู้ตรวจ, วันที่, สถานที่ |
| ตรวจสอบ Input | ช่องบังคับ, ปี 1900–ปีปัจจุบัน, B < L, Draft < Depth, **IMO check digit** |
| เพิ่ม Finding | คลิกเลือกตำแหน่งบนภาพเรือ SVG → ระบบบอกโซน (Aft / Midship 0.4L / Forward) และใต้/เหนือแนวน้ำ |
| Type / Severity | Corrosion, Crack, Dent, Coating Damage, Weld Defect / Critical, High, Moderate, Low |
| ตาราง | Search, Filter (Type, Severity), Sort 6 แบบ, View (รายละเอียด + ตำแหน่งบนภาพ), Delete (มียืนยัน) |
| Dashboard | KPI ตาม Severity, Donut chart, Bar chart ตาม Type, แผนที่ Marker, Findings ล่าสุด |
| Report | ข้อมูลเรือ, สรุป, แผนผังตำแหน่ง, ตาราง Findings, (เลือกได้) ผล Module 2 และ 3 → Print / Save PDF |

**IMO check digit:** ตัวเลข 6 หลักแรกคูณด้วย 7, 6, 5, 4, 3, 2 แล้วรวมกัน หลักหน่วยของผลรวมต้องเท่ากับหลักที่ 7
ตัวอย่าง 9074729 → 9×7 + 0×6 + 7×5 + 4×4 + 7×3 + 2×2 = 139 → 9 ✔

**สถานะเบื้องต้นจาก Severity** (ใช้ระดับที่รุนแรงที่สุดที่พบ):

| เงื่อนไข | สถานะ |
|---|---|
| มี Critical อย่างน้อย 1 | Not Satisfactory — Immediate Action |
| มี High อย่างน้อย 1 | Conditional — Repair Required |
| มี Moderate อย่างน้อย 1 | Satisfactory with Observations |
| มีแค่ Low | Satisfactory |

## Module 2 — Ship Structural Damage Assessment

**ความหนา (เมื่อมีข้อมูล)**

```
Δt        = t0 − tm                           (mm)
Δt%       = (t0 − tm) / t0 × 100
t_min     = t0 × (1 − allowable% / 100)
ratio     = Δt% / allowable%   → < 0.75 ผ่าน, 0.75–1.0 Substantial corrosion, > 1.0 เกินเกณฑ์ (ควรเปลี่ยนแผ่น)
อัตรากัดกร่อน = Δt / จำนวนปี            (mm/ปี)
อายุคงเหลือ  = (tm − t_min) / อัตรากัดกร่อน  (ปี)
```

**คะแนนการวัด M (0–100)** — เกณฑ์ที่กำหนดขึ้นเพื่อการศึกษา

| ประเภท | สูตร | ข้อมูลที่ต้องมี |
|---|---|---|
| Corrosion | M = 75 × ratio | t0, tm |
| Crack | M = 40 + L/8 (+20 ถ้าทะลุความหนา) | L |
| Dent | M = 7.5 × (depth/width × 100) | depth, width |
| Coating Damage | M = 1.5 × พื้นที่เสียหาย % | % พื้นที่ |
| Weld Defect | M = 30 + L/10 (+25 ถ้าทะลุความหนา) | L |

ถ้ามีข้อมูลความหนาด้วย ระบบใช้ค่าที่มากกว่าระหว่าง M กับคะแนนความหนา

**คะแนนสุดท้าย:** `S = min(100, M × f_member × f_zone)`
- f_member: Primary 1.25 (Keel, Deck, Sheer strake, Bulkhead, Girder) · Secondary 1.00 · Tertiary 0.75
- f_zone: Midship 0.4L = 1.15 (บริเวณที่รับ Bending moment สูงสุด) · Aft/Forward = 1.00

**Severity:** S ≥ 75 Critical · ≥ 50 High · ≥ 25 Moderate · < 25 Low
ผลลัพธ์จะแสดงสถานะ, การดำเนินการ, ควรตรวจเพิ่มเติมหรือไม่ และคำแนะนำตามกฎ (เช่น NDT สำหรับ Crack, UT/RT สำหรับ Weld)

## Module 3 — Preliminary Ship Design / Stability Simulation

| ค่า | สูตร |
|---|---|
| Volume | ∇ = L·B·T·Cb |
| Displacement | Δ = ρ·∇ (ρ = 1.025 น้ำทะเล / 1.000 น้ำจืด) |
| Draft (โหมดกรอก Δ) | T = Δ / (ρ·L·B·Cb) |
| Waterplane, TPC | A_WP = Cwp·L·B, TPC = ρ·A_WP / 100 |
| KB (Morrish) | KB = T·(5/6 − Cb/(3·Cwp)) |
| BM | I_T ≈ Cwp²·L·B³/12, BM = I_T / ∇ |
| GM | KM = KB + BM, GM = KM − KG, GM_fluid = GM − FSC |
| GZ (Wall-sided) | GZ(φ) = sin φ · (GM + ½·BM·tan²φ) |
| มุมขอบดาดฟ้าจมน้ำ | φ = atan((D − T)/(B/2)) |
| คาบการโคลง | T_r = 2·C·B/√GM, C = 0.373 + 0.023·B/T − 0.043·L/100 |
| พื้นที่ใต้ GZ 0–30° | กฎสี่เหลี่ยมคางหมู ทีละ 1° (m·rad) |

**เกณฑ์อ้างอิง:** IMO IS Code 2008 — GM₀ ≥ 0.15 m, พื้นที่ใต้กราฟ GZ 0–30° ≥ 0.055 m·rad
(ตรวจพื้นที่เฉพาะกรณีที่ขอบดาดฟ้ายังไม่จมก่อน 30° เพราะสูตร wall-sided ใช้ไม่ได้หลังจากนั้น)

**การแสดงผล:** ค่าตัวเลขทั้งหมด, ภาพภาคตัดขวางกลางลำแบบปรับมุมเอียงได้ (แสดง K, B, G, M, Z และแขน GZ),
กราฟ GZ พร้อมเส้นสัมผัส GM, กราฟ KB / KM / GM เทียบ Draft และบันทึก Design Case ไว้เปรียบเทียบ

**ตรวจสอบความถูกต้อง:** สำหรับเรือรูปกล่อง (Cb = Cwp = 1) ผลจะเท่ากับสูตรเรือกล่องพอดี คือ KB = T/2 และ BM = B²/(12T) (มีใน unit test)

---

## สิ่งที่เพิ่มนอกเหนือจาก Spec (แจ้งไว้ตามข้อกำหนด)

ส่วนที่เพิ่มเล็กน้อยเพื่อให้ระบบใช้งาน/นำเสนอได้ครบ:
- ช่อง Inspector, วันที่ตรวจ, สถานที่ ในข้อมูลเรือ (ใช้ในหัว Report)
- ปุ่ม **Load Demo Data / Clear All Data** (สำหรับนำเสนอ)
- บันทึกประวัติผลการประเมิน Module 2 และ Design Case ของ Module 3 (เพื่อให้ข้อมูลเรียกกลับมาได้)
- ตัวเลือกให้ Report แนบผล Module 2 และ 3
- ค่า Free Surface Correction (ไม่บังคับ ใส่ 0 ได้)

ถ้าไม่ต้องการส่วนใด แจ้งได้เลย ตัดออกได้ง่าย

## ข้อจำกัด

- ข้อมูลอยู่ในเบราว์เซอร์เครื่องเดียว (ไม่มีระบบหลายผู้ใช้ตาม Scope) ถ้าล้าง Browser data ข้อมูลจะหาย
- สูตร Module 3 เป็นค่าประมาณจาก Form coefficient ไม่ได้ใช้รูปทรงตัวเรือจริง (Offsets / Hydrostatic tables)
- เกณฑ์คะแนน Module 2 เป็นกฎที่กำหนดขึ้นเพื่อการศึกษา ไม่ใช่เกณฑ์ของ Classification Society
