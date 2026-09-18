import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, ExternalLink, FileText, Link2, Paperclip, Pencil, Plus, RefreshCw, Trash2, Upload, User, Users, X,
} from "lucide-react";
import { api, coQuyen, getUser, laNguoiQuanLy } from "./api";
import { Card, Empty, Field, RED, ThaoTac } from "./ui";

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

export const UU_TIEN = { cao: "Cao", trung_binh: "Trung bình", thap: "Thấp" };
const UU_TIEN_MAU = { cao: "#C8102E", trung_binh: "#0E6CD6", thap: "#16A34A" };
const PHAM_VI = { ca_nhan: "Cá nhân được giao", nhieu_don_vi: "Có đơn vị khác cùng làm" };

/** Thanh tiến độ nhỏ trong bảng và khung chi tiết. */
export function TienDoNho({ percent, rong = 90 }) {
  const p = Math.max(0, Math.min(percent || 0, 100));
  const mau = p >= 100 ? "#16A34A" : p >= 50 ? "#0E6CD6" : p > 0 ? "#F2A007" : "#C9D6E8";
  return (
    <span className="flex items-center gap-2" style={{ whiteSpace: "nowrap" }}>
      <span style={{ width: rong, height: 7, background: "#EAF1FB", borderRadius: 99, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: `${p}%`, height: "100%", background: mau, borderRadius: 99 }} />
      </span>
      <b style={{ fontSize: 12 }}>{p}%</b>
    </span>
  );
}

export function TheUuTien({ muc }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color: UU_TIEN_MAU[muc] || UU_TIEN_MAU.trung_binh }}>
      ● {UU_TIEN[muc] || UU_TIEN.trung_binh}
    </span>
  );
}

const blankTask = (categories, fCategory) => ({
  category: fCategory || categories?.[0]?.id || "", title: "", description: "", assignee: "",
  coordinators: [], reporter: "", target: "", start_at: "", due_at: "", status: "todo",
  priority: "trung_binh", volume_unit: "", volume_plan: "", volume_done: "", percent: "",
  scope: "ca_nhan", units: [], link_url: "", progress_item: "", note: "",
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

/** Bảng chia việc cho đơn vị khác: mỗi dòng một đơn vị, có khối lượng riêng. */
export function BangDonVi({ units, onChange, donViTinh, chiSuaKhoiLuong = false, assignees = [] }) {
  const doi = (i, k, v) => onChange(units.map((u, j) => (j === i ? { ...u, [k]: v } : u)));
  const them = () => onChange([...units, { unit_name: "", assignee: "", volume_plan: "", volume_done: "", note: "" }]);
  const xoa = (i) => onChange(units.filter((_, j) => j !== i));
  const tong = units.reduce((a, u) => ({ plan: a.plan + (Number(u.volume_plan) || 0), done: a.done + (Number(u.volume_done) || 0) }), { plan: 0, done: 0 });
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Đơn vị</th><th>Người phụ trách</th><th>Khối lượng giao</th><th>Đã làm</th><th>Tiến độ</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {units.map((u, i) => {
              const kh = Number(u.volume_plan) || 0;
              const th = Number(u.volume_done) || 0;
              return (
                <tr key={i}>
                  <td>
                    <input className="inp" style={{ minWidth: 110 }} value={u.unit_name || ""} disabled={chiSuaKhoiLuong}
                      placeholder="Mã/tên đơn vị" onChange={(e) => doi(i, "unit_name", e.target.value)} />
                  </td>
                  <td>
                    <input className="inp" style={{ minWidth: 130 }} list="ds-phu-trach" value={u.assignee || ""} disabled={chiSuaKhoiLuong}
                      onChange={(e) => doi(i, "assignee", e.target.value)} />
                  </td>
                  <td><input className="inp" type="number" style={{ width: 96 }} value={u.volume_plan ?? ""} disabled={chiSuaKhoiLuong}
                    onChange={(e) => doi(i, "volume_plan", e.target.value)} /></td>
                  <td><input className="inp" type="number" style={{ width: 96 }} value={u.volume_done ?? ""}
                    onChange={(e) => doi(i, "volume_done", e.target.value)} /></td>
                  <td><TienDoNho percent={kh > 0 ? Math.round(Math.min(th / kh, 1) * 1000) / 10 : 0} rong={70} /></td>
                  <td><input className="inp" style={{ minWidth: 120 }} value={u.note || ""} onChange={(e) => doi(i, "note", e.target.value)} /></td>
                  <td>{!chiSuaKhoiLuong && <button type="button" className="btn btn-sm" title="Bỏ đơn vị" onClick={() => xoa(i)}><Trash2 size={12} /></button>}</td>
                </tr>
              );
            })}
            {!!units.length && (
              <tr style={{ fontWeight: 800 }}>
                <td colSpan={2}>Tổng cộng</td>
                <td>{tong.plan}{donViTinh ? ` ${donViTinh}` : ""}</td>
                <td>{tong.done}</td>
                <td><TienDoNho percent={tong.plan > 0 ? Math.round(Math.min(tong.done / tong.plan, 1) * 1000) / 10 : 0} rong={70} /></td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!units.length && <p className="muted" style={{ fontSize: 12.5 }}>Chưa chia cho đơn vị nào.</p>}
      {!chiSuaKhoiLuong && (
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={them}><Plus size={13} />Thêm đơn vị</button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- chi tiết */

function ChiTietViec({ task, onDong, onSua, onXoa, onDoi, onMoTienDo, duocSua, duocXoa }) {
  const toi = (getUser()?.full_name || "").trim().toLowerCase();
  const duocBaoCao = duocSua || task.cua_toi;
  const [bc, setBc] = useState({
    status: task.status, note: task.note || "", percent: task.percent ?? "",
    volume_done: task.volume_done ?? "", units: (task.units || []).map((u) => ({ ...u })),
  });
  const [loi, setLoi] = useState("");
  const [daLuu, setDaLuu] = useState(false);
  useEffect(() => {
    setBc({
      status: task.status, note: task.note || "", percent: task.percent ?? "",
      volume_done: task.volume_done ?? "", units: (task.units || []).map((u) => ({ ...u })),
    });
    setDaLuu(false);
  }, [task.id, task.status, task.note, task.percent, task.volume_done, task.updated_at]);

  const guiBaoCao = async () => {
    try {
      const so = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
      await api.post(`/api/admin/tech-tasks/${task.id}/report`, {
        status: bc.status, note: bc.note,
        percent: task.scope === "nhieu_don_vi" || Number(task.volume_plan) > 0 ? undefined : so(bc.percent),
        volume_done: task.scope === "nhieu_don_vi" ? undefined : so(bc.volume_done),
        units: task.scope === "nhieu_don_vi"
          ? (bc.units || []).map((u) => ({ unit_name: u.unit_name, assignee: u.assignee || "",
              volume_plan: Number(u.volume_plan) || 0, volume_done: Number(u.volume_done) || 0, note: u.note || "" }))
          : undefined,
      });
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
          {dong("Mức ưu tiên", <TheUuTien muc={task.priority} />)}
          {dong("Thời gian", `${task.start_at ? fmtDay(task.start_at) : "—"} → ${fmtDay(task.due_at)}`)}
          {dong("Tiến độ", <TienDoNho percent={task.percent} />)}
          {dong("Khối lượng", task.scope === "nhieu_don_vi"
            ? `${task.units?.length || 0} đơn vị cùng làm`
            : (task.volume_plan ? `${soGon(task.volume_done)} / ${soGon(task.volume_plan)} ${task.volume_unit || ""}`.trim() : ""))}
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
            {task.scope !== "nhieu_don_vi" && Number(task.volume_plan) > 0 && (
              <Field label={`Khối lượng đã làm (trên ${soGon(task.volume_plan)} ${task.volume_unit || ""})`.trim()}>
                <input className="inp" type="number" value={bc.volume_done}
                  onChange={(e) => setBc({ ...bc, volume_done: e.target.value })} />
              </Field>
            )}
            {task.scope !== "nhieu_don_vi" && !Number(task.volume_plan) && (
              <Field label="Tiến độ (%)">
                <input className="inp" type="number" min="0" max="100" value={bc.percent}
                  onChange={(e) => setBc({ ...bc, percent: e.target.value })} />
              </Field>
            )}
            {task.scope === "nhieu_don_vi" && (
              <div className="md:col-span-4">
                <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Khối lượng đã làm của từng đơn vị:</p>
                <BangDonVi units={bc.units} onChange={(u) => setBc({ ...bc, units: u })}
                  donViTinh={task.volume_unit} chiSuaKhoiLuong />
              </div>
            )}
            <div className="md:col-span-4 flex items-center gap-2">
              <button className="btn btn-red btn-sm" onClick={guiBaoCao}>Cập nhật tiến độ</button>
              {daLuu && <span className="tag tag-green">Đã lưu</span>}
              {!duocSua && <span className="muted" style={{ fontSize: 12 }}>Bạn được gắn tên trong việc này nên cập nhật được tiến độ và đính kèm.</span>}
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, whiteSpace: "pre-wrap" }}>{task.note || <span className="muted">Chưa có ghi chú tiến độ.</span>}</p>
            {task.scope === "nhieu_don_vi" && !!task.units?.length && (
              <div style={{ marginTop: 8 }}>
                {task.units.map((u) => (
                  <div key={u.id} className="flex items-center gap-2" style={{ fontSize: 13, padding: "3px 0", flexWrap: "wrap" }}>
                    <b style={{ minWidth: 90 }}>{u.unit_name}</b>
                    <span className="muted">{u.assignee || "chưa giao"}</span>
                    <span>{soGon(u.volume_done)}/{soGon(u.volume_plan)}</span>
                    <TienDoNho percent={u.percent} rong={70} />
                    {u.note && <span className="muted">· {u.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {loi && <p style={{ color: RED, fontSize: 12.5 }}>{loi}</p>}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- đầu việc */

/** Sửa tên/gợi ý, xoá đầu việc (thẻ ở đầu trang). Xoá chỉ được khi đầu việc chưa dùng. */
/**
 * Cơ cấu đầu việc: nhóm cấp 1 -> đầu việc, tất cả thao tác dựng lại cơ cấu nằm
 * chung một chỗ — thêm hàng loạt, đổi tên, chuyển nhóm, đổi thứ tự, xoá.
 *
 * Xoá đầu việc còn dữ liệu: máy chủ trả 409 kèm số lượng, giao diện hỏi lại và
 * cho chọn chuyển dữ liệu sang đầu việc khác hoặc xoá kèm — trước đây chỉ báo
 * "đang được dùng" rồi chịu, muốn dọn phải đi xoá thủ công từng hạng mục.
 */
function QuanLyDauViec({ onDoi, onDong, suaNgay }) {
  const [dl, setDl] = useState(null);                   // { nhom: [...], tat_ca_dau_viec: [...] }
  const [sua, setSua] = useState(suaNgay ? { id: suaNgay.id, label: suaNgay.label, hint: suaNgay.hint || "" } : null);
  const [themVao, setThemVao] = useState({});           // { [maNhom]: "tên đang gõ" }
  const [hangLoat, setHangLoat] = useState({ mo: false, nhom: "", text: "" });
  const [nhomMoi, setNhomMoi] = useState(null);
  const [xoaHoi, setXoaHoi] = useState(null);           // { cats: [...], cach, dich }
  const [chon, setChon] = useState([]);                // mã đầu việc đang tích
  const [suaNhom, setSuaNhom] = useState(null);        // { id, label } nhóm đang đổi tên
  const [loi, setLoi] = useState("");
  const [tin, setTin] = useState("");
  const duocThem = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  const tai = () => api.get("/api/admin/tech-tasks/structure")
    .then(setDl).catch((e) => setLoi(e.message));
  useEffect(() => { tai(); }, []);

  const lam = async (viec, nhan = "") => {
    try { await viec(); setLoi(""); setTin(nhan); tai(); onDoi?.(); }
    catch (e) { setLoi(e.message); setTin(""); }
  };

  const phang = (dl?.nhom || []).flatMap((g) => g.categories);

  const luuTen = () => lam(async () => {
    await api.put(`/api/admin/tech-tasks/categories/${sua.id}`, { label: sua.label, hint: sua.hint });
    setSua(null);
  }, "Đã lưu tên đầu việc.");

  const themDauViec = (maNhom) => {
    const label = (themVao[maNhom] || "").trim();
    if (!label) return;
    lam(async () => {
      const c = await api.post("/api/admin/tech-tasks/categories", { label });
      if (maNhom) await api.put(`/api/admin/tech-tasks/categories/${c.id}`, { group_code: maNhom });
      setThemVao({ ...themVao, [maNhom]: "" });
    }, `Đã thêm đầu việc “${label}”.`);
  };

  const themHangLoat = () => {
    const labels = hangLoat.text.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!labels.length) return;
    lam(async () => {
      const r = await api.post("/api/admin/tech-tasks/categories/nhieu", { labels, group_code: hangLoat.nhom || null });
      setHangLoat({ mo: false, nhom: "", text: "" });
      setTin(`Đã thêm ${r.da_them.length} đầu việc.` + (r.bo_qua_trung_ten.length ? ` Bỏ qua ${r.bo_qua_trung_ten.length} tên đã có.` : ""));
    });
  };

  /** Đổi thứ tự nhóm cấp 1: đảo chỗ với nhóm liền kề rồi ghi lại order_no. */
  const doiThuTuNhom = (g, buoc) => {
    const ds = (dl?.nhom || []).filter((x) => x.id);      // "Chưa xếp nhóm" luôn ở cuối
    const i = ds.findIndex((x) => x.id === g.id);
    const j = i + buoc;
    if (i < 0 || j < 0 || j >= ds.length) return;
    lam(async () => {
      await api.put(`/api/admin/tech-tasks/groups/${ds[i].id}`, { order_no: j });
      await api.put(`/api/admin/tech-tasks/groups/${ds[j].id}`, { order_no: i });
    });
  };

  const luuTenNhom = () => lam(async () => {
    await api.put(`/api/admin/tech-tasks/groups/${suaNhom.id}`, { label: suaNhom.label });
    setSuaNhom(null);
  }, "Đã đổi tên nhóm.");

  const xoaNhom = (g) => {
    if (!window.confirm(`Xóa nhóm “${g.label}”?\n\n${g.categories.length} đầu việc trong nhóm vẫn còn, chỉ quay về mục “Chưa xếp nhóm”.`)) return;
    lam(() => api.del(`/api/admin/tech-tasks/groups/${g.id}`), "Đã xóa nhóm.");
  };

  const doiThuTu = (cat, buoc) => {
    const ds = phang.map((c) => c.id);
    const i = ds.indexOf(cat.id);
    const j = i + buoc;
    if (i < 0 || j < 0 || j >= ds.length) return;
    [ds[i], ds[j]] = [ds[j], ds[i]];
    lam(() => api.post("/api/admin/tech-tasks/categories/sap-xep", { codes: ds }));
  };

  const coDuLieu = (c) => {
    const d = c.dang_dung || {};
    return (d.viec || 0) + (d.viec_thung_rac || 0) + (d.hang_muc || 0) + (d.dong_tien_do || 0);
  };

  const xoa = async (cat) => {
    if (!coDuLieu(cat)) {
      if (window.confirm(`Xóa đầu việc “${cat.label}”?`)) lam(() => api.del(`/api/admin/tech-tasks/categories/${cat.id}`), "Đã xóa đầu việc.");
      return;
    }
    setXoaHoi({ cats: [cat], cach: "chuyen", dich: phang.find((c) => c.id !== cat.id)?.id || "" });
  };

  /** Xóa các đầu việc đang tích. Cái nào trống thì xóa luôn, cái nào còn dữ liệu thì hỏi chung một lần. */
  const xoaDaChon = () => {
    const cats = phang.filter((c) => chon.includes(c.id));
    if (!cats.length) return;
    const conDuLieu = cats.filter(coDuLieu);
    if (!conDuLieu.length) {
      if (!window.confirm(`Xóa ${cats.length} đầu việc đã chọn?`)) return;
      lam(async () => {
        for (const c of cats) await api.del(`/api/admin/tech-tasks/categories/${c.id}`);
        setChon([]); setTin(`Đã xóa ${cats.length} đầu việc.`);
      });
      return;
    }
    setXoaHoi({ cats, cach: "chuyen", dich: phang.find((c) => !chon.includes(c.id))?.id || "" });
  };

  const xacNhanXoa = () => {
    const { cats, cach, dich } = xoaHoi;
    if (cach === "chuyen" && !dich) { setLoi("Chưa chọn đầu việc nhận dữ liệu."); return; }
    if (cach === "chuyen" && cats.some((c) => c.id === dich)) { setLoi("Đầu việc nhận dữ liệu không được nằm trong danh sách xóa."); return; }
    const q = cach === "chuyen" ? `?chuyen_sang=${encodeURIComponent(dich)}` : "?xoa_du_lieu=true";
    const ten = cats.length === 1 ? `“${cats[0].label}”` : `${cats.length} đầu việc`;
    if (cach === "xoa" && !window.confirm(`Xóa ${ten} và toàn bộ dữ liệu bên trong?\n\nKhông khôi phục được.`)) return;
    lam(async () => {
      let chuyen = 0, mat = 0;
      for (const c of cats) {
        const r = await api.del(`/api/admin/tech-tasks/categories/${c.id}${q}`);
        chuyen += r.da_chuyen || 0; mat += r.da_xoa || 0;
      }
      setXoaHoi(null); setChon([]);
      setTin(cach === "chuyen" ? `Đã chuyển ${chuyen} bản ghi và xóa ${ten}.` : `Đã xóa ${ten} cùng ${mat} bản ghi.`);
    });
  };

  const theDuLieu = (d) => {
    const ds = [[d.viec, "việc"], [d.viec_thung_rac, "việc ở thùng rác"], [d.hang_muc, "hạng mục"], [d.dong_tien_do, "dòng tiến độ"]]
      .filter(([n]) => n);
    if (!ds.length) return <span className="muted">trống</span>;
    return ds.map(([n, t]) => <span key={t} className="tag tag-grey" style={{ marginRight: 4 }}>{n} {t}</span>);
  };

  return (
    <Card title="Cơ cấu đầu việc" action={<button className="btn btn-sm" onClick={onDong}><X size={13} />Đóng</button>}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
        Nhóm cấp 1 gom các đầu việc cùng mảng (vd CĐBR). Đổi tên, chuyển nhóm, đổi thứ tự hoặc xóa ngay tại đây;
        xóa đầu việc còn dữ liệu thì chọn chuyển dữ liệu sang đầu việc khác hoặc xóa kèm.
      </p>
      {!dl && <p className="muted">Đang tải…</p>}

      {!!chon.length && (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px", marginBottom: 10,
                                                          background: "#FBF4F5", borderRadius: 10 }}>
          <b style={{ fontSize: 13 }}>Đã chọn {chon.length} đầu việc</b>
          <button className="btn btn-sm" style={{ color: RED }} onClick={xoaDaChon}><Trash2 size={13} />Xóa đã chọn</button>
          <button className="btn btn-sm" onClick={() => setChon([])}>Bỏ chọn</button>
        </div>
      )}

      {(dl?.nhom || []).map((g) => (
        <div key={g.id || "chua"} style={{ marginBottom: 14 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 6, flexWrap: "wrap" }}>
            {g.id && duocSua && (
              <span style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-sm" style={{ padding: "2px 5px" }} title="Đưa nhóm lên trên"
                  onClick={() => doiThuTuNhom(g, -1)}>▲</button>{" "}
                <button className="btn btn-sm" style={{ padding: "2px 5px" }} title="Đưa nhóm xuống dưới"
                  onClick={() => doiThuTuNhom(g, 1)}>▼</button>
              </span>
            )}
            {suaNhom?.id === g.id ? (
              <>
                <input className="inp" style={{ maxWidth: 240 }} autoFocus value={suaNhom.label}
                  onChange={(e) => setSuaNhom({ ...suaNhom, label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); luuTenNhom(); } if (e.key === "Escape") setSuaNhom(null); }} />
                <button className="btn btn-red btn-sm" onClick={luuTenNhom}>Lưu</button>
                <button className="btn btn-sm" onClick={() => setSuaNhom(null)}>Hủy</button>
              </>
            ) : (
              <p className="eyebrow-grey">{g.label}</p>
            )}
            <span className="muted" style={{ fontSize: 12 }}>{g.categories.length} đầu việc</span>
            {g.id && suaNhom?.id !== g.id && (
              <ThaoTac onEdit={duocSua ? () => setSuaNhom({ id: g.id, label: g.label }) : null} suaTitle="Đổi tên nhóm"
                onDelete={duocXoa ? () => xoaNhom(g) : null} xoaTitle="Xóa nhóm (đầu việc vẫn giữ)" />
            )}
            {duocThem && (
              <>
                <input className="inp" style={{ maxWidth: 240 }} placeholder="Thêm đầu việc vào nhóm này…"
                  value={themVao[g.id] || ""} onChange={(e) => setThemVao({ ...themVao, [g.id]: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themDauViec(g.id); } }} />
                <button className="btn btn-sm" onClick={() => themDauViec(g.id)}><Plus size={13} />Thêm</button>
              </>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th style={{ width: 34 }} /><th style={{ width: 54 }}>Thứ tự</th><th>Tên đầu việc</th><th>Gợi ý phạm vi</th><th>Nhóm</th><th>Dữ liệu đang có</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
              <tbody>
                {g.categories.map((c) => (sua?.id === c.id ? (
                  <tr key={c.id}>
                    <td /><td />
                    <td><input className="inp" autoFocus value={sua.label} onChange={(e) => setSua({ ...sua, label: e.target.value })} /></td>
                    <td><textarea className="inp" rows="2" value={sua.hint} onChange={(e) => setSua({ ...sua, hint: e.target.value })} /></td>
                    <td colSpan={2} />
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="btn btn-red btn-sm" onClick={luuTen}>Lưu</button>{" "}
                      <button className="btn btn-sm" onClick={() => setSua(null)}>Hủy</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td>
                      {duocXoa && (
                        <input type="checkbox" checked={chon.includes(c.id)} aria-label={`Chọn ${c.label}`}
                          onChange={() => setChon((ds) => (ds.includes(c.id) ? ds.filter((x) => x !== c.id) : [...ds, c.id]))} />
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {duocSua && (
                        <>
                          <button className="btn btn-sm" style={{ padding: "2px 5px" }} title="Lên" onClick={() => doiThuTu(c, -1)}>▲</button>{" "}
                          <button className="btn btn-sm" style={{ padding: "2px 5px" }} title="Xuống" onClick={() => doiThuTu(c, 1)}>▼</button>
                        </>
                      )}
                    </td>
                    <td><b>{c.label}</b></td>
                    <td className="muted" style={{ fontSize: 12.5, maxWidth: 320 }}>{c.hint || "—"}</td>
                    <td>
                      {duocSua ? (
                        <select className="inp" style={{ minWidth: 150, fontSize: 12.5 }} value={g.id}
                          onChange={(e) => lam(() => api.put(`/api/admin/tech-tasks/categories/${c.id}`, { group_code: e.target.value }), "Đã chuyển nhóm.")}>
                          <option value="">— Chưa xếp nhóm —</option>
                          {(dl?.nhom || []).filter((x) => x.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                      ) : g.label}
                    </td>
                    <td style={{ fontSize: 12 }}>{theDuLieu(c.dang_dung || {})}</td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <ThaoTac onEdit={duocSua ? () => setSua({ id: c.id, label: c.label, hint: c.hint || "" }) : null}
                        suaTitle="Đổi tên / gợi ý" onDelete={duocXoa ? () => xoa(c) : null} xoaTitle="Xóa đầu việc" />
                    </td>
                  </tr>
                )))}
                {!g.categories.length && (
                  <tr><td colSpan={7} className="muted" style={{ fontSize: 12.5 }}>Nhóm này chưa có đầu việc nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {xoaHoi && (
        <div className="card" style={{ padding: 12, marginBottom: 12, borderLeft: `4px solid ${RED}` }}>
          <b>Xóa {xoaHoi.cats.length === 1 ? `đầu việc “${xoaHoi.cats[0].label}”` : `${xoaHoi.cats.length} đầu việc đã chọn`}</b>
          <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 8px" }}>
            {xoaHoi.cats.length === 1
              ? <>Đang có {theDuLieu(xoaHoi.cats[0].dang_dung || {})}. Chọn cách xử lý số dữ liệu này:</>
              : <>{xoaHoi.cats.filter(coDuLieu).map((c) => c.label).join(", ")} còn dữ liệu bên trong. Chọn cách xử lý:</>}
          </p>
          <label className="flex items-center gap-2" style={{ fontSize: 13.5, marginBottom: 6 }}>
            <input type="radio" checked={xoaHoi.cach === "chuyen"} onChange={() => setXoaHoi({ ...xoaHoi, cach: "chuyen" })} />
            Chuyển sang đầu việc:
            <select className="inp" style={{ maxWidth: 260 }} value={xoaHoi.dich}
              onChange={(e) => setXoaHoi({ ...xoaHoi, cach: "chuyen", dich: e.target.value })}>
              {phang.filter((c) => !xoaHoi.cats.some((x) => x.id === c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2" style={{ fontSize: 13.5 }}>
            <input type="radio" checked={xoaHoi.cach === "xoa"} onChange={() => setXoaHoi({ ...xoaHoi, cach: "xoa" })} />
            Xóa luôn toàn bộ dữ liệu bên trong (không khôi phục được)
          </label>
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <button className="btn btn-red btn-sm" onClick={xacNhanXoa}>
              Xóa {xoaHoi.cats.length > 1 ? `${xoaHoi.cats.length} đầu việc` : "đầu việc"}
            </button>
            <button className="btn btn-sm" onClick={() => setXoaHoi(null)}>Hủy</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginTop: 6 }}>
        {duocThem && (nhomMoi === null ? (
          <button className="btn btn-sm" onClick={() => setNhomMoi("")}><Plus size={13} />Thêm nhóm cấp 1</button>
        ) : (
          <>
            <input className="inp" style={{ maxWidth: 240 }} autoFocus placeholder="Tên nhóm, vd: CĐBR"
              value={nhomMoi} onChange={(e) => setNhomMoi(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lam(async () => { await api.post("/api/admin/tech-tasks/groups", { label: nhomMoi.trim() }); setNhomMoi(null); }, "Đã thêm nhóm."); } }} />
            <button className="btn btn-red btn-sm" onClick={() => lam(async () => { await api.post("/api/admin/tech-tasks/groups", { label: nhomMoi.trim() }); setNhomMoi(null); }, "Đã thêm nhóm.")}>Thêm</button>
            <button className="btn btn-sm" onClick={() => setNhomMoi(null)}>Hủy</button>
          </>
        ))}
        {duocThem && (
          <button className="btn btn-sm" onClick={() => setHangLoat({ ...hangLoat, mo: !hangLoat.mo })}>
            <Plus size={13} />Thêm nhiều đầu việc một lần
          </button>
        )}
      </div>

      {hangLoat.mo && (
        <div className="card" style={{ padding: 12, marginTop: 10 }}>
          <Field label="Mỗi dòng một tên đầu việc">
            <textarea className="inp" rows="6" value={hangLoat.text} placeholder={"Kiểm soát WO\nTriển khai 5G\nCủng cố hạ tầng"}
              onChange={(e) => setHangLoat({ ...hangLoat, text: e.target.value })} />
          </Field>
          <div className="flex items-center gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <Field label="Xếp vào nhóm">
              <select className="inp" style={{ maxWidth: 240 }} value={hangLoat.nhom}
                onChange={(e) => setHangLoat({ ...hangLoat, nhom: e.target.value })}>
                <option value="">— Chưa xếp nhóm —</option>
                {(dl?.nhom || []).filter((x) => x.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
            <button className="btn btn-red btn-sm" onClick={themHangLoat}>Thêm tất cả</button>
            <button className="btn btn-sm" onClick={() => setHangLoat({ mo: false, nhom: "", text: "" })}>Đóng</button>
          </div>
        </div>
      )}

      {tin && <p style={{ color: "#16A34A", fontSize: 12.5, marginTop: 8 }}>{tin}</p>}
      {loi && <p style={{ color: RED, fontSize: 12.5, marginTop: 8 }}>{loi}</p>}
    </Card>
  );
}

/* ---------------------------------------------------------------- danh sách */

const VAI_TRO = { phu_trach: "Phụ trách", phoi_hop: "Phối hợp", bao_cao: "Báo cáo" };
const chuanTen = (t) => (t || "").replace(/\s+/g, " ").trim().toLowerCase();

/** Vai trò của một người (tên đã chuẩn hoá) trong một việc. */
function vaiTroCua(x, ten) {
  const vai = [];
  if (chuanTen(x.assignee) === ten) vai.push("phu_trach");
  if ((x.coordinators || []).some((c) => chuanTen(c) === ten)) vai.push("phoi_hop");
  if (chuanTen(x.reporter) === ten) vai.push("bao_cao");
  return vai;
}

export function TaskListTab({ locDauViec, locNguoi, onMoTienDo }) {
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
  const [qlDauViec, setQlDauViec] = useState(false);   // false | true | đầu việc đang sửa
  const [cheDoSua, setCheDoSua] = useState(false);      // hiện nút sửa/xoá trên thẻ đầu việc
  const [nhomDS, setNhomDS] = useState([]);            // nhóm đầu việc cấp 1 (vd CĐBR)
  const [nhomMoi, setNhomMoi] = useState(null);        // tên nhóm đang thêm, null = không mở ô
  const [dongNhom, setDongNhom] = useState([]);        // mã nhóm đang gập
  const [newCat, setNewCat] = useState(null);

  const duocGiao = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  useEffect(() => { if (locDauViec !== undefined) setFCategory(locDauViec || ""); }, [locDauViec]);
  // Lọc theo người: chọn ở ô "Mọi nhân viên", hoặc được mở từ tab Theo nhân viên.
  const [fNguoi, setFNguoi] = useState(locNguoi?.ten || "");
  const [fVaiTro, setFVaiTro] = useState("");
  useEffect(() => { if (locNguoi) { setFNguoi(locNguoi.ten || ""); setFVaiTro(""); setCuaToi(false); } }, [locNguoi]);

  const catLabels = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);
  const catHint = useMemo(() => categories.find((c) => c.id === form?.category)?.hint || "", [categories, form?.category]);
  const hangMucCuaDauViec = useMemo(
    () => hangMuc.find((g) => g.category === form?.category)?.items || [], [hangMuc, form?.category]);

  const loadGroups = () => api.get("/api/admin/tech-tasks/groups")
    .then((x) => setNhomDS(Array.isArray(x) ? x : [])).catch(() => {});

  /** Thêm nhóm đầu việc cấp 1 (vd CĐBR) — đầu việc xếp vào nhóm ở khung Chỉnh sửa. */
  const themNhom = async () => {
    const label = (nhomMoi || "").trim();
    if (!label) { setNhomMoi(null); return; }
    try {
      await api.post("/api/admin/tech-tasks/groups", { label });
      setNhomMoi(null); setErr(""); loadGroups(); loadCategories();
    } catch (e) { setErr(e.message); }
  };

  const xoaNhom = async (g) => {
    if (!window.confirm(`Xóa nhóm “${g.label}”?\n\nCác đầu việc trong nhóm vẫn còn, chỉ quay về mục “Chưa xếp nhóm”.`)) return;
    try { await api.del(`/api/admin/tech-tasks/groups/${g.id}`); setErr(""); loadGroups(); loadCategories(); }
    catch (e) { setErr(e.message); }
  };

  const doiTenNhom = async (g) => {
    const ten = window.prompt("Tên nhóm đầu việc:", g.label);
    if (!ten || ten.trim() === g.label) return;
    try { await api.put(`/api/admin/tech-tasks/groups/${g.id}`, { label: ten.trim() }); setErr(""); loadGroups(); loadCategories(); }
    catch (e) { setErr(e.message); }
  };

  const xepNhom = async (catId, groupId) => {
    try { await api.put(`/api/admin/tech-tasks/categories/${catId}`, { group_code: groupId }); loadGroups(); loadCategories(); }
    catch (e) { setErr(e.message); }
  };

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
    loadCategories(); loadSummary(); loadGroups();
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
      const nhieuDonVi = form.scope === "nhieu_don_vi";
      const soHoacKhong = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
      if (form.start_at && form.due_at && form.start_at > form.due_at) throw new Error("Ngày bắt đầu sau ngày kết thúc.");
      const payload = {
        category: form.category, title: form.title, description: form.description || "",
        assignee: form.assignee || "", coordinators: form.coordinators || [], reporter: form.reporter || "",
        target: form.target || "", start_at: form.start_at || null, due_at: form.due_at || null,
        status: form.status, priority: form.priority || "trung_binh",
        volume_unit: form.volume_unit || "",
        volume_plan: nhieuDonVi ? 0 : soHoacKhong(form.volume_plan),
        volume_done: nhieuDonVi ? 0 : soHoacKhong(form.volume_done),
        percent: nhieuDonVi ? 0 : soHoacKhong(form.percent),
        scope: form.scope || "ca_nhan",
        units: nhieuDonVi
          ? (form.units || []).filter((u) => (u.unit_name || "").trim()).map((u) => ({
              unit_name: u.unit_name, assignee: u.assignee || "",
              volume_plan: soHoacKhong(u.volume_plan), volume_done: soHoacKhong(u.volume_done),
              percent: soHoacKhong(u.percent), note: u.note || "",
            }))
          : [],
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

  /** Xoá đầu việc ngay từ nút 🗑 trên thẻ. Còn dữ liệu bên trong thì máy chủ
   *  trả về số lượng, hỏi lại rồi xoá kèm; muốn giữ dữ liệu thì chuyển sang
   *  đầu việc khác ở màn hình "Cơ cấu đầu việc". */
  const xoaDauViec = async (c) => {
    if (!window.confirm(`Xóa đầu việc “${c.label}”?`)) return;
    const xong = () => { if (fCategory === c.id) setFCategory(""); setErr(""); loadCategories(); loadSummary(); loadGroups(); };
    try {
      await api.del(`/api/admin/tech-tasks/categories/${c.id}`);
      xong();
    } catch (e) {
      if (!/đang có/i.test(e.message)) { setErr(e.message); return; }
      const dong_y = window.confirm(
        `${e.message}\n\nXóa “${c.label}” cùng toàn bộ dữ liệu bên trong?\n`
        + "Không khôi phục được. Muốn giữ dữ liệu thì bấm Hủy, rồi vào “Cơ cấu đầu việc” để chuyển sang đầu việc khác.");
      if (!dong_y) return;
      try { await api.del(`/api/admin/tech-tasks/categories/${c.id}?xoa_du_lieu=true`); xong(); }
      catch (e2) { setErr(e2.message); }
    }
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

  /** Mọi người đang được gắn tên trong các việc đang tải, kèm số việc — cho ô lọc. */
  const dsNguoi = useMemo(() => {
    const dem = new Map();
    for (const x of rows) {
      const ten = new Map();
      for (const t of [x.assignee, x.reporter, ...(x.coordinators || [])]) {
        if (t && t.trim()) ten.set(chuanTen(t), t.replace(/\s+/g, " ").trim());
      }
      for (const [k, t] of ten) dem.set(k, { name: dem.get(k)?.name || t, n: (dem.get(k)?.n || 0) + 1 });
    }
    return [...dem.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const nguoi = chuanTen(fNguoi);
    return rows.filter((x) => {
      if (nguoi) {
        const vai = vaiTroCua(x, nguoi);
        if (!vai.length || (fVaiTro && !vai.includes(fVaiTro))) return false;
      }
      return !term || [x.title, x.assignee, x.reporter, ...(x.coordinators || []), x.target, x.description, x.note]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [rows, search, fNguoi, fVaiTro]);

  const dangMo = rows.find((x) => x.id === moId);
  const suaViec = (x) => {
    setMoId(null);
    moForm({
      ...x, start_at: day(x.start_at), due_at: day(x.due_at), coordinators: x.coordinators || [],
      progress_item: x.progress_item || "", priority: x.priority || "trung_binh", scope: x.scope || "ca_nhan",
      units: (x.units || []).map((u) => ({ ...u })),
    });
  };

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
          {(duocSua || duocXoa || duocGiao) && (
            <button className={`btn btn-sm ${qlDauViec ? "btn-red" : ""}`} onClick={() => setQlDauViec((v) => (v ? false : true))}>
              <Pencil size={14} />Cơ cấu đầu việc
            </button>
          )}
          {(duocSua || duocXoa) && (
            <button className={`btn btn-sm ${cheDoSua ? "btn-red" : ""}`}
              onClick={() => { setCheDoSua((v) => !v); setQlDauViec(false); }}>
              <Pencil size={14} />{cheDoSua ? "Xong chỉnh sửa" : "Sửa nhanh trên thẻ"}
            </button>
          )}
          {laNguoiQuanLy("tech_tasks") && <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>}
          {duocGiao && <button className="btn btn-red btn-sm" onClick={() => { setMoId(null); moForm(blankTask(categories, fCategory)); }}><Plus size={14} />Giao việc mới</button>}
        </div>
      </div>

      {qlDauViec && <QuanLyDauViec key={typeof qlDauViec === "object" ? qlDauViec.id : "tat-ca"}
        suaNgay={typeof qlDauViec === "object" ? qlDauViec : null}
        onDong={() => setQlDauViec(false)}
        onDoi={() => { loadCategories(); loadSummary(); loadGroups(); }} />}

      {/* Tổng quan: nhóm đầu việc cấp 1 (vd CĐBR) -> các đầu việc bên trong */}
      {nhomDS.map((g) => {
        const gap = dongNhom.includes(g.id);
        const trong = g.categories.map((c) => ({
          ...c, s: summary.find((x) => x.category === c.id) || { total: 0, overdue: 0, done: 0 },
        }));
        const tong = trong.reduce((a, c) => ({
          total: a.total + c.s.total, done: a.done + c.s.done, overdue: a.overdue + c.s.overdue,
        }), { total: 0, done: 0, overdue: 0 });
        return (
          <div key={g.id || "chua-nhom"} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="flex items-center gap-2"
              style={{ padding: "10px 14px", background: "#FCFBFB", borderBottom: gap ? "none" : "1px solid #EFECED", flexWrap: "wrap" }}>
              <button type="button" className="flex items-center gap-1" onClick={() => setDongNhom((ds) => (ds.includes(g.id) ? ds.filter((x) => x !== g.id) : [...ds, g.id]))}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 0, fontWeight: 700, fontSize: 13.5, color: "inherit" }}>
                {gap ? "▸" : "▾"} {g.label}
              </button>
              <span className="muted" style={{ fontSize: 12 }}>{g.categories.length} đầu việc</span>
              <span className="tag tag-grey">{tong.total} việc</span>
              {!!tong.done && <span className="tag tag-green">{tong.done} xong</span>}
              {!!tong.overdue && <span className="tag tag-red">{tong.overdue} quá hạn</span>}
              <span style={{ flex: 1 }} />
              {cheDoSua && g.id && duocSua && (
                <button className="btn btn-sm" onClick={() => doiTenNhom(g)}><Pencil size={12} />Đổi tên nhóm</button>
              )}
              {cheDoSua && g.id && duocXoa && (
                <button className="btn btn-sm" onClick={() => xoaNhom(g)}><Trash2 size={12} />Xóa nhóm</button>
              )}
            </div>
            {!gap && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" style={{ padding: 12 }}>
                {trong.map((c) => {
                  const on = fCategory === c.id;
                  return (
                    <div key={c.id} className="card" role="button" tabIndex={0}
                      style={{ textAlign: "left", cursor: "pointer", padding: 12, border: on ? `1.5px solid ${RED}` : undefined }}
                      onClick={() => setFCategory(on ? "" : c.id)}
                      onKeyDown={(e) => { if (e.key === "Enter") setFCategory(on ? "" : c.id); }}>
                      <div className="flex items-center" style={{ gap: 4 }}>
                        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.3, minHeight: 30, flex: 1 }}>{c.label}</p>
                        {cheDoSua && duocSua && (
                          <button type="button" className="btn btn-sm" style={{ padding: "3px 6px" }} title={`Sửa đầu việc “${c.label}”`}
                            onClick={(e) => { e.stopPropagation(); setQlDauViec({ id: c.id, label: c.label, hint: c.hint || "" }); }}><Pencil size={12} /></button>
                        )}
                        {cheDoSua && duocXoa && (
                          <button type="button" className="btn btn-sm" style={{ padding: "3px 6px" }} title={`Xóa đầu việc “${c.label}”`}
                            onClick={(e) => { e.stopPropagation(); xoaDauViec(c); }}><Trash2 size={12} /></button>
                        )}
                      </div>
                      <div className="flex items-center gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: RED }}>{c.s.total}</span>
                        {!!c.s.done && <span className="tag tag-green">{c.s.done} xong</span>}
                        {!!c.s.overdue && <span className="tag tag-red">{c.s.overdue} quá hạn</span>}
                      </div>
                      {cheDoSua && duocSua && (
                        <select className="inp" style={{ marginTop: 8, fontSize: 12 }} value={g.id}
                          onClick={(e) => e.stopPropagation()} onChange={(e) => xepNhom(c.id, e.target.value)}>
                          <option value="">— Chưa xếp nhóm —</option>
                          {nhomDS.filter((x) => x.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
                {cheDoSua && duocGiao && (
                  <button type="button" className="card" onClick={() => setQlDauViec(true)}
                    style={{ padding: 12, cursor: "pointer", border: "1.5px dashed #E3C3C8", color: RED, fontWeight: 700,
                             display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Plus size={15} />Thêm đầu việc
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {cheDoSua && duocGiao && (
        <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          {nhomMoi === null ? (
            <button className="btn btn-sm" onClick={() => setNhomMoi("")}><Plus size={14} />Thêm nhóm đầu việc cấp 1</button>
          ) : (
            <>
              <input className="inp" style={{ maxWidth: 300 }} autoFocus placeholder="Tên nhóm, vd: CĐBR"
                value={nhomMoi} onChange={(e) => setNhomMoi(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themNhom(); } if (e.key === "Escape") setNhomMoi(null); }} />
              <button className="btn btn-red btn-sm" onClick={themNhom}>Thêm</button>
              <button className="btn btn-sm" onClick={() => setNhomMoi(null)}>Hủy</button>
            </>
          )}
          <span className="muted" style={{ fontSize: 12 }}>Nhóm cấp 1 gom nhiều đầu việc cùng mảng; mỗi thẻ đầu việc có ô chọn nhóm.</span>
        </div>
      )}

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
        <select className="inp" style={{ maxWidth: 230 }} value={fNguoi} onChange={(e) => { setFNguoi(e.target.value); if (e.target.value) setCuaToi(false); }}
          title="Lọc theo nhân viên được gắn tên trong việc">
          <option value="">Mọi nhân viên</option>
          {fNguoi && !dsNguoi.some((p) => chuanTen(p.name) === chuanTen(fNguoi)) && <option value={fNguoi}>{fNguoi} (0)</option>}
          {dsNguoi.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.n})</option>)}
        </select>
        {fNguoi && (
          <select className="inp" style={{ maxWidth: 170 }} value={fVaiTro} onChange={(e) => setFVaiTro(e.target.value)}>
            <option value="">Mọi vai trò</option>
            {Object.entries(VAI_TRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <button className={`btn btn-sm ${cuaToi ? "btn-red" : ""}`} onClick={() => { setCuaToi((v) => !v); setFNguoi(""); }}
          title="Việc tôi phụ trách, phối hợp hoặc báo cáo"><User size={14} />Việc của tôi</button>
        {(fNguoi || fCategory || fStatus || cuaToi || search) && (
          <button className="btn btn-sm" onClick={() => { setFNguoi(""); setFVaiTro(""); setFCategory(""); setFStatus(""); setCuaToi(false); setSearch(""); }}>
            <X size={13} />Bỏ lọc
          </button>
        )}
        {fNguoi && (
          <span className="muted" style={{ fontSize: 12.5 }}>
            {filteredRows.length} việc của <b>{fNguoi}</b>
            {" · "}{filteredRows.filter((x) => effectiveStatus(x) === "done").length} xong
            {" · "}{filteredRows.filter((x) => effectiveStatus(x) === "overdue").length} quá hạn
          </span>
        )}
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

          <p className="eyebrow-grey" style={{ margin: "12px 0 6px" }}>Kế hoạch & tiến độ</p>
          <div className="grid md:grid-cols-4 gap-3">
            {field("Ngày bắt đầu", "start_at", "date")}
            {field("Ngày kết thúc", "due_at", "date")}
            <Field label="Mức ưu tiên">
              <select className="inp" value={form.priority || "trung_binh"} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(UU_TIEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {field("Đơn vị tính khối lượng", "volume_unit", "text", { placeholder: "trạm, tủ, WO…" })}
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Phạm vi thực hiện">
              <select className="inp" value={form.scope || "ca_nhan"} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                {Object.entries(PHAM_VI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {form.scope !== "nhieu_don_vi" && field("Khối lượng giao", "volume_plan", "number")}
            {form.scope !== "nhieu_don_vi" && field("Khối lượng đã làm", "volume_done", "number")}
            {form.scope !== "nhieu_don_vi" && (
              <Field label={Number(form.volume_plan) > 0 ? "Tiến độ (tự tính theo khối lượng)" : "Tiến độ tự nhập (%)"}>
                <input className="inp" type="number" min="0" max="100" value={Number(form.volume_plan) > 0
                  ? Math.round(Math.min((Number(form.volume_done) || 0) / Number(form.volume_plan), 1) * 1000) / 10
                  : (form.percent ?? "")}
                  disabled={Number(form.volume_plan) > 0}
                  onChange={(e) => setForm({ ...form, percent: e.target.value })} />
              </Field>
            )}
          </div>
          {form.scope === "nhieu_don_vi" && (
            <div style={{ marginTop: 4 }}>
              <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Chia khối lượng cho từng đơn vị; tiến độ của nhiệm vụ là tổng khối lượng đã làm trên tổng giao.
              </p>
              <BangDonVi units={form.units || []} onChange={(u) => setForm({ ...form, units: u })}
                donViTinh={form.volume_unit} assignees={assignees} />
            </div>
          )}

          <p className="eyebrow-grey" style={{ margin: "12px 0 6px" }}>Mục tiêu & liên kết</p>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Mục tiêu / chỉ tiêu", "target")}
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
            <thead><tr><th>Đầu việc</th><th>Nội dung</th><th>Nhân sự</th><th>Ưu tiên</th><th>Thời gian</th><th>Khối lượng</th><th>Tiến độ</th><th>Trạng thái</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
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
                  <td><TheUuTien muc={x.priority} /></td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {x.start_at ? fmtDay(x.start_at) : "—"}<br />
                    <span className="muted">đến {fmtDay(x.due_at)}</span>
                  </td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {x.scope === "nhieu_don_vi"
                      ? <span className="muted">{x.units?.length || 0} đơn vị</span>
                      : (x.volume_plan ? `${soGon(x.volume_done)}/${soGon(x.volume_plan)}${x.volume_unit ? ` ${x.volume_unit}` : ""}` : "—")}
                  </td>
                  <td><TienDoNho percent={x.percent} rong={70} /></td>
                  <td><StatusTag task={x} /></td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <ThaoTac onView={() => { setForm(null); setMoId(x.id); }} xemTitle="Xem chi tiết, đính kèm, báo cáo"
                      onEdit={duocSua ? () => suaViec(x) : null} suaTitle="Sửa công việc"
                      onDelete={duocXoa ? () => del(x) : null} xoaTitle="Xóa (vào Thùng rác)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && (
            <>
              <Empty title={cuaToi ? "Bạn chưa được gắn tên trong việc nào." : "Chưa có công việc."}
                hint={rows.length ? "Không có dòng nào khớp bộ lọc."
                  : duocGiao ? "Giao việc xong, mỗi dòng việc có nút Sửa / Xóa ở cuối dòng." : ""} />
              {!rows.length && duocGiao && !form && (
                <div style={{ textAlign: "center", paddingBottom: 20 }}>
                  <button className="btn btn-red btn-sm" onClick={() => { setMoId(null); moForm(blankTask(categories, fCategory)); }}>
                    <Plus size={14} />Giao việc mới
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
