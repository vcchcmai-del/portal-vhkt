import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Download, Link2, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { api, coQuyen, laNguoiQuanLy, useCenters } from "./api";
import { STATUS_LABELS, TaskListTab } from "./techtasks-list";
import { TheoNhanVienTab } from "./techtasks-person";
import { AdminImport } from "./bulkimport";
import { Card, Empty, Field, RED, ThaoTac } from "./ui";
import { BaoCaoCongViec } from "./techtasks-report";

// Đầu việc KHÔNG còn khai báo cứng ở đây nữa: danh sách lấy từ
// /api/admin/tech-tasks/categories (bảng tech_categories). Trước đây cùng một
// danh sách bị chép ở cả hai phía nên thêm đầu việc phải sửa code hai nơi và
// rất dễ lệch với phần Tiến độ.

const pct = (rate) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);

export function AdminTechTasks() {
  const [tab, setTab] = useState("list");
  // Liên kết hai chiều giữa hai tab: từ một việc mở thẳng hạng mục bên Tiến độ,
  // từ một hạng mục quay về danh sách việc của đầu việc đó.
  const [moTienDo, setMoTienDo] = useState(null);
  const [locDauViec, setLocDauViec] = useState(undefined);
  // Từ tab "Theo nhân viên" bấm "Xem việc" -> danh sách lọc sẵn theo người đó.
  // Kèm mốc thời gian để bấm lại cùng một người vẫn áp lại bộ lọc.
  const [locNguoi, setLocNguoi] = useState(undefined);
  const nutTab = (ma, nhan, khiBam) => (
    <button className={`btn btn-sm ${tab === ma ? "btn-red" : ""}`} onClick={() => { khiBam?.(); setTab(ma); }}>{nhan}</button>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex gap-2" style={{ padding: 8, flexWrap: "wrap" }}>
        {nutTab("list", "Danh sách công việc")}
        {nutTab("person", "Theo nhân viên")}
        {nutTab("report", "Báo cáo")}
        {nutTab("progress", "Tiến độ", () => setMoTienDo(null))}
      </div>
      {tab === "list" && (
        <TaskListTab locDauViec={locDauViec} locNguoi={locNguoi}
          onMoTienDo={(t) => {
            setMoTienDo({ category: t.category, category_label: t.category_label,
                          item: t.progress_item, item_label: t.progress_item_label });
            setTab("progress");
          }} />
      )}
      {tab === "person" && (
        <TheoNhanVienTab onXemViec={(ten) => { setLocDauViec(""); setLocNguoi({ ten, luc: Date.now() }); setTab("list"); }} />
      )}
      {tab === "report" && (
        <BaoCaoCongViec onXemViec={(ten) => { setLocDauViec(""); setLocNguoi({ ten, luc: Date.now() }); setTab("list"); }}
          onXemDauViec={(category) => { setLocDauViec(category); setLocNguoi({ ten: "", luc: Date.now() }); setTab("list"); }} />
      )}
      {tab === "progress" && (
        <ProgressTab moSan={moTienDo}
          onXemViec={(category) => { setLocDauViec(category); setLocNguoi({ ten: "", luc: Date.now() }); setTab("list"); }} />
      )}
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

const soGon = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

/** Thanh tiến độ Thực hiện/Kế hoạch: xanh lá khi đạt, xanh dương từ 50%, vàng dưới 50%. */
function ThanhTienDo({ done, plan }) {
  const r = plan ? Math.min(done / plan, 1) : 0;
  const mau = !plan ? "transparent" : r >= 1 ? "#16A34A" : r >= 0.5 ? "#0E6CD6" : "#F2A007";
  return (
    <div className="flex items-center gap-2">
      <div style={{ flex: 1, minWidth: 80, height: 8, background: "#EAF1FB", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${r * 100}%`, height: "100%", background: mau, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12.5, whiteSpace: "nowrap", minWidth: 110, textAlign: "right" }}>
        <b>{soGon(done)}</b> / {soGon(plan)} · {plan ? pct(done / plan) : "—"}
      </span>
    </div>
  );
}

function ProgressTab({ moSan, onXemViec }) {
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
  const [viecLienKet, setViecLienKet] = useState([]);   // công việc có gắn hạng mục
  const [suaHangMuc, setSuaHangMuc] = useState(null);   // {id, label} đang đổi tên
  const [suaDauViec, setSuaDauViec] = useState(null);   // {category, label} đang đổi tên
  // Chế độ xem mặc định gọn: ẩn nút sửa/xoá/thêm, chỉ hiện hạng mục có số liệu kỳ này.
  const [cheDoSua, setCheDoSua] = useState(false);
  const [chiCoSoLieu, setChiCoSoLieu] = useState(null);   // null = tự chọn theo dữ liệu
  const [dongNhom, setDongNhom] = useState([]);             // mã đầu việc đang gập
  const duocThem = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  const loadItems = () => api.get("/api/admin/progress/items")
    .then((x) => setItemGroups(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));

  const luuHangMuc = async () => {
    const label = (suaHangMuc?.label || "").trim();
    if (!label) { setSuaHangMuc(null); return; }
    try {
      await api.put(`/api/admin/progress/items/${suaHangMuc.id}`, { label });
      setSuaHangMuc(null); setErr(""); loadItems(); loadSummary();
    } catch (e) { setErr(e.message); }
  };

  /** Xoá hạng mục; còn số liệu thì hỏi lại rồi mới xoá kèm số liệu các kỳ. */
  const xoaHangMuc = async (it) => {
    if (!window.confirm(`Xóa hạng mục “${it.label}”?`)) return;
    try {
      await api.del(`/api/admin/progress/items/${it.id}`);
    } catch (e) {
      if (!/dòng tiến độ/.test(e.message)) { setErr(e.message); return; }
      if (!window.confirm(`${e.message}\n\nXóa luôn toàn bộ số liệu của hạng mục này ở mọi kỳ? Không khôi phục được — nên Xuất CSV lưu lại trước.`)) return;
      try { await api.del(`/api/admin/progress/items/${it.id}?xoa_so_lieu=true`); }
      catch (e2) { setErr(e2.message); return; }
    }
    setErr(""); loadItems(); loadSummary();
    setViecLienKet((ds) => ds.filter((t) => t.progress_item !== it.id));
  };

  const luuDauViec = async () => {
    const label = (suaDauViec?.label || "").trim();
    if (!label) { setSuaDauViec(null); return; }
    try {
      await api.put(`/api/admin/tech-tasks/categories/${suaDauViec.category}`, { label });
      setSuaDauViec(null); setErr(""); loadItems(); loadSummary();
    } catch (e) { setErr(e.message); }
  };

  /** Đồng bộ dòng tổng Trung tâm = tổng các dòng FT (khi hai bên lệch nhau). */
  const dongBoTuFt = async () => {
    if (!centerRow) return;
    if (!window.confirm(`Ghi Kế hoạch ${ftTotals.plan} / Thực hiện ${ftTotals.done} (tổng theo FT) vào dòng trung tâm ${selectedCenter}?`)) return;
    try {
      await api.put(`/api/admin/progress/centers/${centerRow.id}`, { plan_qty: ftTotals.plan, done_qty: ftTotals.done });
      setErr(""); loadCenters(); loadSummary();
    } catch (e) { setErr(e.message); }
  };

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
    api.get("/api/admin/tech-tasks")
      .then((x) => setViecLienKet((Array.isArray(x) ? x : []).filter((t) => t.progress_item))).catch(() => {});
  }, []);

  // Được mở từ một công việc: vào thẳng hạng mục đó.
  useEffect(() => { if (moSan?.item) openItem(moSan.category, moSan.category_label, moSan.item, moSan.item_label); }, [moSan]);
  const viecCuaHangMuc = (item) => viecLienKet.filter((t) => t.progress_item === item);

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

  const tomTat = (item, cat) => summary.find((x) => x.category === cat && x.item === item)
    || { plan_qty: 0, done_qty: 0, remaining: 0, rate: null };
  const coSoLieu = (x) => (x.plan_qty || 0) !== 0 || (x.done_qty || 0) !== 0;
  const tongHangMuc = itemGroups.reduce((n, g) => n + g.items.length, 0);
  const soCoSoLieu = itemGroups.reduce((n, g) => n + g.items.filter((it) => coSoLieu(tomTat(it.id, g.category))).length, 0);
  const locRong = (chiCoSoLieu ?? soCoSoLieu > 0) && !cheDoSua;
  const nhomHien = itemGroups
    .map((g) => ({ ...g, hien: locRong ? g.items.filter((it) => coSoLieu(tomTat(it.id, g.category))) : g.items }))
    .filter((g) => g.hien.length || !locRong);
  const doiGap = (cat) => setDongNhom((ds) => (ds.includes(cat) ? ds.filter((x) => x !== cat) : [...ds, cat]));
  const nutNho = { padding: "3px 6px" };

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
        {laNguoiQuanLy("tech_tasks") && <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>}
        {(duocThem || duocSua) && <button className="btn btn-sm" onClick={() => setShowImport((s) => !s)}><Upload size={14} />Nhập / đồng bộ Excel</button>}
      </div>

      {showImport && (
        <Card title="Nhập / đồng bộ Excel — Tiến độ hạng mục kỹ thuật">
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
            Dòng trùng (đầu việc, hạng mục, kỳ, trung tâm) được <b>cập nhật đè</b>, dòng mới được thêm — nhập lại tệp đã sửa là đồng bộ, không sinh trùng.
            Tải tệp mẫu, hoặc Xuất CSV ở trên để lấy số liệu hiện có ra sửa rồi nhập ngược lại.
          </p>
          <AdminImport fixedKind="progress" />
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { setShowImport(false); loadSummary(); if (selected) loadCenters(); }}>Đóng</button>
          </div>
        </Card>
      )}

      {err && <p style={{ color: RED }}>{err}</p>}

      {!selected && (
        <>
          <div className="card flex items-center gap-2" style={{ flexWrap: "wrap", padding: "10px 14px" }}>
            <span style={{ fontSize: 13 }}>Kỳ <b>{period}</b>: <b>{soCoSoLieu}</b>/{tongHangMuc} hạng mục có số liệu</span>
            <span style={{ flex: 1 }} />
            {!cheDoSua && (
              <div className="flex" style={{ gap: 4 }}>
                <button className={`btn btn-sm ${locRong ? "btn-red" : ""}`} onClick={() => setChiCoSoLieu(true)}>Có số liệu</button>
                <button className={`btn btn-sm ${!locRong ? "btn-red" : ""}`} onClick={() => setChiCoSoLieu(false)}>Tất cả</button>
              </div>
            )}
            {(duocThem || duocSua || duocXoa) && (
              <button className={`btn btn-sm ${cheDoSua ? "btn-red" : ""}`}
                onClick={() => { setCheDoSua((v) => !v); setSuaHangMuc(null); setSuaDauViec(null); setNewItemCat(null); }}>
                <Pencil size={13} />{cheDoSua ? "Xong chỉnh sửa" : "Chỉnh sửa danh mục"}
              </button>
            )}
          </div>
          {cheDoSua && (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Đang chỉnh sửa danh mục — đổi tên, thêm, xóa hạng mục và đầu việc. Bấm “Xong chỉnh sửa” để về chế độ xem.
            </p>
          )}

          {nhomHien.map((g) => {
            const gap = dongNhom.includes(g.category) && !cheDoSua;
            const tong = g.hien.reduce((a, it) => {
              const x = tomTat(it.id, g.category);
              return { plan: a.plan + (x.plan_qty || 0), done: a.done + (x.done_qty || 0) };
            }, { plan: 0, done: 0 });
            return (
              <div key={g.category} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="flex items-center gap-2"
                  style={{ padding: "10px 14px", background: "#FCFBFB", borderBottom: gap ? "none" : "1px solid #EFECED", flexWrap: "wrap" }}>
                  {suaDauViec?.category === g.category ? (
                    <>
                      <input className="inp" style={{ maxWidth: 260 }} autoFocus value={suaDauViec.label}
                        onChange={(e) => setSuaDauViec({ ...suaDauViec, label: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); luuDauViec(); } if (e.key === "Escape") setSuaDauViec(null); }} />
                      <button className="btn btn-red btn-sm" onClick={luuDauViec}>Lưu</button>
                      <button className="btn btn-sm" onClick={() => setSuaDauViec(null)}>Hủy</button>
                    </>
                  ) : (
                    <button type="button" className="flex items-center gap-1" onClick={() => doiGap(g.category)}
                      style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontWeight: 700, fontSize: 13.5, color: "inherit" }}>
                      {gap ? <ChevronRight size={15} /> : <ChevronDown size={15} />}{g.category_label}
                    </button>
                  )}
                  <span className="muted" style={{ fontSize: 12 }}>{g.hien.length} hạng mục</span>
                  {tong.plan > 0 && <span className="tag tag-green">{soGon(tong.done)}/{soGon(tong.plan)} · {pct(tong.done / tong.plan)}</span>}
                  <span style={{ flex: 1 }} />
                  {cheDoSua && duocSua && suaDauViec?.category !== g.category && (
                    <button className="btn btn-sm" onClick={() => setSuaDauViec({ category: g.category, label: g.category_label })}>
                      <Pencil size={12} />Đổi tên
                    </button>
                  )}
                  {cheDoSua && duocThem && (newItemCat === g.category ? (
                    <>
                      <input className="inp" style={{ maxWidth: 240 }} autoFocus placeholder="Tên hạng mục mới…"
                        value={newItem} onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themHangMuc(g.category); } }} />
                      <button className="btn btn-red btn-sm" onClick={() => themHangMuc(g.category)}>Thêm</button>
                      <button className="btn btn-sm" onClick={() => { setNewItemCat(null); setNewItem(""); }}>Hủy</button>
                    </>
                  ) : (
                    <button className="btn btn-sm" onClick={() => { setNewItemCat(g.category); setNewItem(""); }}><Plus size={13} />Thêm hạng mục</button>
                  ))}
                </div>
                {!gap && (g.hien.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table className="tbl">
                      <thead><tr><th>Hạng mục</th><th>Thực hiện / Kế hoạch</th><th>Tồn</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
                      <tbody>
                        {g.hien.map((it) => {
                          const x = tomTat(it.id, g.category);
                          const dangSua = suaHangMuc?.id === it.id;
                          const soViec = viecCuaHangMuc(it.id).length;
                          return (
                            <tr key={it.id} style={{ cursor: dangSua ? "default" : "pointer" }}
                              onClick={() => { if (!dangSua) openItem(g.category, g.category_label, it.id, it.label); }}>
                              <td style={{ width: "36%" }}>
                                {dangSua ? (
                                  <div className="flex items-center" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
                                    <input className="inp" autoFocus value={suaHangMuc.label}
                                      onChange={(e) => setSuaHangMuc({ ...suaHangMuc, label: e.target.value })}
                                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); luuHangMuc(); } if (e.key === "Escape") setSuaHangMuc(null); }} />
                                    <button className="btn btn-red btn-sm" onClick={luuHangMuc}>Lưu</button>
                                    <button className="btn btn-sm" onClick={() => setSuaHangMuc(null)}>Hủy</button>
                                  </div>
                                ) : (
                                  <span style={{ fontWeight: 600 }}>{it.label}</span>
                                )}
                                {!!soViec && !dangSua && (
                                  <span className="tag tag-amber" style={{ marginLeft: 6, fontSize: 11 }}><Link2 size={10} /> {soViec} việc</span>
                                )}
                              </td>
                              <td style={{ width: "40%" }}><ThanhTienDo done={x.done_qty || 0} plan={x.plan_qty || 0} /></td>
                              <td className="muted" style={{ whiteSpace: "nowrap" }}>{soGon(x.remaining)}</td>
                              <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                                {!dangSua && (
                                  <ThaoTac onView={() => openItem(g.category, g.category_label, it.id, it.label)} xemTitle="Xem theo trung tâm"
                                    onEdit={duocSua ? () => setSuaHangMuc({ id: it.id, label: it.label }) : null} suaTitle="Đổi tên hạng mục"
                                    onDelete={duocXoa ? () => xoaHangMuc(it) : null} xoaTitle="Xóa hạng mục" />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 12.5, padding: "10px 14px" }}>
                    Chưa có hạng mục định lượng{cheDoSua && duocThem ? " — bấm “Thêm hạng mục”." : "."}
                  </p>
                ))}
              </div>
            );
          })}
          {!nhomHien.length && (
            <Empty title={`Kỳ ${period} chưa có số liệu tiến độ.`}
              hint="Bấm “Tất cả” để xem danh mục hạng mục, hoặc “Nhập / đồng bộ Excel” để nạp số liệu." />
          )}
        </>
      )}

      {selected && !selectedCenter && (
        <>
          <button className="btn btn-sm" onClick={backToOverview}><ArrowLeft size={14} />Quay lại Tổng quan</button>
          {!!viecCuaHangMuc(selected.item).length && (
            <div className="card" style={{ padding: 12 }}>
              <p className="eyebrow-grey" style={{ marginBottom: 6 }}>Công việc liên kết hạng mục này</p>
              {viecCuaHangMuc(selected.item).map((t) => (
                <div key={t.id} className="flex items-center gap-2" style={{ fontSize: 13, padding: "3px 0", flexWrap: "wrap" }}>
                  <b>{t.title}</b>
                  <span className="muted">— {t.assignee || "chưa giao"}{t.coordinators?.length ? ` · phối hợp: ${t.coordinators.join(", ")}` : ""}</span>
                  <span className="tag tag-grey">{STATUS_LABELS[t.status] || t.status}</span>
                  {!!t.attachments?.length && <span className="muted">· {t.attachments.length} đính kèm</span>}
                </div>
              ))}
              {onXemViec && <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => onXemViec(selected.category)}>Xem ở danh sách công việc</button>}
            </div>
          )}
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
                <thead><tr><th>TT</th><th>Trung tâm</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th><th>Tỷ lệ HT</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
                <tbody>
                  {centers.map((c, i) => (
                    <tr key={c.id}>
                      <td className="mono">{i + 1}</td>
                      <td><button className="btn btn-sm" style={{ border: "none", padding: 0, fontWeight: 700 }} onClick={() => openCenter(c.center)}>{tenTrungTam(c.center)}</button></td>
                      <td>{c.plan_qty}</td>
                      <td>{c.done_qty}</td>
                      <td>{c.remaining}</td>
                      <td>{pct(c.rate)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <ThaoTac onView={() => openCenter(c.center)} xemTitle="Xem chi tiết theo FT"
                          onEdit={duocSua ? () => setCenterForm({ ...c }) : null}
                          onDelete={duocXoa ? () => delCenter(c) : null} />
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
              <div className="flex items-center gap-2" style={{ marginBottom: 10, flexWrap: "wrap" }}>
                <p className={ftMismatch ? "tag tag-amber" : "tag tag-grey"} style={{ display: "inline-flex" }}>
                  Tổng theo FT: {ftTotals.done}/{ftTotals.plan} — so với Trung tâm: {centerRow.done_qty}/{centerRow.plan_qty}
                </p>
                {ftMismatch && ftRows.length > 0 && duocSua && (
                  <button className="btn btn-sm" onClick={dongBoTuFt} title="Ghi tổng theo FT vào dòng trung tâm">
                    <RefreshCw size={13} />Đồng bộ lên trung tâm
                  </button>
                )}
              </div>
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
                <thead><tr><th>FT</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th><th>Tỷ lệ HT</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
                <tbody>
                  {ftRows.map((f) => (
                    <tr key={f.id}>
                      <td><b>{f.ft_name}</b>{f.note && <><br /><span className="muted">{f.note}</span></>}</td>
                      <td>{f.plan_qty}</td>
                      <td>{f.done_qty}</td>
                      <td>{f.remaining}</td>
                      <td>{pct(f.rate)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <ThaoTac
                          xem={{ tieuDe: `FT ${f.ft_name}`, duLieu: f, nhan: { ft_name: "FT", center: "Trung tâm", item_label: "Hạng mục",
                            period: "Kỳ", plan_qty: "Kế hoạch", done_qty: "Thực hiện", remaining: "Tồn", note: "Ghi chú", updated_at: "Cập nhật" } }}
                          onEdit={duocSua ? () => setFtForm({ ...f }) : null}
                          onDelete={duocXoa ? () => delFt(f) : null} />
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
