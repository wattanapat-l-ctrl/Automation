# รายงานการใช้ AI ในการพัฒนา (AI Usage Report)

โปรเจกต์ **Alarm & Maintenance Management System** สำหรับวิชา Programming in Automation Systems

AI (Claude / Codex / Copilot) ถูกใช้เป็นเครื่องมือช่วยพัฒนาในทุกขั้นตอน ตามหลักเกณฑ์ที่กำหนดไว้ในใบงาน และผลลัพธ์ทั้งหมดถูกตรวจสอบ/ทดสอบจริงก่อนส่งมอบ รายละเอียดการใช้งานแยกตามขอบเขตที่ใบงานอนุญาต:

## 1. การวิเคราะห์ความต้องการ (Requirements Analysis)
- อ่านใบงาน PDF (`Automation_AI_Assignment_CleanFont.pdf`) และแยก ข้อกำหนดฟังก์ชัน, เกณฑ์การให้คะแนน (Rubric) และ Deliverable ทั้งหมวด 3.x และ 5.x เป็น Checklist
- แปลงความต้องการเป็นสถานะจอ (Pages), ตารางข้อมูล, การไหลข้อมูลผู้ใช้ (Admin / Technician / Viewer)

## 2. การออกแบบฐานข้อมูล (Database Design)
- ออกแบบ 5 ตาราง: `profiles`, `machines`, `alarms`, `maintenance_records`, `audit_logs` พร้อม FK, CHECK constraint, และข้อมูลเริ่มต้น (Seed)
- เขียน Row Level Security (RLS) policies แยกตามบทบาทผู้ใช้
- เขียน Trigger: สร้าง profile อัตโนมัติเมื่อสมัครสมาชิก, บังคับการเปลี่ยนสถานะ Alarm ที่ถูกต้อง, และบันทึก Audit Log ทุกการ INSERT/UPDATE/DELETE
- ไฟล์ `supabase/live_setup.sql` ใช้ครั้งเดียวครอบคลุมทุกอย่าง (Idempotent)

## 3. การเขียนโค้ด (Code)
- Frontend: Next.js 16 (App Router, React 19, TypeScript), Tailwind CSS
- Auth & Roles: Supabase Auth, หน้า `/login`, `/signup`, middleware กันหน้าอนุญาต
- ฟีเจอร์ทั้งหมด: CRUD Machine / Alarm / Maintenance, ค้นหา, กรอง, ตรวจสอบข้อมูล (Validation), Dashboard พร้อมกราฟ (Recharts)
- โบนัส: Simulation Lab (จำลองเหตุการณ์เครื่องจักรแบบเรียลไทม์), Audit Log, CSV Export, Dark Mode, บทบาท Viewer, ประวัติเครื่องจักร

## 4. UI / UX
- ออกแบบ UI ด้วย Tailwind ตามแนว Material modern, รองรับมือถือ (Responsive)
- โหมดสว่าง/มืด (Dark Mode)
- ตัวอย่างหน้าจออยู่ในโฟลเดอร์ [`screenshots/`](./screenshots) (จับจากเว็บจริงที่ deploy แล้ว)

## 5. การแก้ปัญหาการพัฒนา (Debugging)
- แก้ปัญหาการ build บนเครื่องที่ไม่รองรับ UNC path
- ตรวจสอบข้อจำกัดของ Supabase (email rate limit → ตั้งค่า Confirm email off)
- ตรวจพบ service role key ไม่ถูกต้อง และใช้ authenticated REST แทน
- แก้ SQL (คำสงวน `desc`, ค่าข้อมูลเริ่มต้น) จนผ่านทุกครั้ง

## 6. CI/CD, การทดสอบ
- เขียน GitHub Actions workflow (`install` + `lint` + `build`) รันทุกครั้งที่ Push/PR — ผล ล่าสุดผ่าน (green)
- ทดสอบ E2E ด้วยเบราว์เซอร์จริง (Edge) กับเว็บที่ deploy ไปแล้ว: เข้าสู่ระบบ → ทุกหน้า → แก้ไขสถานะ Alarm → ตรวจ Audit Log — ไม่พบข้อผิดพลาด
- ตรวจสอบ rubric ย้อนกลับ 100% ตามใบงานก่อนส่งมอบ

## สรุป
AI ถูกใช้เป็นเครื่องมือช่วยออกแบบ/เขียนโค้ด/แก้ไขปัญหา ในขณะที่การตรวจสอบตามเกณฑ์ (Rubric), การเลือกสถาปัตยกรรม, การทดสอบบนระบบจริง และการตั้งค่า deployment เป็นการตัดสินใจ/ตรวจสอบโดยนักศึกษา

---
**GitHub:** https://github.com/wattanapat-l-ctrl/Automation
**Vercel:** https://automation-pi-one.vercel.app
**Screenshots:** [`screenshots/`](./screenshots)