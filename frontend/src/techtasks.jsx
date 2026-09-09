import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { api } from "./api";
import { AdminImport } from "./bulkimport";
import { Card, Empty, Field, RED } from "./ui";

// Đúng 10 đầu việc mảng kỹ thuật — trùng CATEGORIES ở backend/app/techtasks.py.
export const CATEGORIES = [
  { id: "tuyen_dung", label: "1. Tuyển dụng" },
  { id: "kiem_soat_wo", label: "2. Kiểm soát WO" },
  { id: "ke_hoach_5g", label: "3. Kế hoạch 5G" },
  { id: "giam_phat_sla", label: "4. Giảm phạt SLA" },
  { id: "di_doi_ngam_hoa", label: "5. Di dời – ngầm hóa" },
  { id: "cung_co", label: "6. Củng cố" },
  { id: "ban_hang", label: "7. Bán hàng" },
  { id: "cldv_co_dinh", label: "8. Cải thiện CLDV cố định" },
  { id: "ql_tai_san", label: "9. QL Tài sản" },
  { id: "xang_dau", label: "10. Xăng dầu" },
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

const CATEGORY_HINTS = {
  tuyen_dung: "Giao nhiệm vụ tuyển dụng bổ sung nhân sự cho tổ trưởng, mục tiêu Tổng số line/Số "
    + "nhân sự < 1350. NS mới giao Tổ trưởng có trách nhiệm kèm cặp, hướng dẫn làm cùng (FT dây "
    + "máy); Đội trưởng kèm FT nhà trạm.",
  kiem_soat_wo: "Sử dụng tool kiểm soát: manage-wo.pages.dev — kiểm soát từng nhóm WO theo từng FT.",
  ke_hoach_5g: "Sửa sợi, tích hợp SRT5G, lắp tủ nguồn, Minishelter, tích hợp phát sóng trạm 5G.",
  giam_phat_sla: "Tiếp xúc KH rời mạng, thu hồi thiết bị, ưu tiên xử lý các WO quá hạn có nguy cơ phạt SLA.",
  di_doi_ngam_hoa: "Báo cáo lại đề xuất di dời Trạm/Cáp, phối hợp chính quyền bó cáp cần triển khai trong tháng.",
  cung_co: "Bó cáp, thay tủ ong/tủ bay, sơn lại tủ, củng cố trạm đạt chuẩn.",
  ban_hang: "Thống nhất kế hoạch bán hàng trong tháng: Năng lượng, Xây dựng, FTTH, 8 dự án Chung "
    + "cư được giao quản lý toàn diện.",
  cldv_co_dinh: "Cài Tammi, Port kém, Home-wifi kém, Swap ONT 2BT, sự cố lặp, đề xuất kéo tủ, "
    + "củng cố TB nhà trọ.",
  ql_tai_san: "Tổ chức kiểm kê kết hợp WO MR, xử lý chênh lệch tài sản, trạm hủy/di dời.",
  xang_dau: "Kiểm soát đề xuất - phê duyệt xăng dầu qua app cBusiness360, tổ chức đổ dầu dự phòng "
    + "UCTT đủ định mức cho các trạm cố định.",
};

const STATUS_LABELS = { todo: "Chưa bắt đầu", doing: "Đang thực hiện", done: "Hoàn thành", overdue: "Quá hạn" };
const STATUS_TAG = { todo: "tag-grey", doing: "tag-amber", done: "tag-green", overdue: "tag-red" };

const day = (v) => (v ? String(v).slice(0, 10) : "");
const isOverdue = (task) => task.status !== "done" && task.due_at && task.due_at < new Date().toISOString().slice(0, 10);
const effectiveStatus = (task) => (isOverdue(task) ? "overdue" : task.status);
const fmtDay = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");
const pct = (rate) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);

function StatusTag({ task }) {
  const s = effectiveStatus(task);
  return <span className={`tag ${STATUS_TAG[s] || "tag-grey"}`}>{STATUS_LABELS[s] || s}</span>;
}

const blankTask = () => ({
  category: CATEGORIES[0].id, title: "", description: "", assignee: "", target: "",
  due_at: "", status: "todo", link_url: "", note: "",
});

export function AdminTechTasks() {
  const [tab, setTab] = useState("list");
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex gap-2" style={{ padding: 8 }}>
        <button className={`btn btn-sm ${tab === "list" ? "btn-red" : ""}`} onClick={() => setTab("list")}>Danh sách công việc</button>
        <button className={`btn btn-sm ${tab === "progress" ? "btn-red" : ""}`} onClick={() => setTab("progress")}>Tiến độ</button>
      </div>
      {tab === "list" ? <TaskListTab /> : <ProgressTab />}
    </div>
  );
}

function TaskListTab() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = () => {
    const params = new URLSearchParams();
    if (fCategory) params.set("category", fCategory);
    if (fStatus) params.set("status", fStatus);
    const qs = params.toString();
    api.get(`/api/admin/tech-tasks${qs ? `?${qs}` : ""}`)
      .then((x) => setRows(Array.isArray(x) ? x : []))
      .catch((e) => setErr(e.message));
  };
  const loadSummary = () => api.get("/api/admin/tech-tasks/summary").then((x) => setSummary(Array.isArray(x) ? x : [])).catch(() => {});

  useEffect(() => { load(); }, [fCategory, fStatus]);
  useEffect(() => { loadSummary(); }, [rows.length]);

  const save = async () => {
    try {
      if (!form.category) throw new Error("Chưa chọn đầu việc.");
      if (!form.title.trim()) throw new Error("Chưa nhập nội dung công việc.");
      const payload = { ...form, due_at: form.due_at || null };
      if (form.id) await api.put(`/api/admin/tech-tasks/${form.id}`, payload);
      else await api.post("/api/admin/tech-tasks", payload);
      setForm(null); setErr(""); load(); loadSummary();
    } catch (e) { setErr(e.message); }
  };

  const del = async (x) => {
    if (!window.confirm(`Xóa công việc “${x.title}”?`)) return;
    try { await api.del(`/api/admin/tech-tasks/${x.id}`); load(); loadSummary(); } catch (e) { setErr(e.message); }
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob("/api/admin/tech-tasks/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "cong-viec-ky-thuat.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((x) => [x.title, x.assignee, x.target, x.description, x.note]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [rows, search]);

  const field = (label, key, kind = "text") => (
    <Field label={label}>
      <input className="inp" type={kind} value={form?.[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex justify-between items-center" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <b>Công việc mảng kỹ thuật</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>Giao và theo dõi tiến độ 10 đầu việc lớn.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => { load(); loadSummary(); }}><RefreshCw size={14} />Tải lại</button>
          <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>
          <button className="btn btn-red btn-sm" onClick={() => setForm(blankTask())}><Plus size={14} />Giao việc mới</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((c) => {
          const s = summary.find((x) => x.category === c.id) || { total: 0, overdue: 0 };
          const on = fCategory === c.id;
          return (
            <button key={c.id} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 12, border: on ? `1.5px solid ${RED}` : undefined }}
              onClick={() => setFCategory(on ? "" : c.id)}>
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.3, minHeight: 30 }}>{c.label}</p>
              <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: RED }}>{s.total}</span>
                {!!s.overdue && <span className="tag tag-red">{s.overdue} quá hạn</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <input className="inp" style={{ maxWidth: 280 }} placeholder="🔎 Tìm theo nội dung / phụ trách…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="inp" style={{ maxWidth: 240 }} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
          <option value="">Mọi đầu việc</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="inp" style={{ maxWidth: 180 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {err && <p style={{ color: RED }}>{err}</p>}

      {form && (
        <Card title={form.id ? "Cập nhật công việc" : "Giao việc mới"}>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Đầu việc">
              <select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Trạng thái">
              <select className="inp" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS_LABELS).filter(([k]) => k !== "overdue").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          {CATEGORY_HINTS[form.category] && (
            <p className="muted" style={{ fontSize: 12, marginTop: 6, background: "#FAF9F9", padding: "8px 10px", borderRadius: 8 }}>
              Gợi ý phạm vi: {CATEGORY_HINTS[form.category]}
            </p>
          )}
          <div style={{ marginTop: 12 }}>{field("Nội dung công việc", "title")}</div>
          <Field label="Mô tả chi tiết"><textarea className="inp" rows="2" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Người/tổ phụ trách", "assignee")}
            {field("Mục tiêu / chỉ tiêu", "target")}
            {field("Hạn xử lý", "due_at", "date")}
            {field("Link công cụ liên quan (nếu có)", "link_url")}
          </div>
          <Field label="Ghi chú tiến độ"><textarea className="inp" rows="3" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => setForm(null)}>Hủy</button>
            <button className="btn btn-red" onClick={save}>Lưu</button>
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Đầu việc</th><th>Nội dung</th><th>Phụ trách</th><th>Mục tiêu</th><th>Hạn xử lý</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {filteredRows.map((x) => (
                <tr key={x.id}>
                  <td className="muted" style={{ fontSize: 12.5 }}>{CATEGORY_LABELS[x.category] || x.category}</td>
                  <td>
                    <b>{x.title}</b>
                    {x.link_url && <a href={x.link_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}><ExternalLink size={12} /></a>}
                    {x.note && <><br /><span className="muted">{x.note}</span></>}
                  </td>
                  <td>{x.assignee || "—"}</td>
                  <td>{x.target || "—"}</td>
                  <td>{fmtDay(x.due_at)}</td>
                  <td><StatusTag task={x} /></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setForm({ ...x, due_at: day(x.due_at) })}>Sửa</button>{" "}
                    <button className="btn btn-sm" onClick={() => del(x)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && <Empty title="Chưa có công việc." hint={rows.length ? "Không có dòng nào khớp bộ lọc." : "Bấm “Giao việc mới” để bắt đầu."} />}
        </div>
      </Card>
    </div>
  );
}

/* ============================== TAB TIẾN ĐỘ HẠNG MỤC (Kế hoạch/Thực hiện) ============================== */

const blankCenterRow = (sel, period) => ({
  category: sel.category, item: sel.item, period, center: "", plan_qty: "", done_qty: "", note: "",
});
const blankFtRow = (sel, period, center) => ({
  category: sel.category, item: sel.item, period, center, ft_name: "", plan_qty: "", done_qty: "", note: "",
});

function ProgressTab() {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [periods, setPeriods] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [summary, setSummary] = useState([]);
  const [err, setErr] = useState("");
  const [showImport, setShowImport] = useState(false);

  const [selected, setSelected] = useState(null);   // {category, category_label, item, item_label}
  const [centers, setCenters] = useState([]);
  const [centerForm, setCenterForm] = useState(null);

  const [selectedCenter, setSelectedCenter] = useState(null);
  const [ftRows, setFtRows] = useState([]);
  const [ftForm, setFtForm] = useState(null);

  useEffect(() => {
    api.get("/api/admin/progress/periods").then((x) => {
      const list = Array.isArray(x) ? x : [];
      setPeriods(list);
      if (list.length) setPeriod(list[0]);
    }).catch(() => {});
    api.get("/api/admin/progress/items").then((x) => setItemGroups(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  }, []);

  const loadSummary = () => {
    if (!period) return;
    api.get(`/api/admin/progress/summary?period=${encodeURIComponent(period)}`)
      .then((x) => setSummary(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };
  useEffect(() => { loadSummary(); }, [period]);

  const loadCenters = (sel = selected, per = period) => {
    if (!sel) return;
    const p = new URLSearchParams({ category: sel.category, item: sel.item, period: per });
    api.get(`/api/admin/progress/centers?${p}`).then((x) => setCenters(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };

  const loadFt = (center = selectedCenter, sel = selected, per = period) => {
    if (!sel || !center) return;
    const p = new URLSearchParams({ category: sel.category, item: sel.item, period: per, center });
    api.get(`/api/admin/progress/ft?${p}`).then((x) => setFtRows(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };

  const openItem = (category, category_label, item, item_label) => {
    const sel = { category, category_label, item, item_label };
    setSelected(sel); setSelectedCenter(null); setFtRows([]); setCenterForm(null);
    loadCenters(sel, period);
  };
  const backToOverview = () => { setSelected(null); setCenters([]); loadSummary(); };
  const openCenter = (center) => { setSelectedCenter(center); setFtForm(null); loadFt(center); };
  const backToCenters = () => { setSelectedCenter(null); setFtRows([]); loadCenters(); };

  const saveCenter = async () => {
    try {
      if (!centerForm.center.trim()) throw new Error("Chưa nhập trung tâm.");
      const payload = { ...centerForm, plan_qty: Number(centerForm.plan_qty) || 0, done_qty: Number(centerForm.done_qty) || 0 };
      if (centerForm.id) await api.put(`/api/admin/progress/centers/${centerForm.id}`, payload);
      else await api.post("/api/admin/progress/centers", payload);
      setCenterForm(null); setErr(""); loadCenters(); loadSummary();
    } catch (e) { setErr(e.message); }
  };
  const delCenter = async (row) => {
    if (!window.confirm(`Xóa dòng trung tâm “${row.center}”?`)) return;
    try { await api.del(`/api/admin/progress/centers/${row.id}`); loadCenters(); loadSummary(); } catch (e) { setErr(e.message); }
  };

  const saveFt = async () => {
    try {
      if (!ftForm.ft_name.trim()) throw new Error("Chưa nhập tên FT.");
      const payload = { ...ftForm, plan_qty: Number(ftForm.plan_qty) || 0, done_qty: Number(ftForm.done_qty) || 0 };
      if (ftForm.id) await api.put(`/api/admin/progress/ft/${ftForm.id}`, payload);
      else await api.post("/api/admin/progress/ft", payload);
      setFtForm(null); setErr(""); loadFt();
    } catch (e) { setErr(e.message); }
  };
  const delFt = async (row) => {
    if (!window.confirm(`Xóa dòng FT “${row.ft_name}”?`)) return;
    try { await api.del(`/api/admin/progress/ft/${row.id}`); loadFt(); } catch (e) { setErr(e.message); }
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob(`/api/admin/progress/export?period=${encodeURIComponent(period)}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "tien-do-ky-thuat.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  const centerTotals = useMemo(() => centers.reduce((acc, c) => ({
    plan: acc.plan + (c.plan_qty || 0), done: acc.done + (c.done_qty || 0),
  }), { plan: 0, done: 0 }), [centers]);

  const ftTotals = useMemo(() => ftRows.reduce((acc, f) => ({
    plan: acc.plan + (f.plan_qty || 0), done: acc.done + (f.done_qty || 0),
  }), { plan: 0, done: 0 }), [ftRows]);
  const centerRow = centers.find((c) => c.center === selectedCenter);
  const ftMismatch = centerRow && (ftTotals.plan !== (centerRow.plan_qty || 0) || ftTotals.done !== (centerRow.done_qty || 0));

  const numField = (form, setForm, label, key) => (
    <Field label={label}><input className="inp" type="number" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <Field label="Kỳ báo cáo">
          <input className="inp" style={{ maxWidth: 140 }} placeholder="2026-09" value={period}
            onChange={(e) => setPeriod(e.target.value)} list="progress-periods" />
        </Field>
        <datalist id="progress-periods">{periods.map((p) => <option key={p} value={p} />)}</datalist>
        <button className="btn btn-sm" onClick={() => { loadSummary(); if (selected) loadCenters(); if (selectedCenter) loadFt(); }}><RefreshCw size={14} />Tải lại</button>
        <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>
        <button className="btn btn-sm" onClick={() => setShowImport((s) => !s)}><Upload size={14} />Nhập Excel</button>
      </div>

      {showImport && (
        <Card title="Nhập Excel — Tiến độ hạng mục kỹ thuật">
          <AdminImport fixedKind="progress" />
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { setShowImport(false); loadSummary(); if (selected) loadCenters(); }}>Đóng</button>
          </div>
        </Card>
      )}

      {err && <p style={{ color: RED }}>{err}</p>}

      {!selected && (
        <>
          {itemGroups.map((g) => (
            <div key={g.category}>
              <p className="eyebrow-grey" style={{ margin: "10px 0 8px" }}>{g.category_label}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {g.items.map((it) => {
                  const s = summary.find((x) => x.category === g.category && x.item === it.id)
                    || { plan_qty: 0, done_qty: 0, remaining: 0, rate: null };
                  return (
                    <button key={it.id} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 12 }}
                      onClick={() => openItem(g.category, g.category_label, it.id, it.label)}>
                      <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.3, minHeight: 30 }}>{it.label}</p>
                      <div style={{ marginTop: 6 }}>
                        <span style={{ fontSize: 20, fontWeight: 800, color: RED }}>{s.done_qty}</span>
                        <span className="muted" style={{ fontSize: 12 }}> / {s.plan_qty}</span>
                      </div>
                      <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                        <span className="tag tag-grey">Tồn {s.remaining}</span>
                        <span className="tag tag-green">{pct(s.rate)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!itemGroups.length && <Empty title="Chưa có hạng mục định lượng." />}
        </>
      )}

      {selected && !selectedCenter && (
        <>
          <button className="btn btn-sm" onClick={backToOverview}><ArrowLeft size={14} />Quay lại Tổng quan</button>
          <Card title={`${selected.item_label} — Kỳ ${period}`} icon={undefined}
            action={<button className="btn btn-sm" onClick={() => setCenterForm(blankCenterRow(selected, period))}><Plus size={14} />Thêm trung tâm</button>}>
            {centerForm && (
              <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Trung tâm"><input className="inp" value={centerForm.center} onChange={(e) => setCenterForm({ ...centerForm, center: e.target.value })} /></Field>
                  {numField(centerForm, setCenterForm, "Kế hoạch", "plan_qty")}
                  {numField(centerForm, setCenterForm, "Thực hiện", "done_qty")}
                  <Field label="Ghi chú"><input className="inp" value={centerForm.note || ""} onChange={(e) => setCenterForm({ ...centerForm, note: e.target.value })} /></Field>
                </div>
                <div className="flex gap-2" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => setCenterForm(null)}>Hủy</button>
                  <button className="btn btn-red" onClick={saveCenter}>Lưu</button>
                </div>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th>TT</th><th>Trung tâm</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th><th>Tỷ lệ HT</th><th></th></tr></thead>
                <tbody>
                  {centers.map((c, i) => (
                    <tr key={c.id}>
                      <td className="mono">{i + 1}</td>
                      <td><button className="btn btn-sm" style={{ border: "none", padding: 0, fontWeight: 700 }} onClick={() => openCenter(c.center)}>{c.center}</button></td>
                      <td>{c.plan_qty}</td>
                      <td>{c.done_qty}</td>
                      <td>{c.remaining}</td>
                      <td>{pct(c.rate)}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setCenterForm({ ...c })}>Sửa</button>{" "}
                        <button className="btn btn-sm" onClick={() => delCenter(c)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                  {!!centers.length && (
                    <tr style={{ fontWeight: 800 }}>
                      <td colSpan={2}>Tổng cộng</td>
                      <td>{centerTotals.plan}</td>
                      <td>{centerTotals.done}</td>
                      <td>{centerTotals.plan - centerTotals.done}</td>
                      <td>{pct(centerTotals.plan ? centerTotals.done / centerTotals.plan : null)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
              {!centers.length && <Empty title="Chưa có số liệu trung tâm cho kỳ này." hint="Bấm “Thêm trung tâm” hoặc “Nhập Excel” ở trên." />}
            </div>
          </Card>
        </>
      )}

      {selected && selectedCenter && (
        <>
          <button className="btn btn-sm" onClick={backToCenters}><ArrowLeft size={14} />Quay lại {selected.item_label}</button>
          <Card title={`FT phụ trách — ${selectedCenter}`}
            action={<button className="btn btn-sm" onClick={() => setFtForm(blankFtRow(selected, period, selectedCenter))}><Plus size={14} />Thêm FT</button>}>
            {centerRow && (
              <p className={ftMismatch ? "tag tag-amber" : "tag tag-grey"} style={{ display: "inline-flex", marginBottom: 10 }}>
                Tổng theo FT: {ftTotals.done}/{ftTotals.plan} — so với Trung tâm: {centerRow.done_qty}/{centerRow.plan_qty}
              </p>
            )}
            {ftForm && (
              <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Tên FT"><input className="inp" value={ftForm.ft_name} onChange={(e) => setFtForm({ ...ftForm, ft_name: e.target.value })} /></Field>
                  {numField(ftForm, setFtForm, "Kế hoạch", "plan_qty")}
                  {numField(ftForm, setFtForm, "Thực hiện", "done_qty")}
                  <Field label="Ghi chú"><input className="inp" value={ftForm.note || ""} onChange={(e) => setFtForm({ ...ftForm, note: e.target.value })} /></Field>
                </div>
                <div className="flex gap-2" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => setFtForm(null)}>Hủy</button>
                  <button className="btn btn-red" onClick={saveFt}>Lưu</button>
                </div>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th>FT</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th><th>Tỷ lệ HT</th><th></th></tr></thead>
                <tbody>
                  {ftRows.map((f) => (
                    <tr key={f.id}>
                      <td><b>{f.ft_name}</b>{f.note && <><br /><span className="muted">{f.note}</span></>}</td>
                      <td>{f.plan_qty}</td>
                      <td>{f.done_qty}</td>
                      <td>{f.remaining}</td>
                      <td>{pct(f.rate)}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setFtForm({ ...f })}>Sửa</button>{" "}
                        <button className="btn btn-sm" onClick={() => delFt(f)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!ftRows.length && <Empty title="Chưa chia việc theo FT cho trung tâm này." hint="Bấm “Thêm FT” để bắt đầu." />}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
