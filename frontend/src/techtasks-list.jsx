import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, ExternalLink, FileText, Link2, Paperclip, Pencil, Plus, RefreshCw, Trash2, Upload, User, Users, X,
} from "lucide-react";
import { api, coQuyen, getUser, laNguoiQuanLy } from "./api";
import { Card, Empty, Field, RED } from "./ui";

/*
 * Danh sách công việc mảng kỹ thuật.
 *
 * Mỗi việc gắn với ba nhóm người — phụ trách (người làm), phối hợp, báo cáo —
 * chọn từ danh bạ nhân viên/tài khoản. Người được gắn tên tự báo cáo tiến độ
 * và đính kèm link/tệp số liệu cho việc của mình, kể cả khi tài khoản chỉ có
 * quyền xem; giao, sửa, xoá việc vẫn cần quyền tương ứng của module.
 *
 * Việc còn liên kết với một hạng mục định lượng bên tab Tiến độ: dòng việc
 * hiện luôn Kế hoạch/Thực hiện kỳ gần nhất của hạng mục đó, bấm để mở thẳng.
 */

export const STATUS_LABELS = { todo: "Chưa bắt đầu", doing: "Đang thực hiện", done: "Hoàn thành", overdue: "Quá hạn" };
const STATUS_TAG = { todo: "tag-grey", doing: "tag-amber", done: "tag-green", overdue: "tag-red" };

const day = (v) => (v ? String(v).slice(0, 10) : "");
const homNay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isOverdue = (task) => task.status !== "done" && task.due_at && day(task.due_at) < homNay();
const effectiveStatus = (task) => (isOverdue(task) ? "overdue" : task.status);
const fmtDay = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");
const pct = (rate) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);
const soGon = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 }));
const coLinkThat = (u) => /^https?:\/\/\S+$/i.test((u || "").trim());

function StatusTag({ task }) {
  const s = effectiveStatus(task);
  return <span className={`tag ${STATUS_TAG[s] || "tag-grey"}`}>{STATUS_LABELS[s] || s}</span>;
}

const blankTask = (categories, fCategory) => ({
  category: fCategory || categories?.[0]?.id || "", title: "", description: "", assignee: "",
  coordinators: [], reporter: "", target: "", due_at: "", status: "todo", link_url: "",
  progress_item: "", note: "",
});

/** Tải tệp đính kèm (có token) rồi mở/lưu trên máy người dùng. */
async function taiDinhKem(a) {
  const { blob } = await api.blob(`/api/admin/tech-tasks/attachments/${a.id}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = a.filename || a.title || "dinh-kem"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------------------------------------------------------- chọn người */

function DanhSachNguoi({ id, assignees }) {
  return (
    <datalist id={id}>
      {assignees.map((a) => (
        <option key={a.name} value={a.name}>{[a.role, a.dept, a.nguon].filter(Boolean).join(" · ")}</option>
      ))}
    </datalist>
  );
}

/** Ô nhiều người: gõ/chọn tên rồi Enter (hoặc bấm ＋) để thêm thành thẻ. */
function NhieuNguoi({ value, onChange, assignees, listId }) {
  const [go, setGo] = useState("");
  const them = () => {
    const ten = go.trim();
    if (ten && !value.some((x) => x.toLowerCase() === ten.toLowerCase())) onChange([...value, ten]);
    setGo("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input className="inp" list={listId} placeholder="Chọn hoặc gõ tên rồi Enter…" value={go}
          onChange={(e) => setGo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); them(); } }}
          onBlur={them} />
        <button type="button" className="btn btn-sm" onClick={them} title="Thêm người phối hợp"><Plus size={14} /></button>
      </div>
      <DanhSachNguoi id={listId} assignees={assignees} />
      {!!value.length && (
        <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 6 }}>
          {value.map((ten) => (
            <span key={ten} className="tag tag-grey" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {ten}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== ten))}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 0 }}
                aria-label={`Bỏ ${ten}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- đính kèm */

/** Khung đính kèm: danh sách link/tệp + ô thêm. Với việc chưa lưu (taskId rỗng)
 *  thì gom tạm vào `choGui`, lưu việc xong mới đẩy lên. */
function KhungDinhKem({ taskId, items, duocThem, duocXoa, onDoi, choGui, setChoGui }) {
  const [link, setLink] = useState({ title: "", url: "" });
  const [dangGui, setDangGui] = useState("");
  const [loi, setLoi] = useState("");
  const chonTep = useRef(null);

  const themLink = async () => {
    const url = link.url.trim();
    if (!coLinkThat(url)) { setLoi("Link cần bắt đầu bằng http:// hoặc https://"); return; }
    setLoi("");
    if (!taskId) { setChoGui([...choGui, { kind: "link", title: link.title.trim() || url, url }]); setLink({ title: "", url: "" }); return; }
    try {
      await api.post(`/api/admin/tech-tasks/${taskId}/attachments/link`, { title: link.title, url });
      setLink({ title: "", url: "" }); onDoi?.();
    } catch (e) { setLoi(e.message); }
  };

  const themTep = async (files) => {
    const ds = [...(files || [])];
    if (!ds.length) return;
    setLoi("");
    if (!taskId) { setChoGui([...choGui, ...ds.map((f) => ({ kind: "file", title: f.name, file: f }))]); return; }
    const loiTep = [];
    for (const f of ds) {
      setDangGui(f.name);
      try { await api.uploadTo(`/api/admin/tech-tasks/${taskId}/attachments/file`, f); }
      catch (e) { loiTep.push(e.message); }
    }
    setDangGui(""); onDoi?.();
    if (loiTep.length) setLoi(loiTep.join(" · "));
  };

  const xoa = async (a) => {
    if (!window.confirm(`Gỡ đính kèm “${a.title}”?`)) return;
    try { await api.del(`/api/admin/tech-tasks/attachments/${a.id}`); onDoi?.(); } catch (e) { setLoi(e.message); }
  };

  const hang = (a, key, nutXoa) => (
    <div key={key} className="flex items-center gap-2" style={{ padding: "6px 0", borderBottom: "1px solid #F1EEEF", fontSize: 13 }}>
      {a.kind === "link" ? <Link2 size={14} color="#0E6CD6" /> : <FileText size={14} color={RED} />}
      {a.kind === "link" ? (
        <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "#0E6CD6", wordBreak: "break-all" }}>{a.title}</a>
      ) : a.id ? (
        <button type="button" className="btn btn-sm" style={{ border: "none", padding: 0, fontWeight: 600, color: "#0E6CD6" }}
          onClick={() => taiDinhKem(a).catch((e) => setLoi(e.message))}>{a.title}</button>
      ) : <span>{a.title}</span>}
      {a.size_kb != null && a.kind === "file" && <span className="muted" style={{ fontSize: 11.5 }}>{a.size_kb} KB</span>}
      {a.uploaded_by && <span className="muted" style={{ fontSize: 11.5 }}>· {a.uploaded_by}</span>}
      {!a.id && <span className="tag tag-amber" style={{ fontSize: 11 }}>chờ lưu</span>}
      <span style={{ flex: 1 }} />
      {nutXoa && <button type="button" className="btn btn-sm" onClick={nutXoa} title="Gỡ"><Trash2 size={12} /></button>}
    </div>
  );

  return (
    <div>
      {items.map((a) => hang(a, a.id, duocXoa(a) ? () => xoa(a) : null))}
      {choGui.map((a, i) => hang(a, `cho-${i}`, () => setChoGui(choGui.filter((_, j) => j !== i))))}
      {!items.length && !choGui.length && <p className="muted" style={{ fontSize: 12.5 }}>Chưa có đính kèm.</p>}
      {duocThem && (
        <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
          <input className="inp" style={{ flex: "1 1 160px" }} placeholder="Tên link (vd: Sheet số liệu SRT5G)"
            value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
          <input className="inp" style={{ flex: "2 1 220px" }} placeholder="Dán link số liệu (https://…)"
            value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themLink(); } }} />
          <button type="button" className="btn btn-sm" onClick={themLink}><Link2 size={13} />Thêm link</button>
          <button type="button" className="btn btn-sm" onClick={() => chonTep.current?.click()} disabled={!!dangGui}>
            <Upload size={13} />{dangGui ? `Đang gửi ${dangGui}…` : "Đính kèm tệp"}
          </button>
          <input ref={chonTep} type="file" multiple hidden
            onChange={(e) => { themTep(e.target.files); e.target.value = ""; }} />
        </div>
      )}
      {duocThem && <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>Tệp tối đa 15 MB (PDF, Excel, Word, ảnh, ZIP…). Tệp lớn hơn hãy đưa lên Drive rồi thêm link.</p>}
      {loi && <p style={{ color: RED, fontSize: 12.5, marginTop: 4 }}>{loi}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- chi tiết */

function ChiTietViec({ task, onDong, onSua, onXoa, onDoi, onMoTienDo, duocSua, duocXoa }) {
  const toi = (getUser()?.full_name || "").trim().toLowerCase();
  const duocBaoCao = duocSua || task.cua_toi;
  const [bc, setBc] = useState({ status: task.status, note: task.note || "" });
  const [loi, setLoi] = useState("");
  const [daLuu, setDaLuu] = useState(false);
  useEffect(() => { setBc({ status: task.status, note: task.note || "" }); setDaLuu(false); }, [task.id, task.status, task.note]);

  const guiBaoCao = async () => {
    try {
      await api.post(`/api/admin/tech-tasks/${task.id}/report`, bc);
      setLoi(""); setDaLuu(true); onDoi();
    } catch (e) { setLoi(e.message); }
  };

  const dong = (nhan, giaTri) => (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, padding: "5px 0", fontSize: 13.5 }}>
      <span className="muted">{nhan}</span><span>{giaTri || "—"}</span>
    </div>
  );
  const p = task.progress;

  return (
    <Card title={task.title}
      action={(
        <div className="flex gap-2">
          {duocSua && <button className="btn btn-sm" onClick={onSua}><Pencil size={13} />Sửa</button>}
          {duocXoa && <button className="btn btn-sm" onClick={onXoa}><Trash2 size={13} />Xóa</button>}
          <button className="btn btn-sm" onClick={onDong}><X size={13} />Đóng</button>
        </div>
      )}>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          {dong("Đầu việc", task.category_label)}
          {dong("Trạng thái", <StatusTag task={task} />)}
          {dong("Hạn xử lý", fmtDay(task.due_at))}
          {dong("Mục tiêu / chỉ tiêu", task.target)}
          {dong("Mô tả", task.description && <span style={{ whiteSpace: "pre-wrap" }}>{task.description}</span>)}
          {dong("Link công cụ", task.link_url && <a href={task.link_url} target="_blank" rel="noreferrer" style={{ color: "#0E6CD6", wordBreak: "break-all" }}>{task.link_url}</a>)}
        </div>
        <div>
          {dong(<span className="flex items-center gap-1"><User size={13} />Phụ trách (làm)</span>, task.assignee && <b>{task.assignee}</b>)}
          {dong(<span className="flex items-center gap-1"><Users size={13} />Phối hợp</span>, task.coordinators?.length ? task.coordinators.join(", ") : "")}
          {dong("Người báo cáo", task.reporter || (task.assignee ? `${task.assignee} (phụ trách)` : ""))}
          {dong("Hạng mục tiến độ", task.progress_item ? (
            <span>
              <button type="button" className="btn btn-sm" style={{ border: "none", padding: 0, fontWeight: 700, color: "#0E6CD6" }}
                onClick={() => onMoTienDo(task)} title="Mở hạng mục này bên tab Tiến độ">{task.progress_item_label} ↗</button>
              {p ? <span className="muted"> — kỳ {p.period}: {soGon(p.done)}/{soGon(p.plan)} ({pct(p.rate)})</span>
                : <span className="muted"> — chưa có số liệu</span>}
            </span>
          ) : "")}
          {dong("Cập nhật lần cuối", task.updated_at ? new Date(task.updated_at).toLocaleString("vi-VN") : "")}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="eyebrow-grey flex items-center gap-1" style={{ marginBottom: 6 }}><Paperclip size={13} />Đính kèm ({task.attachments?.length || 0})</p>
        <KhungDinhKem taskId={task.id} items={task.attachments || []} duocThem={duocBaoCao}
          duocXoa={(a) => duocSua || (task.cua_toi && (a.uploaded_by || "").trim().toLowerCase() === toi)}
          onDoi={onDoi} choGui={[]} setChoGui={() => {}} />
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="eyebrow-grey" style={{ marginBottom: 6 }}>Báo cáo tiến độ</p>
        {duocBaoCao ? (
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Trạng thái">
              <select className="inp" value={bc.status} onChange={(e) => setBc({ ...bc, status: e.target.value })}>
                {Object.entries(STATUS_LABELS).filter(([k]) => k !== "overdue").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="md:col-span-3">
              <Field label="Ghi chú tiến độ">
                <textarea className="inp" rows="2" value={bc.note} onChange={(e) => setBc({ ...bc, note: e.target.value })}
                  placeholder="Đã làm được gì, vướng mắc, cần hỗ trợ…" />
              </Field>
            </div>
            <div className="md:col-span-4 flex items-center gap-2">
              <button className="btn btn-red btn-sm" onClick={guiBaoCao}>Cập nhật tiến độ</button>
              {daLuu && <span className="tag tag-green">Đã lưu</span>}
              {!duocSua && <span className="muted" style={{ fontSize: 12 }}>Bạn được gắn tên trong việc này nên cập nhật được tiến độ và đính kèm.</span>}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{task.note || <span className="muted">Chưa có ghi chú tiến độ.</span>}</p>
        )}
        {loi && <p style={{ color: RED, fontSize: 12.5 }}>{loi}</p>}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- đầu việc */

/** Sửa tên/gợi ý, xoá đầu việc (thẻ ở đầu trang). Xoá chỉ được khi đầu việc chưa dùng. */
function QuanLyDauViec({ categories, onDoi, onDong }) {
  const [sua, setSua] = useState(null);
  const [moi, setMoi] = useState("");
  const [loi, setLoi] = useState("");
  const duocThem = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  const lam = async (viec) => { try { await viec(); setLoi(""); onDoi(); } catch (e) { setLoi(e.message); } };
  const luu = () => lam(async () => {
    await api.put(`/api/admin/tech-tasks/categories/${sua.id}`, { label: sua.label, hint: sua.hint });
    setSua(null);
  });
  const xoa = (c) => window.confirm(`Xóa đầu việc “${c.label}”?`)
    && lam(() => api.del(`/api/admin/tech-tasks/categories/${c.id}`));
  const them = () => moi.trim() && lam(async () => { await api.post("/api/admin/tech-tasks/categories", { label: moi.trim() }); setMoi(""); });

  return (
    <Card title="Quản lý đầu việc" action={<button className="btn btn-sm" onClick={onDong}><X size={13} />Đóng</button>}>
      <table className="tbl">
        <thead><tr><th>Tên đầu việc</th><th>Gợi ý phạm vi (hiện trên form giao việc)</th><th></th></tr></thead>
        <tbody>
          {categories.map((c) => (sua?.id === c.id ? (
            <tr key={c.id}>
              <td><input className="inp" value={sua.label} onChange={(e) => setSua({ ...sua, label: e.target.value })} /></td>
              <td><textarea className="inp" rows="2" value={sua.hint} onChange={(e) => setSua({ ...sua, hint: e.target.value })} /></td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-red btn-sm" onClick={luu}>Lưu</button>{" "}
                <button className="btn btn-sm" onClick={() => setSua(null)}>Hủy</button>
              </td>
            </tr>
          ) : (
            <tr key={c.id}>
              <td><b>{c.label}</b></td>
              <td className="muted" style={{ fontSize: 12.5 }}>{c.hint || "—"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {duocSua && <button className="btn btn-sm" onClick={() => setSua({ ...c, hint: c.hint || "" })}><Pencil size={13} /></button>}{" "}
                {duocXoa && <button className="btn btn-sm" onClick={() => xoa(c)}><Trash2 size={13} /></button>}
              </td>
            </tr>
          )))}
        </tbody>
      </table>
      {duocThem && (
        <div className="flex gap-2" style={{ marginTop: 10 }}>
          <input className="inp" style={{ maxWidth: 360 }} placeholder="Tên đầu việc mới, vd: 11. An toàn thông tin"
            value={moi} onChange={(e) => setMoi(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); them(); } }} />
          <button className="btn btn-red btn-sm" onClick={them}><Plus size={13} />Thêm đầu việc</button>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Đầu việc còn công việc (kể cả việc đang ở Thùng rác), hạng mục hoặc dòng tiến độ thì không xóa được — chuyển hoặc xóa các mục đó trước.
      </p>
      {loi && <p style={{ color: RED, fontSize: 12.5 }}>{loi}</p>}
    </Card>
  );
}

/* ---------------------------------------------------------------- danh sách */

export function TaskListTab({ locDauViec, onMoTienDo }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [form, setForm] = useState(null);
  const [choGui, setChoGui] = useState([]);       // đính kèm gom tạm khi giao việc mới
  const [dangLuu, setDangLuu] = useState(false);
  const [err, setErr] = useState("");
  const [fCategory, setFCategory] = useState(locDauViec || "");
  const [fStatus, setFStatus] = useState("");
  const [cuaToi, setCuaToi] = useState(false);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [hangMuc, setHangMuc] = useState([]);     // [{category, items:[{id,label}]}]
  const [moId, setMoId] = useState(null);         // việc đang xem chi tiết
  const [qlDauViec, setQlDauViec] = useState(false);
  const [newCat, setNewCat] = useState(null);

  const duocGiao = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  useEffect(() => { if (locDauViec !== undefined) setFCategory(locDauViec || ""); }, [locDauViec]);

  const catLabels = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);
  const catHint = useMemo(() => categories.find((c) => c.id === form?.category)?.hint || "", [categories, form?.category]);
  const hangMucCuaDauViec = useMemo(
    () => hangMuc.find((g) => g.category === form?.category)?.items || [], [hangMuc, form?.category]);

  const loadCategories = () => api.get("/api/admin/tech-tasks/categories")
    .then((x) => setCategories(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  const load = () => {
    const params = new URLSearchParams();
    if (fCategory) params.set("category", fCategory);
    if (fStatus) params.set("status", fStatus);
    if (cuaToi) params.set("mine", "true");
    const qs = params.toString();
    return api.get(`/api/admin/tech-tasks${qs ? `?${qs}` : ""}`)
      .then((x) => setRows(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };
  const loadSummary = () => api.get("/api/admin/tech-tasks/summary")
    .then((x) => setSummary(Array.isArray(x) ? x : [])).catch(() => {});
  const taiLai = () => { load(); loadSummary(); };

  useEffect(() => { load(); }, [fCategory, fStatus, cuaToi]);
  useEffect(() => {
    loadCategories(); loadSummary();
    api.get("/api/admin/tech-tasks/assignees").then((x) => setAssignees(Array.isArray(x) ? x : [])).catch(() => {});
    api.get("/api/admin/progress/items").then((x) => setHangMuc(Array.isArray(x) ? x : [])).catch(() => {});
  }, []);

  const themDauViec = async () => {
    const label = (newCat || "").trim();
    if (!label) { setNewCat(null); return; }
    try {
      const c = await api.post("/api/admin/tech-tasks/categories", { label });
      await loadCategories();
      setForm((f) => (f ? { ...f, category: c.id, progress_item: "" } : f));
      setNewCat(null); setErr("");
    } catch (e) { setErr(e.message); }
  };

  const moForm = (f) => { setForm(f); setChoGui([]); setErr(""); };

  const save = async () => {
    try {
      if (!form.category) throw new Error("Chưa chọn đầu việc.");
      if (!form.title.trim()) throw new Error("Chưa nhập nội dung công việc.");
      if (form.link_url && !coLinkThat(form.link_url)) throw new Error("Link công cụ cần bắt đầu bằng http:// hoặc https://");
      setDangLuu(true);
      const payload = {
        category: form.category, title: form.title, description: form.description || "",
        assignee: form.assignee || "", coordinators: form.coordinators || [], reporter: form.reporter || "",
        target: form.target || "", due_at: form.due_at || null, status: form.status,
        link_url: form.link_url || "", progress_item: form.progress_item || "", note: form.note || "",
      };
      const v = form.id
        ? await api.put(`/api/admin/tech-tasks/${form.id}`, payload)
        : await api.post("/api/admin/tech-tasks", payload);
      // Đính kèm gom lúc giao việc mới: việc đã có mã rồi mới gửi lên được.
      const loi = [];
      for (const a of choGui) {
        try {
          if (a.kind === "link") await api.post(`/api/admin/tech-tasks/${v.id}/attachments/link`, { title: a.title, url: a.url });
          else await api.uploadTo(`/api/admin/tech-tasks/${v.id}/attachments/file`, a.file);
        } catch (e) { loi.push(e.message); }
      }
      setForm(null); setChoGui([]); setMoId(v.id);
      setErr(loi.length ? `Đã lưu việc, nhưng ${loi.length} đính kèm lỗi: ${loi.join(" · ")}` : "");
      taiLai();
    } catch (e) { setErr(e.message); }
    setDangLuu(false);
  };

  const del = async (x) => {
    if (!window.confirm(`Xóa công việc “${x.title}”?\n\nViệc (cùng đính kèm) chuyển vào Thùng rác, quản trị viên khôi phục được trong 30 ngày.`)) return;
    try { await api.del(`/api/admin/tech-tasks/${x.id}`); if (moId === x.id) setMoId(null); taiLai(); } catch (e) { setErr(e.message); }
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
    return rows.filter((x) => [x.title, x.assignee, x.reporter, ...(x.coordinators || []), x.target, x.description, x.note]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [rows, search]);

  const dangMo = rows.find((x) => x.id === moId);
  const suaViec = (x) => { setMoId(null); moForm({ ...x, due_at: day(x.due_at), coordinators: x.coordinators || [], progress_item: x.progress_item || "" }); };

  const field = (label, key, kind = "text", extra = {}) => (
    <Field label={label}>
      <input className="inp" type={kind} value={form?.[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...extra} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex justify-between items-center" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <b>Công việc mảng kỹ thuật</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>Giao và theo dõi tiến độ {categories.length} đầu việc — bấm một việc để xem chi tiết, đính kèm và báo cáo.</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={() => { taiLai(); loadCategories(); }}><RefreshCw size={14} />Tải lại</button>
          {(duocSua || duocXoa) && <button className="btn btn-sm" onClick={() => setQlDauViec((v) => !v)}><Pencil size={14} />Đầu việc</button>}
          {laNguoiQuanLy("tech_tasks") && <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>}
          {duocGiao && <button className="btn btn-red btn-sm" onClick={() => { setMoId(null); moForm(blankTask(categories, fCategory)); }}><Plus size={14} />Giao việc mới</button>}
        </div>
      </div>

      {qlDauViec && <QuanLyDauViec categories={categories} onDong={() => setQlDauViec(false)}
        onDoi={() => { loadCategories(); loadSummary(); }} />}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {categories.map((c) => {
          const s = summary.find((x) => x.category === c.id) || { total: 0, overdue: 0, done: 0 };
          const on = fCategory === c.id;
          return (
            <button key={c.id} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 12, border: on ? `1.5px solid ${RED}` : undefined }}
              onClick={() => setFCategory(on ? "" : c.id)}>
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.3, minHeight: 30 }}>{c.label}</p>
              <div className="flex items-center gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: RED }}>{s.total}</span>
                {!!s.done && <span className="tag tag-green">{s.done} xong</span>}
                {!!s.overdue && <span className="tag tag-red">{s.overdue} quá hạn</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <input className="inp" style={{ maxWidth: 280 }} placeholder="🔎 Tìm theo nội dung / người làm / phối hợp…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="inp" style={{ maxWidth: 240 }} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
          <option value="">Mọi đầu việc</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="inp" style={{ maxWidth: 180 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className={`btn btn-sm ${cuaToi ? "btn-red" : ""}`} onClick={() => setCuaToi((v) => !v)}
          title="Việc tôi phụ trách, phối hợp hoặc báo cáo"><User size={14} />Việc của tôi</button>
      </div>

      {err && <p style={{ color: RED }}>{err}</p>}

      {form && (
        <Card title={form.id ? "Cập nhật công việc" : "Giao việc mới"}>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Đầu việc">
              {newCat === null ? (
                <div className="flex gap-2">
                  <select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, progress_item: "" })}>
                    {!form.category && <option value="">— Chọn đầu việc —</option>}
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  {duocGiao && <button type="button" className="btn btn-sm" title="Thêm đầu việc mới" onClick={() => setNewCat("")}><Plus size={14} /></button>}
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

          <p className="eyebrow-grey" style={{ margin: "12px 0 6px" }}>Nhân sự</p>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Phụ trách chính (người làm)">
              <input className="inp" list="ds-phu-trach" placeholder="Chọn hoặc gõ tên…"
                value={form.assignee || ""} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
              <DanhSachNguoi id="ds-phu-trach" assignees={assignees} />
            </Field>
            <Field label="Phối hợp">
              <NhieuNguoi value={form.coordinators || []} listId="ds-phoi-hop" assignees={assignees}
                onChange={(v) => setForm({ ...form, coordinators: v })} />
            </Field>
            <Field label="Người báo cáo (trống = người phụ trách)">
              <input className="inp" list="ds-bao-cao" placeholder="Chọn hoặc gõ tên…"
                value={form.reporter || ""} onChange={(e) => setForm({ ...form, reporter: e.target.value })} />
              <DanhSachNguoi id="ds-bao-cao" assignees={assignees} />
            </Field>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
            Người được gắn tên ở đây (đúng họ tên tài khoản đăng nhập) tự cập nhật tiến độ và đính kèm cho việc này, và thấy việc ở mục “Việc của tôi”.
          </p>

          <p className="eyebrow-grey" style={{ margin: "12px 0 6px" }}>Mục tiêu & liên kết</p>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Mục tiêu / chỉ tiêu", "target")}
            {field("Hạn xử lý", "due_at", "date")}
            <Field label="Hạng mục tiến độ liên kết (tab Tiến độ)">
              <select className="inp" value={form.progress_item || ""} onChange={(e) => setForm({ ...form, progress_item: e.target.value })}
                disabled={!hangMucCuaDauViec.length}>
                <option value="">{hangMucCuaDauViec.length ? "— Không liên kết —" : "Đầu việc này chưa có hạng mục định lượng"}</option>
                {hangMucCuaDauViec.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
              </select>
            </Field>
            {field("Link công cụ liên quan (nếu có)", "link_url", "url", { placeholder: "https://…" })}
          </div>
          <Field label="Ghi chú tiến độ"><textarea className="inp" rows="2" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>

          <p className="eyebrow-grey flex items-center gap-1" style={{ margin: "12px 0 6px" }}><Paperclip size={13} />Đính kèm</p>
          <KhungDinhKem taskId={form.id} items={form.id ? (rows.find((x) => x.id === form.id)?.attachments || []) : []}
            duocThem duocXoa={() => duocSua} onDoi={load} choGui={choGui} setChoGui={setChoGui} />

          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => { setForm(null); setChoGui([]); }}>Hủy</button>
            <button className="btn btn-red" onClick={save} disabled={dangLuu}>{dangLuu ? "Đang lưu…" : "Lưu"}</button>
          </div>
        </Card>
      )}

      {dangMo && !form && (
        <ChiTietViec task={dangMo} duocSua={duocSua} duocXoa={duocXoa}
          onDong={() => setMoId(null)} onSua={() => suaViec(dangMo)} onXoa={() => del(dangMo)}
          onDoi={taiLai} onMoTienDo={onMoTienDo} />
      )}

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Đầu việc</th><th>Nội dung</th><th>Nhân sự</th><th>Mục tiêu</th><th>Hạn xử lý</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {filteredRows.map((x) => (
                <tr key={x.id} onClick={() => { setForm(null); setMoId(x.id === moId ? null : x.id); }}
                  style={{ cursor: "pointer", background: x.id === moId ? "#FBF4F5" : undefined }}>
                  <td className="muted" style={{ fontSize: 12.5 }}>{catLabels[x.category] || x.category_label || x.category}</td>
                  <td>
                    <b>{x.title}</b>
                    {x.link_url && <a href={x.link_url} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }} onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /></a>}
                    <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginTop: 3 }}>
                      {!!x.attachments?.length && <span className="tag tag-grey" style={{ fontSize: 11 }}><Paperclip size={10} /> {x.attachments.length}</span>}
                      {x.progress_item && (
                        <span className="tag tag-grey" style={{ fontSize: 11 }} title={`Hạng mục ${x.progress_item_label} bên tab Tiến độ`}>
                          {x.progress_item_label}{x.progress ? `: ${soGon(x.progress.done)}/${soGon(x.progress.plan)} (${pct(x.progress.rate)})` : ""}
                        </span>
                      )}
                      {x.cua_toi && <span className="tag tag-amber" style={{ fontSize: 11 }}>Việc của tôi</span>}
                    </div>
                    {x.note && <span className="muted" style={{ fontSize: 12.5 }}>{x.note}</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {x.assignee ? <b>{x.assignee}</b> : "—"}
                    {!!x.coordinators?.length && <><br /><span className="muted">Phối hợp: {x.coordinators.join(", ")}</span></>}
                    {x.reporter && <><br /><span className="muted">Báo cáo: {x.reporter}</span></>}
                  </td>
                  <td>{x.target || "—"}</td>
                  <td>{fmtDay(x.due_at)}</td>
                  <td><StatusTag task={x} /></td>
                  <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    {duocSua && <button className="btn btn-sm" onClick={() => suaViec(x)} title="Sửa"><Pencil size={13} /></button>}{" "}
                    {duocXoa && <button className="btn btn-sm" onClick={() => del(x)} title="Xóa (vào Thùng rác)"><Trash2 size={13} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && (
            <Empty title={cuaToi ? "Bạn chưa được gắn tên trong việc nào." : "Chưa có công việc."}
              hint={rows.length ? "Không có dòng nào khớp bộ lọc." : duocGiao ? "Bấm “Giao việc mới” để bắt đầu." : ""} />
          )}
        </div>
      </Card>
    </div>
  );
}
