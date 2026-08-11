import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Plus, RefreshCw, ShieldAlert, Trash2, Wrench } from "lucide-react";
import { api, useRemote } from "./api";
import { Card, Empty, Field, RED } from "./ui";

const fmt = (v) => v ? new Date(v).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const day = (v) => v ? String(v).slice(0, 10) : "";
const STATUS = { open: "Mở", processing: "Đang xử lý", resolved: "Đã khắc phục", closed: "Đã đóng", new: "Mới", assigned: "Đã giao", done: "Hoàn thành", overdue: "Quá hạn" };
const DUTY = { technical: "Trực kỹ thuật", vehicle: "Trực xe", command: "Trực chỉ huy", office: "Trực ban Phòng VHKT" };

function Tag({ children, danger }) { return <span className={`tag ${danger ? "tag-red" : "tag-grey"}`}>{children}</span>; }

export function OperationsView() {
  const [summary] = useRemote("/api/operations/summary", {});
  const [incidents] = useRemote("/api/incidents", []);
  const [orders] = useRemote("/api/work-orders", []);
  const [handovers] = useRemote("/api/handovers", []);
  const [duties] = useRemote("/api/duty-schedules", []);
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[["Sự cố đang mở", summary?.incidents_open || 0, "#C8102E"], ["Sự cố nghiêm trọng", summary?.incidents_critical || 0, "#B45309"], ["WO chưa xong", summary?.wo_open || 0, "#0F6CBD"], ["WO quá hạn", summary?.wo_overdue || 0, "#B91C1C"]].map(([l, v, c]) => <Card key={l}><p className="muted" style={{ fontSize: 12 }}>{l}</p><p style={{ fontSize: 28, fontWeight: 800, color: c, marginTop: 5 }}>{v}</p></Card>)}
    </div>
    <Card title="Sự cố kỹ thuật đang theo dõi" icon={ShieldAlert} pad={false}>
      <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>Mã</th><th>Sự cố / vị trí</th><th>Mức độ</th><th>Phụ trách</th><th>Hạn xử lý</th><th>Trạng thái</th></tr></thead><tbody>
        {incidents.slice(0, 12).map((x) => <tr key={x.id}><td className="mono">{x.code}</td><td><b>{x.title}</b><br /><span className="muted">{x.site}</span></td><td><Tag danger={["critical", "high"].includes(x.severity)}>{x.severity}</Tag></td><td>{x.assignee || "—"}</td><td>{fmt(x.due_at)}</td><td><Tag danger={x.status === "overdue"}>{STATUS[x.status] || x.status}</Tag></td></tr>)}
      </tbody></table>{!incidents.length && <Empty title="Chưa có sự cố kỹ thuật." />}</div>
    </Card>
    <Card title="WO cần theo dõi" icon={ClipboardList} pad={false}>
      <div style={{ overflowX: "auto" }}><table className="tbl"><thead><tr><th>Mã WO</th><th>Nội dung</th><th>Địa điểm</th><th>Người xử lý</th><th>Hạn</th><th>Trạng thái</th></tr></thead><tbody>{orders.slice(0, 12).map((x) => <tr key={x.id}><td className="mono">{x.code}</td><td><b>{x.title}</b><br /><span className="muted">{x.category}</span></td><td>{x.location}</td><td>{x.assignee || "—"}</td><td>{fmt(x.due_at)}</td><td><Tag danger={x.status === "overdue"}>{STATUS[x.status] || x.status}</Tag></td></tr>)}</tbody></table>{!orders.length && <Empty title="Chưa có WO chi tiết." />}</div>
    </Card>
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Bàn giao ca gần nhất" icon={Wrench}>{handovers.slice(0, 4).map((x) => <div key={x.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}><b>{day(x.shift_date)} · {x.shift_name}</b><p style={{ fontSize: 13, marginTop: 4 }}>{x.summary}</p><p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{x.outgoing} → {x.incoming || "chưa nhận"} {x.confirmed ? "· Đã xác nhận" : "· Chờ xác nhận"}</p></div>)}{!handovers.length && <Empty title="Chưa có nhật ký bàn giao ca." />}</Card>
      <Card title="Lịch trực Phòng Vận hành khai thác" icon={CalendarClock}>{duties.slice(0, 12).map((x) => <div key={x.id} className="flex justify-between gap-2" style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: 13 }}><span><b>{day(x.duty_date)}</b> · {DUTY[x.duty_type] || x.duty_type}<br /><span className="muted">{x.person_name}{x.phone ? ` · ${x.phone}` : ""}</span></span><Tag>{x.shift_name}</Tag></div>)}{!duties.length && <Empty title="Chưa có lịch trực." />}</Card>
    </div>
  </div>;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function AdminList({ title, icon: Icon, endpoint, type }) {
  const [rows, setRows] = useState([]); const [form, setForm] = useState(null); const [err, setErr] = useState("");
  const [search, setSearch] = useState(""); const [fMonth, setFMonth] = useState(""); const [fYear, setFYear] = useState("");
  const load = () => api.get(endpoint).then((x) => setRows(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [endpoint]);
  const save = async () => { try { if (form.id) await api.put(`${endpoint}/${form.id}`, form); else await api.post(endpoint, form); setForm(null); load(); } catch (e) { setErr(e.message); } };
  const del = async (x) => { if (!window.confirm(`Xóa “${x.code || x.person_name || "bản ghi"}”?`)) return; try { await api.del(`${endpoint}/${x.id}`); load(); } catch (e) { setErr(e.message); } };
  const blank = type === "incident" ? { title: "", site: "", severity: "medium", status: "open", assignee: "", description: "", due_at: "" } : type === "wo" ? { title: "", category: "Vận hành", location: "", priority: "normal", status: "new", assignee: "", description: "", due_at: "" } : type === "handover" ? { shift_date: new Date().toISOString().slice(0,10), shift_name: "Ca ngày", outgoing: "", incoming: "", summary: "", open_items: "", risks: "", confirmed: false } : { duty_date: new Date().toISOString().slice(0,10), duty_type: "technical", shift_name: "Cả ngày", person_name: "", phone: "", backup_name: "", note: "" };
  const field = (label, key, kind = "text") => <Field label={label}><input className="inp" type={kind} value={form?.[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Field>;

  const dutyYears = useMemo(() => {
    const ys = new Set(rows.map((x) => x.duty_date && String(x.duty_date).slice(0, 4)).filter(Boolean));
    ys.add(String(new Date().getFullYear()));
    return [...ys].sort().reverse();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((x) => {
      if (type === "duty" && (fMonth || fYear)) {
        const d = String(x.duty_date || "");
        if (fYear && d.slice(0, 4) !== fYear) return false;
        if (fMonth && d.slice(5, 7) !== fMonth) return false;
      }
      if (!term) return true;
      const hay = [x.code, x.title, x.site, x.location, x.assignee, x.person_name, x.phone,
        x.backup_name, x.outgoing, x.incoming, x.summary].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search, fMonth, fYear, type]);

  return <div className="flex flex-col gap-4"><div className="card flex justify-between items-center" style={{ flexWrap: "wrap", gap: 10 }}><div><b>{title}</b><p className="muted" style={{fontSize:12,marginTop:3}}>Theo dõi và cập nhật dữ liệu vận hành.</p></div><div className="flex gap-2"><button className="btn btn-sm" onClick={load}><RefreshCw size={14}/>Tải lại</button><button className="btn btn-red btn-sm" onClick={() => setForm(blank)}><Plus size={14}/>Thêm</button></div></div>
    <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
      <input className="inp" style={{ maxWidth: 280 }} placeholder="🔎 Tìm kiếm…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {type === "duty" && <>
        <select className="inp" style={{ maxWidth: 140 }} value={fMonth} onChange={(e) => setFMonth(e.target.value)}>
          <option value="">Mọi tháng</option>
          {MONTHS.map((m) => <option key={m} value={String(m).padStart(2, "0")}>Tháng {m}</option>)}
        </select>
        <select className="inp" style={{ maxWidth: 120 }} value={fYear} onChange={(e) => setFYear(e.target.value)}>
          <option value="">Mọi năm</option>
          {dutyYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </>}
    </div>
    {err && <p style={{color:RED}}>{err}</p>}
    {form && <Card title={form.id ? "Cập nhật" : "Tạo mới"}><div className="grid md:grid-cols-2 gap-3">{type === "incident" && <>{field("Tiêu đề", "title")}{field("Vị trí / trạm", "site")}<Field label="Mức độ"><select className="inp" value={form.severity || "medium"} onChange={e=>setForm({...form,severity:e.target.value})}><option value="critical">Nghiêm trọng</option><option value="high">Cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option></select></Field>{field("Người xử lý", "assignee")}{field("Hạn xử lý", "due_at", "datetime-local")}</>}{type === "wo" && <>{field("Nội dung WO", "title")}{field("Địa điểm", "location")}{field("Nhóm công việc", "category")}{field("Người xử lý", "assignee")}{field("Hạn xử lý", "due_at", "datetime-local")}</>}{type === "handover" && <>{field("Ngày trực", "shift_date", "date")}{field("Ca", "shift_name")}{field("Bàn giao", "outgoing")}{field("Tiếp nhận", "incoming")}</>}{type === "duty" && <>{field("Ngày trực", "duty_date", "date")}<Field label="Loại trực"><select className="inp" value={form.duty_type} onChange={e=>setForm({...form,duty_type:e.target.value})}>{Object.entries(DUTY).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>{field("Ca trực", "shift_name")}{field("Người trực", "person_name")}{field("Điện thoại", "phone")}{field("Dự phòng", "backup_name")}</>}</div><Field label={type === "handover" ? "Nội dung bàn giao" : type === "duty" ? "Ghi chú" : "Mô tả"}><textarea className="inp" rows="3" value={form.summary ?? form.note ?? form.description ?? ""} onChange={e=>setForm({...form,[type === "handover" ? "summary" : type === "duty" ? "note" : "description"]:e.target.value})}/></Field><div className="flex gap-2"><button className="btn" onClick={()=>setForm(null)}>Hủy</button><button className="btn btn-red" onClick={save}>Lưu</button></div></Card>}
    <Card pad={false}><div style={{overflowX:"auto"}}><table className="tbl"><thead><tr><th>Mã / ngày</th><th>Nội dung</th><th>Phụ trách</th><th>Trạng thái</th><th></th></tr></thead><tbody>{filteredRows.map(x=><tr key={x.id}><td className="mono">{x.code || day(x.shift_date || x.duty_date)}</td><td><b>{x.title || x.summary || DUTY[x.duty_type]}</b><br/><span className="muted">{x.site || x.location || x.person_name}</span></td><td>{x.assignee || x.outgoing || x.person_name}</td><td>{STATUS[x.status] || x.shift_name}</td><td><button className="btn btn-sm" onClick={()=>setForm({...x, due_at:x.due_at ? String(x.due_at).slice(0,16):""})}>Sửa</button> <button className="btn btn-sm" onClick={()=>del(x)}><Trash2 size={13}/></button></td></tr>)}</tbody></table>{!filteredRows.length&&<Empty title="Chưa có dữ liệu." hint={rows.length ? "Không có dòng nào khớp bộ lọc." : undefined}/>}</div></Card></div>;
}

export const AdminOperations = () => <AdminList title="Sự cố kỹ thuật" icon={ShieldAlert} endpoint="/api/admin/incidents" type="incident" />;
export const AdminWorkOrders = () => <AdminList title="WO chi tiết" icon={ClipboardList} endpoint="/api/admin/work-orders" type="wo" />;
export const AdminHandovers = () => <AdminList title="Nhật ký bàn giao ca" icon={Wrench} endpoint="/api/admin/handovers" type="handover" />;
export const AdminDutyRoster = () => <AdminList title="Lịch trực vận hành" icon={CalendarClock} endpoint="/api/admin/duty-schedules" type="duty" />;
