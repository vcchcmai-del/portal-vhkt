import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, useCenters } from "./api";
import { AdminImport } from "./bulkimport";
import { Card, Empty, Field, RED } from "./ui";

// Đầu việc KHÔNG còn khai báo cứng ở đây nữa: danh sách lấy từ
// /api/admin/tech-tasks/categories (bảng tech_categories). Trước đây cùng một
// danh sách bị chép ở cả hai phía nên thêm đầu việc phải sửa code hai nơi và
// rất dễ lệch với phần Tiến độ.

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

const blankTask = (categories) => ({
  category: categories?.[0]?.id || "", title: "", description: "", assignee: "", target: "",
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
  const [categories, setCategories] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [newCat, setNewCat] = useState(null);   // tên đầu việc đang thêm, null = không mở ô

  const catLabels = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);
  const catHint = useMemo(
    () => categories.find((c) => c.id === form?.category)?.hint || "", [categories, form?.category]);

  const loadCategories = () => api.get("/api/admin/tech-tasks/categories")
    .then((x) => setCategories(Array.isArray(x) ? x : []))
    .catch((e) => setErr(e.message));

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
  useEffect(() => {
    loadCategories();
    api.get("/api/admin/tech-tasks/assignees")
      .then((x) => setAssignees(Array.isArray(x) ? x : [])).catch(() => {});
  }, []);

  /** Thêm đầu việc mới ngay trong form giao việc, rồi chọn luôn đầu việc đó. */
  const themDauViec = async () => {
    const label = (newCat || "").trim();
    if (!label) { setNewCat(null); return; }
    try {
      const c = await api.post("/api/admin/tech-tasks/categories", { label });
      await loadCategories();
      setForm((f) => (f ? { ...f, category: c.id } : f));
      setNewCat(null); setErr("");
    } catch (e) { setErr(e.message); }
  };

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
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>Giao và theo dõi tiến độ {categories.length} đầu việc.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={() => { load(); loadSummary(); loadCategories(); }}><RefreshCw size={14} />Tải lại</button>
          <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>
          <button className="btn btn-red btn-sm" onClick={() => setForm(blankTask(categories))}><Plus size={14} />Giao việc mới</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {categories.map((c) => {
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
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
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
              {newCat === null ? (
                <div className="flex gap-2">
                  <select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {!form.category && <option value="">— Chọn đầu việc —</option>}
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" title="Thêm đầu việc mới"
                    onClick={() => setNewCat("")}><Plus size={14} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="inp" autoFocus placeholder="Tên đầu việc mới, vd: 11. An toàn thông tin"
                    value={newCat} onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themDauViec(); } }} />
                  <button type="button" className="btn btn-red btn-sm" onClick={themDauViec}>Thêm</button>
                  <button type="button" className="btn btn-sm" onClick={() => setNewCat(null)}>Hủy</button>
                </div>
              )}
            </Field>
            <Field label="Trạng thái">
              <select className="inp" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS_LABELS).filter(([k]) => k !== "overdue").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          {catHint && (
            <p className="muted" style={{ fontSize: 12, marginTop: 6, background: "#FAF9F9", padding: "8px 10px", borderRadius: 8 }}>
              Gợi ý phạm vi: {catHint}
            </p>
          )}
          <div style={{ marginTop: 12 }}>{field("Nội dung công việc", "title")}</div>
          <Field label="Mô tả chi tiết"><textarea className="inp" rows="2" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Người/tổ phụ trách">
              {/* Gõ để lọc, chọn từ danh sách nhân viên và tài khoản đã có; vẫn
                  cho gõ tự do tên tổ/đội chưa lập hồ sơ. */}
              <input className="inp" list="ds-phu-trach" placeholder="Chọn hoặc gõ tên…"
                value={form.assignee || ""} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
              <datalist id="ds-phu-trach">
                {assignees.map((a) => (
                  <option key={a.name} value={a.name}>
                    {[a.role, a.dept, a.nguon].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </datalist>
            </Field>
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
                  <td className="muted" style={{ fontSize: 12.5 }}>{catLabels[x.category] || x.category_label || x.category}</td>
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

  const { danhSach: danhSachTrungTam, tenTrungTam } = useCenters();
  const [newItemCat, setNewItemCat] = useState(null);  // đầu việc đang thêm hạng mục
  const [newItem, setNewItem] = useState("");
  const [assignees, setAssignees] = useState([]);

  const loadItems = () => api.get("/api/admin/progress/items")
    .then((x) => setItemGroups(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));

  /** Thêm hạng mục định lượng cho đúng đầu việc đang đứng. */
  const themHangMuc = async (category) => {
    const label = (newItem || "").trim();
    if (!label) { setNewItemCat(null); return; }
    try {
      await api.post("/api/admin/progress/items", { category, label });
      setNewItemCat(null); setNewItem(""); setErr("");
      loadItems(); loadSummary();
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => {
    api.get("/api/admin/progress/periods").then((x) => {
      const list = Array.isArray(x) ? x : [];
      setPeriods(list);
      if (list.length) setPeriod(list[0]);
    }).catch(() => {});
    loadItems();
    api.get("/api/admin/tech-tasks/assignees")
      .then((x) => setAssignees(Array.isArray(x) ? x : [])).catch(() => {});
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
              <div className="flex items-center gap-2" style={{ margin: "10px 0 8px" }}>
                <p className="eyebrow-grey">{g.category_label}</p>
                {newItemCat === g.category ? (
                  <>
                    <input className="inp" style={{ maxWidth: 260 }} autoFocus placeholder="Tên hạng mục mới…"
                      value={newItem} onChange={(e) => setNewItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themHangMuc(g.category); } }} />
                    <button className="btn btn-red btn-sm" onClick={() => themHangMuc(g.category)}>Thêm</button>
                    <button className="btn btn-sm" onClick={() => { setNewItemCat(null); setNewItem(""); }}>Hủy</button>
                  </>
                ) : (
                  <button className="btn btn-sm" title={`Thêm hạng mục cho ${g.category_label}`}
                    onClick={() => { setNewItemCat(g.category); setNewItem(""); }}><Plus size={13} /></button>
                )}
              </div>
              {!g.items.length && (
                <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Đầu việc này chưa khai báo hạng mục định lượng — bấm ＋ để thêm.
                </p>
              )}
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
                  <Field label="Trung tâm">
                    <select className="inp" value={centerForm.center}
                      onChange={(e) => setCenterForm({ ...centerForm, center: e.target.value })}>
                      <option value="">— Chọn trung tâm —</option>
                      {danhSachTrungTam.map((c) => (
                        <option key={c.code} value={c.code}>{c.code} — {c.short || c.name}</option>
                      ))}
                    </select>
                  </Field>
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
                      <td><button className="btn btn-sm" style={{ border: "none", padding: 0, fontWeight: 700 }} onClick={() => openCenter(c.center)}>{tenTrungTam(c.center)}</button></td>
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
                  <Field label="Tên FT">
                    <input className="inp" list="ds-phu-trach-ft" placeholder="Chọn hoặc gõ tên…"
                      value={ftForm.ft_name} onChange={(e) => setFtForm({ ...ftForm, ft_name: e.target.value })} />
                    <datalist id="ds-phu-trach-ft">
                      {assignees.map((a) => (
                        <option key={a.name} value={a.name}>
                          {[a.role, a.dept].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </datalist>
                  </Field>
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
