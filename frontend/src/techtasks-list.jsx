import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Download, ExternalLink, FileText, Link2,
  ListChecks, Paperclip, Pencil, Play, Plus, RefreshCw, Trash2, Upload, User, Users, X,
} from "lucide-react";
import { api, coQuyen, getUser, laNguoiQuanLy } from "./api";
import { Card, Empty, Field, RED, ThaoTac } from "./ui";
import { SoLieuCumFT } from "./techtasks-cum";

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
export function TienDoNho({ percent, rong = 90, anSo = false }) {
  const that = Math.max(0, percent || 0);   // số thật, có thể vượt 100% khi làm quá kế hoạch
  const p = Math.min(that, 100);            // thanh chỉ vẽ tối đa hết chiều dài
  const mau = that > 100 ? "#0B8A4B" : p >= 100 ? "#16A34A" : p >= 50 ? "#0E6CD6" : p > 0 ? "#F2A007" : "#C9D6E8";
  return (
    <span className="flex items-center gap-2" style={{ whiteSpace: "nowrap", width: rong === "100%" ? "100%" : undefined }}>
      <span style={{ width: rong, height: 7, background: "#EAF1FB", borderRadius: 99, overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", width: `${p}%`, height: "100%", background: mau, borderRadius: 99 }} />
      </span>
      {!anSo && <b style={{ fontSize: 12, color: that > 100 ? "#0B8A4B" : undefined }}>{Math.round(that * 10) / 10}%</b>}
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

/** Trạng thái tổng hợp của một đầu việc, suy từ các nhiệm vụ bên trong. */
function trangThaiDauViec(c) {
  if (c.overdue) return { nhan: "Có việc quá hạn", mau: "#C8102E" };
  if (c.total && c.done === c.total) return { nhan: "Hoàn thành", mau: "#16A34A" };
  return { nhan: "Đang theo dõi", mau: "#0E6CD6" };
}

/** Ô số tổng hợp ở đầu Tổng quan. */
function OTongHop({ nhan, so, mau, icon: I, dong }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ height: 4, background: mau }} />
      <div style={{ padding: 12 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 34, height: 34, borderRadius: 10, background: `${mau}16`, color: mau,
                         display: "inline-flex", alignItems: "center", justifyContent: "center" }}><I size={18} /></span>
          <div>
            <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: mau }}>{so}</p>
            <p className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".06em" }}>{nhan}</p>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          {dong.map(([k, v]) => (
            <p key={k} className="muted" style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{k}</span><b style={{ color: "#1C1A1B" }}>{v}</b>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const blankTask = (categories, fCategory) => ({
  category: fCategory || categories?.[0]?.id || "", title: "", description: "",
  // Chủ trì của đầu việc là người mặc định nhận việc mới trong đầu việc đó.
  assignee: (categories || []).find((c) => c.id === (fCategory || categories?.[0]?.id))?.owner || "",
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

/** Ô chọn người từ danh bạ nhân viên + tài khoản (không gõ tay để tránh sai tên). */
function ChonNguoi({ value, onChange, assignees, style, trong = "— Chưa đặt —" }) {
  const co = (assignees || []).some((a) => a.name === value);
  return (
    <select className="inp" style={style} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">{trong}</option>
      {/* Tên cũ không còn trong danh bạ vẫn giữ để không mất dữ liệu khi lưu lại */}
      {!!value && !co && <option value={value}>{value} (không còn trong danh bạ)</option>}
      {(assignees || []).map((a) => (
        <option key={a.name} value={a.name}>
          {a.name}{a.role ? ` — ${a.role}` : ""}
        </option>
      ))}
    </select>
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
        <ChonNguoi value={go} assignees={(assignees || []).filter((a) => !value.some((v) => v === a.name))}
          trong="— Chọn người phối hợp —" onChange={setGo} />
        <button type="button" className="btn btn-sm" onClick={them} title="Thêm người phối hợp"><Plus size={14} /></button>
      </div>
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
                    {chiSuaKhoiLuong
                      ? <input className="inp" style={{ minWidth: 130 }} value={u.assignee || ""} disabled />
                      : <ChonNguoi value={u.assignee} assignees={assignees} style={{ minWidth: 150 }}
                          trong="— Chưa gán —" onChange={(v) => doi(i, "assignee", v)} />}
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

/** Một nhiệm vụ trong màn hình chi tiết đầu việc — thẻ gọn, viền đỏ khi quá hạn. */
function TheNhiemVu({ task, onMo, onSua, onXoa, dangMo }) {
  const st = effectiveStatus(task);
  const quaHan = st === "overdue";
  const mau = { done: "#16A34A", doing: "#0E6CD6", todo: "#F2A007", overdue: "#C8102E" }[st] || "#0E6CD6";
  return (
    <div className="card" role="button" tabIndex={0} onClick={onMo}
      onKeyDown={(e) => { if (e.key === "Enter") onMo(); }}
      style={{ padding: 12, cursor: "pointer", borderColor: quaHan ? "#E8C4CB" : undefined,
               boxShadow: dangMo ? "0 0 0 1.5px #C8102E inset" : undefined }}>
      <div className="flex items-start gap-2">
        <b style={{ fontSize: 13.5, flex: 1 }}>{task.title}</b>
        {quaHan && <AlertTriangle size={15} color="#C8102E" />}
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: 6, flexWrap: "wrap", fontSize: 11.5 }}>
        <span className="mono muted">NV{String(task.id).padStart(4, "0")}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: quaHan ? "#C8102E" : "#807A7C", fontWeight: quaHan ? 700 : 400 }}>
          {task.due_at ? fmtDay(task.due_at) : "chưa đặt hạn"}
        </span>
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
        <StatusTag task={task} />
        <TheUuTien muc={task.priority} />
      </div>
      <div className="flex items-center gap-2" style={{ marginTop: 8, fontSize: 12.5 }}>
        <span className="flex items-center gap-1"><User size={13} />{task.assignee || <span className="muted">chưa gán</span>}</span>
        <span style={{ flex: 1 }} />
        <span onClick={(e) => e.stopPropagation()}>
          <ThaoTac onView={onMo} xemTitle={dangMo ? "Đóng chi tiết" : "Xem chi tiết"}
            onEdit={onSua} suaTitle="Sửa nhiệm vụ" onDelete={onXoa} xoaTitle="Xóa (vào Thùng rác)" />
        </span>
      </div>
      <div style={{ marginTop: 8, height: 6, background: "#EEF1F6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(task.percent || 0, 100)}%`, height: "100%", background: mau }} />
      </div>
    </div>
  );
}

/** Ô số nhỏ ở cột trái màn hình chi tiết đầu việc. */
function OSoNho({ nhan, so, mau, icon: I }) {
  return (
    <div className="card flex items-center gap-2" style={{ padding: 12 }}>
      <div style={{ flex: 1 }}>
        <p className="muted" style={{ fontSize: 12 }}>{nhan}</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: mau, lineHeight: 1.2 }}>{so}</p>
      </div>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: `${mau}16`, color: mau,
                     display: "inline-flex", alignItems: "center", justifyContent: "center" }}><I size={17} /></span>
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
                <input className="inp" type="number" min="0" value={bc.percent}
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
 * Cơ cấu đầu việc: nhóm cấp 1 -> đầu việc.
 *
 * Mọi thao tác "thêm" nằm chung một thanh trên cùng (nhóm mới, đầu việc, thêm
 * nhiều cùng lúc) — trước đây mỗi nhóm có một ô nhập riêng và mỗi dòng có một
 * ô chọn nhóm, nhìn rất rối. Nay ô chọn nhóm chỉ hiện khi sửa đúng dòng đó.
 *
 * Xoá đầu việc còn dữ liệu: máy chủ trả 409 kèm số lượng, giao diện hỏi lại và
 * cho chọn chuyển dữ liệu sang đầu việc khác hoặc xoá kèm.
 */
function QuanLyDauViec({ onDoi, onDong, suaNgay, chiNhom = null, moThem = false }) {
  const [dl, setDl] = useState(null);                   // { nhom: [...], tat_ca_dau_viec: [...] }
  const [assignees, setAssignees] = useState([]);
  const [sua, setSua] = useState(suaNgay ? { id: suaNgay.id, label: suaNgay.label, hint: suaNgay.hint || "", owner: "", group: "" } : null);
  const [mo, setMo] = useState(moThem ? "dauviec" : "");   // "nhom" | "dauviec" | "nhieu" | ""
  // Mở từ một nhóm (nút ＋ / ✏️ trên thẻ Tổng quan) thì chỉ hiện nhóm đó cho đỡ rối.
  const [nhomLoc, setNhomLoc] = useState(chiNhom || "");
  const [nhomMoi, setNhomMoi] = useState("");
  const [dvMoi, setDvMoi] = useState({ label: "", owner: "", group: chiNhom || "" });
  const [hangLoat, setHangLoat] = useState({ nhom: "", text: "" });
  const [suaNhom, setSuaNhom] = useState(null);
  const [xoaHoi, setXoaHoi] = useState(null);           // { cats: [...], cach, dich }
  const [chon, setChon] = useState([]);
  const [loi, setLoi] = useState("");
  const [tin, setTin] = useState("");
  const duocThem = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  const tai = () => api.get("/api/admin/tech-tasks/structure").then(setDl).catch((e) => setLoi(e.message));
  useEffect(() => {
    tai();
    api.get("/api/admin/tech-tasks/assignees").then((x) => setAssignees(Array.isArray(x) ? x : [])).catch(() => {});
  }, []);

  const lam = async (viec, nhan = "") => {
    try { await viec(); setLoi(""); setTin(nhan); tai(); onDoi?.(); }
    catch (e) { setLoi(e.message); setTin(""); }
  };

  const nhomCoMa = (dl?.nhom || []).filter((g) => g.id);
  const phang = (dl?.nhom || []).flatMap((g) => g.categories);
  const nhomHien = nhomLoc ? (dl?.nhom || []).filter((g) => g.id === nhomLoc) : (dl?.nhom || []);
  const tenNhomLoc = (dl?.nhom || []).find((g) => g.id === nhomLoc)?.label || "";
  const coDuLieu = (c) => {
    const d = c.dang_dung || {};
    return (d.viec || 0) + (d.viec_thung_rac || 0) + (d.hang_muc || 0) + (d.dong_tien_do || 0);
  };

  /* ------------------------------------------------------------ thêm mới */
  const themNhom = () => nhomMoi.trim() && lam(async () => {
    await api.post("/api/admin/tech-tasks/groups", { label: nhomMoi.trim() });
    setNhomMoi(""); setMo("");
  }, "Đã thêm nhóm.");

  const themDauViec = () => dvMoi.label.trim() && lam(async () => {
    await api.post("/api/admin/tech-tasks/categories", {
      label: dvMoi.label.trim(), owner: dvMoi.owner.trim(), group_code: dvMoi.group || null });
    setDvMoi({ label: "", owner: "", group: dvMoi.group });
  }, "Đã thêm đầu việc.");

  const themHangLoat = () => {
    const labels = hangLoat.text.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!labels.length) return;
    lam(async () => {
      const r = await api.post("/api/admin/tech-tasks/categories/nhieu", { labels, group_code: hangLoat.nhom || null });
      setHangLoat({ nhom: hangLoat.nhom, text: "" }); setMo("");
      setTin(`Đã thêm ${r.da_them.length} đầu việc.` + (r.bo_qua_trung_ten.length ? ` Bỏ qua ${r.bo_qua_trung_ten.length} tên đã có.` : ""));
    });
  };

  /* ------------------------------------------------------------ sửa/xoá */
  const luuDong = () => lam(async () => {
    await api.put(`/api/admin/tech-tasks/categories/${sua.id}`, {
      label: sua.label, hint: sua.hint, owner: sua.owner, group_code: sua.group });
    setSua(null);
  }, "Đã lưu đầu việc.");

  const doiThuTu = (cat, buoc) => {
    const ds = phang.map((c) => c.id);
    const i = ds.indexOf(cat.id);
    const j = i + buoc;
    if (i < 0 || j < 0 || j >= ds.length) return;
    [ds[i], ds[j]] = [ds[j], ds[i]];
    lam(() => api.post("/api/admin/tech-tasks/categories/sap-xep", { codes: ds }));
  };

  const doiThuTuNhom = (g, buoc) => {
    const i = nhomCoMa.findIndex((x) => x.id === g.id);
    const j = i + buoc;
    if (i < 0 || j < 0 || j >= nhomCoMa.length) return;
    lam(async () => {
      await api.put(`/api/admin/tech-tasks/groups/${nhomCoMa[i].id}`, { order_no: j });
      await api.put(`/api/admin/tech-tasks/groups/${nhomCoMa[j].id}`, { order_no: i });
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

  const xoa = (cat) => {
    if (!coDuLieu(cat)) {
      if (window.confirm(`Xóa đầu việc “${cat.label}”?`)) lam(() => api.del(`/api/admin/tech-tasks/categories/${cat.id}`), "Đã xóa đầu việc.");
      return;
    }
    setXoaHoi({ cats: [cat], cach: "chuyen", dich: phang.find((c) => c.id !== cat.id)?.id || "" });
  };

  const xoaDaChon = () => {
    const cats = phang.filter((c) => chon.includes(c.id));
    if (!cats.length) return;
    if (!cats.some(coDuLieu)) {
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

  /* ------------------------------------------------------------ hiển thị */
  const theDuLieu = (d) => {
    const ds = [[d.viec, "việc"], [d.viec_thung_rac, "việc ở thùng rác"], [d.hang_muc, "hạng mục"], [d.dong_tien_do, "dòng tiến độ"]]
      .filter(([n]) => n);
    if (!ds.length) return <span className="muted">trống</span>;
    return ds.map(([n, t]) => <span key={t} className="tag tag-grey" style={{ marginRight: 4 }}>{n} {t}</span>);
  };

  const oNhom = (giaTri, onChange, style) => (
    <select className="inp" style={style} value={giaTri} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Chưa xếp nhóm —</option>
      {nhomCoMa.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
    </select>
  );

  return (
    <Card title="Cơ cấu đầu việc" action={<button className="btn btn-sm" onClick={onDong}><X size={13} />Đóng</button>}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
        Nhóm cấp 1 (vd CĐBR) gom các đầu việc cùng mảng. Mỗi đầu việc có một nhân sự chủ trì — giao việc mới trong đầu việc đó
        sẽ tự điền sẵn người này.
      </p>

      {/* Thanh thêm: gom mọi thao tác tạo mới về một chỗ */}
      {duocThem && (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 10 }}>
          <button className={`btn btn-sm ${mo === "nhom" ? "btn-red" : ""}`} onClick={() => setMo(mo === "nhom" ? "" : "nhom")}>
            <Plus size={13} />Nhóm mới
          </button>
          <button className={`btn btn-sm ${mo === "dauviec" ? "btn-red" : ""}`} onClick={() => setMo(mo === "dauviec" ? "" : "dauviec")}>
            <Plus size={13} />Đầu việc mới
          </button>
          <button className={`btn btn-sm ${mo === "nhieu" ? "btn-red" : ""}`} onClick={() => setMo(mo === "nhieu" ? "" : "nhieu")}>
            <Plus size={13} />Thêm nhiều đầu việc
          </button>
        </div>
      )}

      {mo === "nhom" && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div className="flex items-end gap-2" style={{ flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <Field label="Tên nhóm cấp 1">
                <input className="inp" autoFocus placeholder="vd: CĐBR" value={nhomMoi}
                  onChange={(e) => setNhomMoi(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themNhom(); } if (e.key === "Escape") setMo(""); }} />
              </Field>
            </div>
            <button className="btn btn-red btn-sm" onClick={themNhom}>Thêm nhóm</button>
            <button className="btn btn-sm" onClick={() => setMo("")}>Hủy</button>
          </div>
        </div>
      )}

      {mo === "dauviec" && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Tên đầu việc">
              <input className="inp" autoFocus placeholder="vd: Kiểm soát WO" value={dvMoi.label}
                onChange={(e) => setDvMoi({ ...dvMoi, label: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); themDauViec(); } }} />
            </Field>
            <Field label="Nhân sự chủ trì">
              <ChonNguoi value={dvMoi.owner} assignees={assignees} onChange={(v) => setDvMoi({ ...dvMoi, owner: v })} />
            </Field>
            <Field label="Thuộc nhóm">{oNhom(dvMoi.group, (v) => setDvMoi({ ...dvMoi, group: v }))}</Field>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-red btn-sm" onClick={themDauViec}>Thêm đầu việc</button>
            <button className="btn btn-sm" onClick={() => setMo("")}>Xong</button>
            <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Thêm xong ô tên tự trống để nhập tiếp.</span>
          </div>
        </div>
      )}

      {mo === "nhieu" && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Field label="Mỗi dòng một tên đầu việc">
                <textarea className="inp" rows="6" autoFocus value={hangLoat.text}
                  placeholder={"Kiểm soát WO\nTriển khai 5G\nCủng cố hạ tầng"}
                  onChange={(e) => setHangLoat({ ...hangLoat, text: e.target.value })} />
              </Field>
            </div>
            <Field label="Xếp vào nhóm">{oNhom(hangLoat.nhom, (v) => setHangLoat({ ...hangLoat, nhom: v }))}</Field>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-red btn-sm" onClick={themHangLoat}>Thêm tất cả</button>
            <button className="btn btn-sm" onClick={() => setMo("")}>Hủy</button>
            <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Chủ trì đặt sau bằng nút ✏️ trên từng dòng.</span>
          </div>
        </div>
      )}

      {!!chon.length && (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px", marginBottom: 10,
                                                          background: "#FBF4F5", borderRadius: 10 }}>
          <b style={{ fontSize: 13 }}>Đã chọn {chon.length} đầu việc</b>
          <button className="btn btn-sm" style={{ color: RED }} onClick={xoaDaChon}><Trash2 size={13} />Xóa đã chọn</button>
          <button className="btn btn-sm" onClick={() => setChon([])}>Bỏ chọn</button>
        </div>
      )}

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

      {nhomLoc && (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px", marginBottom: 10,
                                                          background: "#F3F8FE", borderRadius: 10 }}>
          <b style={{ fontSize: 13 }}>Đang xem nhóm: {tenNhomLoc}</b>
          <span className="muted" style={{ fontSize: 12 }}>chỉ hiện đầu việc của nhóm này</span>
          <button className="btn btn-sm" onClick={() => setNhomLoc("")}>Xem tất cả nhóm</button>
        </div>
      )}

      {!dl && <p className="muted">Đang tải…</p>}

      {nhomHien.map((g) => (
        <div key={g.id || "chua"} className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
          <div className="flex items-center gap-2"
            style={{ padding: "9px 12px", background: "#FCFBFB", borderBottom: "1px solid #EFECED", flexWrap: "wrap" }}>
            {g.id && duocSua && suaNhom?.id !== g.id && (
              <span style={{ whiteSpace: "nowrap" }}>
                <button className="btn btn-sm" style={{ padding: "2px 5px" }} title="Đưa nhóm lên trên" onClick={() => doiThuTuNhom(g, -1)}>▲</button>{" "}
                <button className="btn btn-sm" style={{ padding: "2px 5px" }} title="Đưa nhóm xuống dưới" onClick={() => doiThuTuNhom(g, 1)}>▼</button>
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
              <b style={{ fontSize: 13.5 }}>{g.label}</b>
            )}
            <span className="muted" style={{ fontSize: 12 }}>{g.categories.length} đầu việc</span>
            <span style={{ flex: 1 }} />
            {g.id && suaNhom?.id !== g.id && (
              <ThaoTac onEdit={duocSua ? () => setSuaNhom({ id: g.id, label: g.label }) : null} suaTitle="Đổi tên nhóm"
                onDelete={duocXoa ? () => xoaNhom(g) : null} xoaTitle="Xóa nhóm (đầu việc vẫn giữ)" />
            )}
          </div>

          {g.categories.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 30 }} /><th style={{ width: 60 }}>Thứ tự</th><th>Tên đầu việc</th>
                    <th>Chủ trì</th><th>Dữ liệu đang có</th><th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {g.categories.map((c) => (sua?.id === c.id ? (
                    <tr key={c.id}>
                      <td colSpan={6} style={{ background: "#FCFBFB" }}>
                        <div className="grid md:grid-cols-4 gap-3">
                          <Field label="Tên đầu việc">
                            <input className="inp" autoFocus value={sua.label} onChange={(e) => setSua({ ...sua, label: e.target.value })} />
                          </Field>
                          <Field label="Nhân sự chủ trì">
                            <ChonNguoi value={sua.owner} assignees={assignees} onChange={(v) => setSua({ ...sua, owner: v })} />
                          </Field>
                          <Field label="Thuộc nhóm">{oNhom(sua.group, (v) => setSua({ ...sua, group: v }))}</Field>
                          <Field label="Gợi ý phạm vi">
                            <textarea className="inp" rows="2" value={sua.hint} onChange={(e) => setSua({ ...sua, hint: e.target.value })} />
                          </Field>
                        </div>
                        <div className="flex gap-2" style={{ marginTop: 8 }}>
                          <button className="btn btn-red btn-sm" onClick={luuDong}>Lưu</button>
                          <button className="btn btn-sm" onClick={() => setSua(null)}>Hủy</button>
                        </div>
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
                      <td>
                        <b>{c.label}</b>
                        {c.hint && <><br /><span className="muted" style={{ fontSize: 12 }}>{c.hint.length > 90 ? `${c.hint.slice(0, 89)}…` : c.hint}</span></>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{c.owner || <span className="muted">chưa đặt</span>}</td>
                      <td style={{ fontSize: 12 }}>{theDuLieu(c.dang_dung || {})}</td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        <ThaoTac onEdit={duocSua ? () => setSua({ id: c.id, label: c.label, hint: c.hint || "", owner: c.owner || "", group: g.id }) : null}
                          suaTitle="Sửa tên, chủ trì, nhóm" onDelete={duocXoa ? () => xoa(c) : null} xoaTitle="Xóa đầu việc" />
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12.5, padding: "10px 12px" }}>
              Nhóm này chưa có đầu việc — bấm “Đầu việc mới” ở trên rồi chọn nhóm này.
            </p>
          )}
        </div>
      ))}

      {tin && <p style={{ color: "#16A34A", fontSize: 12.5 }}>{tin}</p>}
      {loi && <p style={{ color: RED, fontSize: 12.5 }}>{loi}</p>}
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
  const [xemDauViec, setXemDauViec] = useState(null);  // mã đầu việc đang mở màn hình chi tiết
  const [nhomDS, setNhomDS] = useState([]);            // nhóm đầu việc cấp 1 (vd CĐBR)
  const [newCat, setNewCat] = useState(null);

  const duocGiao = coQuyen("tech_tasks", "create");
  const duocThemDauViec = coQuyen("tech_tasks", "create");
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
        assignee: form.assignee || "", coordinators: form.coordinators || [],
        reporter: "",                       // người phụ trách chính báo cáo luôn
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

  // Gom số liệu cho Tổng quan: ô tổng hợp + nhóm -> đầu việc (từ /tech-tasks/summary).
  const tong = useMemo(() => {
    const g = summary.reduce((a, c) => ({
      viec: a.viec + c.total, xong: a.xong + c.done, dangLam: a.dangLam + c.doing,
      chuaBatDau: a.chuaBatDau + c.todo, quaHan: a.quaHan + c.overdue,
      dauViecCoViec: a.dauViecCoViec + (c.total ? 1 : 0),
      dauViecXong: a.dauViecXong + (c.total && c.done === c.total ? 1 : 0),
    }), { viec: 0, xong: 0, dangLam: 0, chuaBatDau: 0, quaHan: 0, dauViecCoViec: 0, dauViecXong: 0 });
    return { ...g, dauViec: summary.length };
  }, [summary]);

  // Mỗi nhóm cấp 1 một thẻ, bên trong là các đầu việc của nhóm (nhóm chưa xếp xuống cuối).
  const theNhom = useMemo(() => {
    const thuTu = nhomDS.map((g) => g.id);
    const theo = new Map();
    // Lọc theo nhân viên thì thẻ chỉ giữ đầu việc người đó đứng chủ trì, hoặc
    // đang có nhiệm vụ gắn tên họ — xem “việc của ai” thì không nên thấy cả phòng.
    const ten = chuanTen(fNguoi);
    const dvCoViec = new Set(filteredRows.map((r) => r.category));
    const nguon = ten
      ? summary.filter((c) => chuanTen(c.owner) === ten || dvCoViec.has(c.category))
      : summary;
    for (const c of nguon) {
      const ma = c.group || "";
      if (!theo.has(ma)) theo.set(ma, { id: ma, label: c.group_label || "Chưa xếp nhóm", cats: [] });
      theo.get(ma).cats.push(c);
    }
    const ds = [...theo.values()].map((g) => {
      const t = g.cats.reduce((a, c) => ({
        total: a.total + c.total, done: a.done + c.done, doing: a.doing + c.doing,
        overdue: a.overdue + c.overdue, pt: a.pt + c.percent,
      }), { total: 0, done: 0, doing: 0, overdue: 0, pt: 0 });
      return { ...g, ...t, percent: g.cats.length ? Math.round(t.pt / g.cats.length * 10) / 10 : 0 };
    });
    return ds.sort((a, b) => {
      const i = thuTu.indexOf(a.id), j = thuTu.indexOf(b.id);
      return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
    });
  }, [summary, nhomDS, fNguoi, filteredRows]);

  /** Xoá nhóm ngay trên thẻ Tổng quan — đầu việc bên trong vẫn giữ. */
  const xoaNhomTQ = async (g) => {
    if (!window.confirm(`Xóa nhóm “${g.label}”?\n\n${g.cats.length} đầu việc trong nhóm vẫn còn, chỉ quay về mục “Chưa xếp nhóm”.`)) return;
    try { await api.del(`/api/admin/tech-tasks/groups/${g.id}`); setErr(""); loadGroups(); loadCategories(); loadSummary(); }
    catch (e) { setErr(e.message); }
  };

  const moDauViec = (ma) => { setXemDauViec(ma); setFCategory(ma); setMoId(null); setForm(null); };
  const dongDauViec = () => { setXemDauViec(null); setFCategory(""); setMoId(null); };
  const dauViecDangXem = xemDauViec ? summary.find((c) => c.category === xemDauViec) : null;

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

  /* Khung giao việc / xem chi tiết một nhiệm vụ — dùng chung cho màn danh
     sách và màn chi tiết đầu việc, để bấm vào đâu thì khung mở ngay ở đó. */
  const khungViec = (
    <>
      {form && (
        <Card title={form.id ? "Cập nhật công việc" : "Giao việc mới"}>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Đầu việc">
              {newCat === null ? (
                <div className="flex gap-2">
                  <select className="inp" value={form.category} onChange={(e) => {
                    const chuTri = categories.find((c) => c.id === e.target.value)?.owner || "";
                    const cuTri = categories.find((c) => c.id === form.category)?.owner || "";
                    // Đổi đầu việc: điền chủ trì mới nếu ô đang trống hoặc đang là chủ trì của đầu việc cũ.
                    const giuNguoi = form.assignee && form.assignee !== cuTri;
                    setForm({ ...form, category: e.target.value, progress_item: "",
                              assignee: giuNguoi ? form.assignee : chuTri });
                  }}>
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
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Phụ trách chính (người làm, cũng là người báo cáo)">
              <ChonNguoi value={form.assignee} assignees={assignees} trong="— Chưa gán —"
                onChange={(v) => setForm({ ...form, assignee: v })} />
            </Field>
            <Field label="Phối hợp">
              <NhieuNguoi value={form.coordinators || []} listId="ds-phoi-hop" assignees={assignees}
                onChange={(v) => setForm({ ...form, coordinators: v })} />
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
                <input className="inp" type="number" min="0" value={Number(form.volume_plan) > 0
                  ? Math.round((Number(form.volume_done) || 0) / Number(form.volume_plan) * 1000) / 10
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
    </>
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

          {laNguoiQuanLy("tech_tasks") && <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>}
          {duocGiao && <button className="btn btn-red btn-sm" onClick={() => { setMoId(null); moForm(blankTask(categories, fCategory)); }}><Plus size={14} />Giao việc mới</button>}
        </div>
      </div>

      {qlDauViec && (
        <div className="tt-nen" style={{ alignItems: "flex-start", overflowY: "auto", padding: "24px 16px" }}
          onClick={() => setQlDauViec(false)}>
          <div style={{ width: "100%", maxWidth: 1100 }} onClick={(e) => e.stopPropagation()}>
            <QuanLyDauViec key={typeof qlDauViec === "object" ? (qlDauViec.id || qlDauViec.nhom || "nhom") : "tat-ca"}
              suaNgay={typeof qlDauViec === "object" && qlDauViec.id ? qlDauViec : null}
              chiNhom={typeof qlDauViec === "object" ? (qlDauViec.nhom || null) : null}
              moThem={typeof qlDauViec === "object" && !!qlDauViec.them}
              onDong={() => setQlDauViec(false)}
              onDoi={() => { loadCategories(); loadSummary(); loadGroups(); }} />
          </div>
        </div>
      )}

      {/* Màn hình chi tiết một đầu việc. Đầu việc định lượng (số liệu theo cụm,
          chưa chia nhiệm vụ con) thì chính nó đã là một nhiệm vụ — chỉ hiện bảng
          cụm/FT, không bày thêm ô "Tổng nhiệm vụ" và thẻ nhiệm vụ trùng tên. */}
      {dauViecDangXem && (
        <>
          <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-sm" onClick={dongDauViec}><ArrowLeft size={14} />Tất cả đầu việc</button>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p className="muted" style={{ fontSize: 11.5, letterSpacing: ".06em", textTransform: "uppercase" }}>
                {dauViecDangXem.group_label || "Chưa xếp nhóm"}
              </p>
              <b style={{ fontSize: 16 }}>{dauViecDangXem.label}</b>
              <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                Chủ trì: {dauViecDangXem.owner || "chưa đặt"}
                {(dauViecDangXem.start_at || dauViecDangXem.due_at)
                  ? ` · ${dauViecDangXem.start_at ? fmtDay(dauViecDangXem.start_at) : "—"} → ${dauViecDangXem.due_at ? fmtDay(dauViecDangXem.due_at) : "—"}`
                  : " · chưa đặt mốc thời gian"}
              </p>
            </div>
            {duocSua && (
              <button className="btn btn-sm" onClick={() => setQlDauViec({ id: dauViecDangXem.category, label: dauViecDangXem.label, hint: "", nhom: dauViecDangXem.group })}>
                <Pencil size={14} />Sửa đầu việc
              </button>
            )}
            {duocGiao && (
              <button className="btn btn-red btn-sm" onClick={() => { setMoId(null); moForm(blankTask(categories, dauViecDangXem.category)); }}>
                <Plus size={14} />Thêm nhiệm vụ
              </button>
            )}
          </div>

          <div className={dauViecDangXem.total ? "grid lg:grid-cols-4 gap-4" : "flex flex-col gap-4"}>
            {!!dauViecDangXem.total && (
            <div className="flex flex-col gap-3">
              <OSoNho nhan="Tổng nhiệm vụ" so={dauViecDangXem.total} mau="#0E6CD6" icon={ListChecks} />
              <OSoNho nhan="Hoàn thành" so={dauViecDangXem.done} mau="#16A34A" icon={CheckCircle2} />
              <OSoNho nhan="Đang thực hiện" so={dauViecDangXem.doing} mau="#F2A007" icon={Play} />
              <OSoNho nhan="Quá hạn" so={dauViecDangXem.overdue} mau={dauViecDangXem.overdue ? RED : "#16A34A"} icon={AlertTriangle} />
              <div className="card" style={{ padding: 12 }}>
                <div className="flex items-center" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span className="muted">Hoàn thành <b style={{ color: "#1C1A1B" }}>{dauViecDangXem.done}/{dauViecDangXem.total}</b></span>
                  <b>{dauViecDangXem.percent}%</b>
                </div>
                <TienDoNho percent={dauViecDangXem.percent} rong="100%" anSo />
              </div>
            </div>
            )}

            <div className={`${dauViecDangXem.total ? "lg:col-span-3 " : ""}flex flex-col gap-3`}>
              {!!dauViecDangXem.total && (
              <div className="card flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px" }}>
                <input className="inp" style={{ maxWidth: 240 }} placeholder="🔎 Tìm nhiệm vụ…" value={search}
                  onChange={(e) => setSearch(e.target.value)} />
                {[["", "Tất cả"], ["todo", "Chưa bắt đầu"], ["doing", "Đang thực hiện"], ["done", "Hoàn thành"], ["overdue", "Quá hạn"]].map(([ma, nhan]) => (
                  <button key={ma || "all"} className={`btn btn-sm ${fStatus === ma ? "btn-red" : ""}`}
                    onClick={() => setFStatus(ma)}>{nhan}</button>
                ))}
              </div>
              )}
              {khungViec}
              {!!dauViecDangXem.total && (
                <div className="grid md:grid-cols-2 gap-3">
                  {filteredRows.map((x) => (
                    <TheNhiemVu key={x.id} task={x} dangMo={moId === x.id}
                      onMo={() => { setForm(null); setMoId(x.id === moId ? null : x.id); }}
                      onSua={duocSua ? () => suaViec(x) : null}
                      onXoa={duocXoa ? () => del(x) : null} />
                  ))}
                </div>
              )}

              {/* Nhìn sâu hơn nhiệm vụ: số liệu định lượng của đầu việc gom tới
                  mức chi nhánh, mức cụm rồi tới từng FT. */}
              <SoLieuCumFT category={dauViecDangXem.category} label={dauViecDangXem.label} />
            </div>
          </div>
        </>
      )}

      {!dauViecDangXem && (
        <>
      {/* Tổng quan: ô số tổng hợp -> lọc nhanh theo trạng thái -> thẻ từng đầu việc */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OTongHop nhan="Nhóm / đầu việc" so={`${theNhom.length}/${tong.dauViec}`} mau="#0E6CD6" icon={ClipboardList}
          dong={[["Đầu việc có nhiệm vụ", tong.dauViecCoViec], ["Đã xong hết", tong.dauViecXong]]} />
        <OTongHop nhan="Tổng nhiệm vụ" so={tong.viec} mau="#16A34A" icon={ListChecks}
          dong={[["Hoàn thành", tong.xong], ["Tỷ lệ", tong.viec ? `${Math.round(tong.xong / tong.viec * 100)}%` : "—"]]} />
        <OTongHop nhan="Đang thực hiện" so={tong.dangLam} mau="#F2A007" icon={Play}
          dong={[["Chưa bắt đầu", tong.chuaBatDau], ["Đang mở", tong.viec - tong.xong]]} />
        <OTongHop nhan="Nhiệm vụ quá hạn" so={tong.quaHan} mau={tong.quaHan ? RED : "#16A34A"} icon={AlertTriangle}
          dong={[["Trên tổng", tong.viec], ["Tỷ lệ", tong.viec ? `${Math.round(tong.quaHan / tong.viec * 100)}%` : "—"]]} />
      </div>

      {!!fNguoi && (
        <div className="card flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px" }}>
          <b style={{ fontSize: 13 }}>Đang xem công việc của: {fNguoi}</b>
          <span className="muted" style={{ fontSize: 12 }}>
            {theNhom.reduce((a, g) => a + g.cats.length, 0)} đầu việc chủ trì hoặc có nhiệm vụ gắn tên
          </span>
          <button className="btn btn-sm" onClick={() => setFNguoi("")}>Xem cả phòng</button>
        </div>
      )}

      {/* Mỗi thẻ là một nhóm cấp 1; bên trong liệt kê đầu việc, bấm vào đầu việc
          mới xuống danh sách nhiệm vụ của nó. */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {theNhom.map((g) => {
          const tt = trangThaiDauViec(g);
          return (
            <div key={g.id || "chua"} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 4, background: tt.mau }} />
              <div style={{ padding: 12 }}>
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <span style={{ flex: 1 }} />
                  {g.id && (
                    <ThaoTac
                      truoc={duocThemDauViec ? (
                        <button type="button" className="tt-btn" title={`Thêm đầu việc vào “${g.label}”`}
                          onClick={() => setQlDauViec({ nhom: g.id, them: true })}><Plus size={16} /></button>
                      ) : null}
                      onEdit={duocSua ? () => setQlDauViec({ nhom: g.id }) : null} suaTitle="Sửa nhóm trong Cơ cấu"
                      onDelete={duocXoa ? () => xoaNhomTQ(g) : null} xoaTitle="Xóa nhóm (đầu việc vẫn giữ)" />
                  )}
                </div>

                <p style={{ fontWeight: 800, fontSize: 15.5, marginTop: 8 }}>{g.label}</p>
                <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {g.cats.length} đầu việc{!!g.total && ` · ${g.total} nhiệm vụ`}
                  {!!g.overdue && <span style={{ color: RED, fontWeight: 700 }}> · {g.overdue} quá hạn</span>}
                </p>

                <div style={{ marginTop: 10, borderTop: "1px solid #EFECED" }}>
                  {g.cats.map((c) => (
                    <button key={c.category} type="button" onClick={() => moDauViec(c.category)}
                      title={`Mở đầu việc “${c.label}”`}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none",
                               borderBottom: "1px solid #F4F1F2", padding: "8px 0", cursor: "pointer", color: "inherit" }}>
                      <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                        <b style={{ fontSize: 13.5, flex: 1 }}>{c.label}</b>
                        <span style={{ fontSize: 12, fontWeight: 700 }}
                          title={c.total ? "Nhiệm vụ hoàn thành / tổng" : `Khối lượng thực hiện / kế hoạch kỳ ${c.kl_period}`}>
                          {c.total ? `${c.done}/${c.total}` : (c.kl_plan ? `${soGon(c.kl_done)}/${soGon(c.kl_plan)}` : "—")}
                        </span>
                        {!!c.overdue && <span className="tag tag-red" style={{ fontSize: 11 }}>{c.overdue} quá hạn</span>}
                      </div>
                      <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                        <span className="muted flex items-center gap-1" style={{ fontSize: 11.5, minWidth: 120 }}>
                          <User size={12} />{c.owner || "chưa có chủ trì"}
                        </span>
                        <span style={{ flex: 1 }}><TienDoNho percent={c.percent} rong="100%" anSo /></span>
                        <span className="muted" style={{ fontSize: 11.5, minWidth: 34, textAlign: "right" }}>{c.percent}%</span>
                      </div>
                    </button>
                  ))}
                  {!g.cats.length && <p className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>Nhóm này chưa có đầu việc.</p>}
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="flex items-center" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span className="muted">Cả nhóm: hoàn thành <b style={{ color: "#1C1A1B" }}>{g.done}/{g.total}</b></span>
                    <b>{g.percent}%</b>
                  </div>
                  <TienDoNho percent={g.percent} rong="100%" anSo />
                </div>
              </div>
            </div>
          );
        })}
      </div>

        </>
      )}

      {!dauViecDangXem && (
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
      )}

      {err && <p style={{ color: RED }}>{err}</p>}

      {!dauViecDangXem && khungViec}

      {!dauViecDangXem && (
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
      )}
    </div>
  );
}
