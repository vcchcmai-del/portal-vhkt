import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Download, ExternalLink, FileText, Link2,
  Paperclip, Pencil, Plus, RefreshCw, Trash2, Upload, User, Users, X,
} from "lucide-react";
import { api, coQuyen, getUser, laNguoiQuanLy } from "./api";
import { Card, Empty, Field, norm, RED, ThaoTac } from "./ui";
import { SoLieuCumFT } from "./techtasks-cum";
import { BangHoanCong } from "./techtasks-hoancong";
import { BangDuAn } from "./techtasks-duan";

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
/** "90,9%" — phần trăm viết theo lối Việt, dùng chung cho mọi chỗ hiển thị. */
const phanTram = (n) => `${Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
const IM_LANG = 7;   // ngần này ngày không ai chạm vào thì coi là bỏ quên

/** "2 ngày trước · Lê Hoàng Ân" — để biết số liệu còn tươi hay đã cũ. */
function motaCapNhat(luc, ai, ngay) {
  if (!luc) return "chưa cập nhật lần nào";
  const khi = ngay === 0 ? "hôm nay" : ngay === 1 ? "hôm qua" : `${ngay} ngày trước`;
  return ai ? `${khi} · ${ai}` : khi;
}
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
      {!anSo && <b style={{ fontSize: 12, color: that > 100 ? "#0B8A4B" : undefined }}>{phanTram(Math.round(that * 10) / 10)}</b>}
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
/**
 * Ô chọn người: gõ vài chữ trong tên hoặc chức danh là ra ngay, không phải cuộn
 * hết danh bạ. Gõ không dấu vẫn tìm được. Tên lạ (không còn trong danh bạ) vẫn
 * giữ nguyên để lưu lại không mất dữ liệu.
 */
function ChonNguoi({ value, onChange, assignees, style, trong = "— Chưa đặt —" }) {
  const [go, setGo] = useState("");
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState(0);
  const boc = useRef(null);

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e) => { if (boc.current && !boc.current.contains(e.target)) { setMo(false); setGo(""); } };
    document.addEventListener("mousedown", ngoai);
    return () => document.removeEventListener("mousedown", ngoai);
  }, [mo]);

  const ds = useMemo(() => {
    const t = norm(go.trim());
    const tatCa = assignees || [];
    if (!t) return tatCa;
    return tatCa.filter((a) => norm(`${a.name} ${a.role || ""}`).includes(t));
  }, [assignees, go]);

  const dat = (ten) => { onChange(ten); setMo(false); setGo(""); };
  const phim = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setChon((i) => Math.min(i + 1, ds.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setChon((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); dat(ds[chon] ? ds[chon].name : go.trim()); }
    else if (e.key === "Escape") { setMo(false); setGo(""); }
  };

  return (
    <div ref={boc} style={{ position: "relative", ...style }}>
      <div className="flex items-center gap-1">
        <input className="inp" value={mo ? go : (value || "")} placeholder={trong}
          onFocus={() => { setMo(true); setGo(""); setChon(0); }}
          onChange={(e) => { setGo(e.target.value); setMo(true); setChon(0); }}
          onKeyDown={phim} />
        {!!value && (
          <button type="button" className="tt-btn" title="Bỏ chọn người này"
            onClick={() => { onChange(""); setGo(""); }}><X size={14} /></button>
        )}
      </div>
      {mo && (
        <div className="card" style={{ position: "absolute", zIndex: 40, top: "calc(100% + 2px)", left: 0, right: 0,
                                       maxHeight: 260, overflowY: "auto", padding: 4 }}>
          {ds.slice(0, 60).map((a, i) => (
            <button key={a.name} type="button" onMouseEnter={() => setChon(i)} onClick={() => dat(a.name)}
              style={{ display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                       padding: "6px 8px", borderRadius: 6, fontSize: 13,
                       background: i === chon ? "#FBF4F5" : "transparent", color: "inherit" }}>
              <b>{a.name}</b>{a.role ? <span className="muted"> — {a.role}</span> : null}
            </button>
          ))}
          {!ds.length && (
            <p className="muted" style={{ fontSize: 12.5, padding: "6px 8px" }}>
              Không có ai khớp “{go}”{go.trim() ? " — nhấn Enter để giữ nguyên tên này." : ""}
            </p>
          )}
        </div>
      )}
    </div>
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


/* ---------------------------------------------------------------- chi tiết */

function ChiTietViec({ task, onDong, onSua, onXoa, onDoi, onMoTienDo, duocSua, duocXoa }) {
  const toi = (getUser()?.full_name || "").trim().toLowerCase();
  const duocBaoCao = duocSua || task.cua_toi;
  const [bc, setBc] = useState({
    status: task.status, note: task.note || "", percent: task.percent ?? "",
    volume_done: task.volume_done ?? "", volume_bkk: task.volume_bkk ?? "", units: (task.units || []).map((u) => ({ ...u })),
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
        volume_bkk: task.scope === "nhieu_don_vi" ? undefined : so(bc.volume_bkk),
        units: task.scope === "nhieu_don_vi"
          ? (bc.units || []).map((u) => ({ unit_name: u.unit_name, assignee: u.assignee || "",
              volume_plan: Number(u.volume_plan) || 0, volume_done: Number(u.volume_done) || 0,
              volume_bkk: Number(u.volume_bkk) || 0, note: u.note || "" }))
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
            {task.scope !== "nhieu_don_vi" && !!Number(task.volume_plan) && (
              <Field label="BKK (bất khả kháng)">
                <input className="inp" type="number" value={bc.volume_bkk}
                  onChange={(e) => setBc({ ...bc, volume_bkk: e.target.value })} />
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
  const [trong, setTrong] = useState(null);     // danh sách đầu việc trống
  const [moCoi, setMoCoi] = useState([]);      // số liệu của đầu việc đã bị xoá
  const [chonXoa, setChonXoa] = useState([]);
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

  const taiDauViecTrong = () => {
    setTrong(null); setChonXoa([]);
    api.get("/api/admin/tech-tasks/categories/trong")
      .then((x) => { setTrong(x.dau_viec || []); setMoCoi(x.mo_coi || []); })
      .catch((e) => setLoi(e.message));
  };

  /** Số liệu treo lại sau khi đầu việc bị xoá: gắn sang đầu việc khác, hoặc bỏ. */
  const xuLyMoCoi = async (m, sang) => {
    const nhan = sang ? `Gắn ${m.dong} dòng của “${m.category}” sang đầu việc đã chọn?`
      : `Xóa hẳn ${m.dong} dòng số liệu của “${m.category}”? Không khôi phục được.`;
    if (!window.confirm(nhan)) return;
    try {
      await api.post("/api/admin/tech-tasks/so-lieu-mo-coi",
                     { category_cu: m.category, category_moi: sang || "" });
      taiDauViecTrong(); tai(); onDoi?.();
    } catch (e) { setLoi(e.message); }
  };

  const xoaDauViecTrong = async () => {
    const ten = trong.filter((c) => chonXoa.includes(c.id)).map((c) => c.label);
    if (!window.confirm(`Xóa ${ten.length} đầu việc trống?\n\n${ten.join("\n")}`)) return;
    try {
      const kq = await api.post("/api/admin/tech-tasks/categories/xoa-nhieu", { ma: chonXoa });
      setLoi(kq.bo_qua?.length ? `${kq.bo_qua.length} đầu việc không xoá được (đã có số liệu).` : "");
      taiDauViecTrong(); tai(); onDoi?.();
    } catch (e) { setLoi(e.message); }
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
    await api.put(`/api/admin/tech-tasks/groups/${suaNhom.id}`,
                  { label: suaNhom.label, owner: suaNhom.owner || "" });
    setSuaNhom(null);
  }, "Đã lưu nhóm.");

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
        <br />
        <b>Quyền nhập số liệu đi theo tên ở đây</b>: trưởng nhóm nhập được mọi đầu việc trong nhóm, nhân sự chủ trì
        nhập được đầu việc của mình — thêm, sửa, xóa số liệu và đọc Google Sheet — mà không cần cấp thêm quyền ở
        Quản lý tài khoản. Tên phải trùng họ tên của tài khoản đăng nhập.
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
          <span style={{ flex: 1 }} />
          {duocXoa && (
            <button className={`btn btn-sm ${mo === "don" ? "btn-red" : ""}`}
              title="Tìm các đầu việc không có nhiệm vụ, không có số liệu để xoá một lượt"
              onClick={() => { setMo(mo === "don" ? "" : "don"); if (mo !== "don") taiDauViecTrong(); }}>
              <Trash2 size={13} />Dọn đầu việc trống
            </button>
          )}
        </div>
      )}

      {mo === "don" && !!moCoi.length && (
        <div className="card" style={{ padding: 12, marginBottom: 12, borderLeft: `4px solid ${RED}` }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            {moCoi.length} nhóm số liệu đang treo — đầu việc đã bị xoá nên không hiện ở đâu
          </p>
          {moCoi.map((m) => (
            <div key={m.category} className="flex items-center gap-2"
              style={{ flexWrap: "wrap", fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid #F4F1F2" }}>
              <b>{m.category}</b>
              <span className="muted">{m.dong} dòng · kế hoạch {m.ke_hoach} · kỳ {m.ky.join(", ")}</span>
              <select className="inp" style={{ maxWidth: 240 }} defaultValue=""
                onChange={(e) => { if (e.target.value) { xuLyMoCoi(m, e.target.value); e.target.value = ""; } }}>
                <option value="">— Gắn sang đầu việc… —</option>
                {(dl?.nhom || []).flatMap((g) => g.categories).map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <button className="btn btn-sm" onClick={() => xuLyMoCoi(m, "")}>
                <Trash2 size={13} />Xóa hẳn
              </button>
            </div>
          ))}
        </div>
      )}

      {mo === "don" && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          {!trong ? <p className="muted">Đang tìm…</p> : !trong.length ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Không có đầu việc nào trống — mọi đầu việc đều đang có nhiệm vụ hoặc số liệu.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {trong.length} đầu việc không có nhiệm vụ, không có hạng mục và không có số liệu nào
              </p>
              <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 8 }}>
                {trong.map((c) => (
                  <label key={c.id} className="flex items-center gap-2"
                    style={{ fontSize: 13, padding: "4px 0", borderBottom: "1px solid #F4F1F2" }}>
                    <input type="checkbox" checked={chonXoa.includes(c.id)}
                      onChange={(e) => setChonXoa(e.target.checked
                        ? [...chonXoa, c.id] : chonXoa.filter((x) => x !== c.id))} />
                    <b>{c.label}</b>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {c.group_label || "chưa xếp nhóm"}{c.owner ? ` · ${c.owner}` : ""}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                <button className="btn btn-sm" onClick={() => setChonXoa(trong.map((c) => c.id))}>Chọn tất cả</button>
                <button className="btn btn-sm" onClick={() => setChonXoa([])}>Bỏ chọn</button>
                <button className="btn btn-red btn-sm" disabled={!chonXoa.length} onClick={xoaDauViecTrong}>
                  <Trash2 size={13} />Xóa {chonXoa.length || ""} đầu việc đã chọn
                </button>
              </div>
            </>
          )}
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
                <input className="inp" style={{ maxWidth: 220 }} autoFocus value={suaNhom.label}
                  onChange={(e) => setSuaNhom({ ...suaNhom, label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); luuTenNhom(); } if (e.key === "Escape") setSuaNhom(null); }} />
                <span className="flex items-center gap-1" style={{ minWidth: 260 }}>
                  <b style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>Trưởng nhóm:</b>
                  <ChonNguoi value={suaNhom.owner || ""} assignees={assignees}
                    onChange={(v) => setSuaNhom({ ...suaNhom, owner: v })} />
                </span>
                <button className="btn btn-red btn-sm" onClick={luuTenNhom}>Lưu</button>
                <button className="btn btn-sm" onClick={() => setSuaNhom(null)}>Hủy</button>
              </>
            ) : (
              <b style={{ fontSize: 13.5 }}>{g.label}</b>
            )}
            <span className="muted" style={{ fontSize: 12 }}>{g.categories.length} đầu việc</span>
            {g.id && suaNhom?.id !== g.id && (
              <button type="button" className="btn btn-sm"
                style={{ fontSize: 12, padding: "2px 8px", color: g.owner ? undefined : RED,
                         borderColor: g.owner ? undefined : "#E8C4CB" }}
                disabled={!duocSua}
                title="Trưởng nhóm nhập được số liệu của mọi đầu việc trong nhóm này"
                onClick={() => duocSua && setSuaNhom({ id: g.id, label: g.label, owner: g.owner || "" })}>
                <User size={12} />{g.owner ? `Trưởng nhóm: ${g.owner}` : "Đặt trưởng nhóm"}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {g.id && suaNhom?.id !== g.id && (
              <ThaoTac onEdit={duocSua ? () => setSuaNhom({ id: g.id, label: g.label, owner: g.owner || "" }) : null}
                suaTitle="Đổi tên nhóm / đặt trưởng nhóm"
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
  const [fNhom, setFNhom] = useState("");          // bấm ô nhóm ở Tổng quan để xem riêng nhóm đó
  const [tabCon, setTabCon] = useState("viec");   // trong một đầu việc: "viec" | "cum"
  const [coCum, setCoCum] = useState(false);      // đầu việc đang xem có theo dõi theo cụm không
  const [kieuDV, setKieuDV] = useState("cum");   // "cum" | "hoan_cong"
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
        volume_bkk: Number(form.volume_bkk) || 0,
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

  /** Xuất đúng phần đang xem. Trong một đầu việc theo cụm thì xuất chính bảng
   *  số liệu đang nhìn (cụm/FT), không phải danh sách nhiệm vụ. */
  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      let duong = "/api/admin/tech-tasks/export";
      if (xemDauViec && coCum) {
        duong = "/api/admin/progress/export";
        p.set("category", xemDauViec);
      } else if (xemDauViec) {
        p.set("category", xemDauViec);
      } else if (fNhom) {
        p.set("group", fNhom);
      }
      if (fNguoi && duong.endsWith("tech-tasks/export")) p.set("assignee", fNguoi);
      const q = p.toString();
      const { blob, filename } = await api.blob(`${duong}${q ? `?${q}` : ""}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "cong-viec-ky-thuat.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  /** Mọi người đang được gắn tên trong các việc đang tải, kèm số việc — cho ô lọc. */
  // Đầu việc nào thuộc nhóm nào — để lọc nhanh khi bấm một ô nhóm.
  const nhomCuaDauViec = useMemo(
    () => Object.fromEntries(summary.map((c) => [c.category, c.group || ""])), [summary]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const nguoi = chuanTen(fNguoi);
    return rows.filter((x) => {
      if (fNhom && nhomCuaDauViec[x.category] !== fNhom) return false;
      if (nguoi) {
        const vai = vaiTroCua(x, nguoi);
        if (!vai.length || (fVaiTro && !vai.includes(fVaiTro))) return false;
      }
      return !term || [x.title, x.assignee, x.reporter, ...(x.coordinators || []), x.target, x.description, x.note]
        .filter(Boolean).join(" ").toLowerCase().includes(term);
    });
  }, [rows, search, fNguoi, fVaiTro, fNhom, nhomCuaDauViec]);

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
        kh: a.kh + (c.kl_plan || 0), th: a.th + (c.kl_done || 0), bkk: a.bkk + (c.kl_bkk || 0),
        imLang: Math.max(a.imLang, c.im_lang_ngay ?? 0),
      }), { total: 0, done: 0, doing: 0, overdue: 0, pt: 0, kh: 0, th: 0, bkk: 0, imLang: 0 });
      const phaiLam = Math.max(t.kh - t.bkk, 0);
      // Nhóm có khối lượng thì tỷ lệ là thực hiện/kế hoạch; nhóm thuần nhiệm vụ
      // thì lấy trung bình tiến độ các đầu việc.
      const percent = phaiLam ? Math.round(t.th / phaiLam * 1000) / 10
        : (g.cats.length ? Math.round(t.pt / g.cats.length * 10) / 10 : 0);
      return { ...g, ...t, ton: Math.max(phaiLam - t.th, 0), percent };
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

  // Mở một đầu việc thì hỏi xem nó có số liệu theo cụm không, để biết có cần
  // tách tab hay không; mặc định đứng ở tab còn lại nếu tab kia trống.
  useEffect(() => {
    if (!xemDauViec) return;
    setTabCon("viec");
    setKieuDV(categories.find((c) => c.id === xemDauViec)?.kieu || "cum");
    api.get(`/api/admin/progress/items?category=${encodeURIComponent(xemDauViec)}`)
      .then((x) => setCoCum(Array.isArray(x) && x.length > 0))
      .catch(() => setCoCum(false));
  }, [xemDauViec, categories]);

  const dangMo = rows.find((x) => x.id === moId);
  // Chỉ tách tab khi đầu việc có cả hai phần; thiếu phần nào thì phần còn lại
  // hiện thẳng, không bắt người dùng bấm thêm một nhịp.
  const rieng = kieuDV === "hoan_cong" || kieuDV === "du_an";   // có bảng riêng thay cho bảng cụm
  const tachTab = !!dauViecDangXem && dauViecDangXem.total > 0 && (coCum || rieng);
  const hienViec = !tachTab || tabCon === "viec";
  const hienCum = (!tachTab || tabCon === "cum") && (coCum || rieng);

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
  // Đang tìm hay đang lọc thì mới bày bảng nhiệm vụ ra; không thì thẻ nhóm ở
  // trên đã là danh sách rồi, bày thêm bảng rỗng chỉ tổ rối.
  const dangLoc = !!(search || fStatus || fNguoi || cuaToi || fNhom || fCategory);

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
            {form.scope !== "nhieu_don_vi" && field("BKK (bất khả kháng)", "volume_bkk", "number")}
            {form.scope !== "nhieu_don_vi" && (
              <Field label={Number(form.volume_plan) > 0 ? "Tiến độ (tự tính theo khối lượng)" : "Tiến độ tự nhập (%)"}>
                <input className="inp" type="number" min="0" value={Number(form.volume_plan) > 0
                  ? Math.round((Number(form.volume_done) || 0)
                      / Math.max(Number(form.volume_plan) - (Number(form.volume_bkk) || 0), 0.0001) * 1000) / 10
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

          {laNguoiQuanLy("tech_tasks") && (
            <button className="btn btn-sm" onClick={exportCsv}
              title={xemDauViec ? `Xuất nhiệm vụ của “${dauViecDangXem?.label || ""}”`
                : fNhom ? "Xuất công việc của nhóm đang xem"
                : fNguoi ? `Xuất công việc của ${fNguoi}` : "Xuất toàn bộ công việc kỹ thuật"}>
              <Download size={14} />
              {xemDauViec || fNhom || fNguoi ? "Xuất CSV phần này" : "Xuất CSV"}
            </button>
          )}
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
              <p style={{ fontSize: 12, marginTop: 2,
                          color: (dauViecDangXem.im_lang_ngay ?? 99) >= IM_LANG ? RED : "#807A7C" }}>
                Cập nhật gần nhất: {motaCapNhat(dauViecDangXem.updated_at, dauViecDangXem.updated_by, dauViecDangXem.im_lang_ngay)}
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

          {/* Đầu việc có cả nhiệm vụ lẫn số liệu cụm thì tách hai tab cho đỡ rối;
              chỉ có một phần thì hiện thẳng phần đó. */}
          {tachTab && (
            <div className="card flex gap-2" style={{ padding: 8, flexWrap: "wrap" }}>
              <button className={`btn btn-sm ${tabCon === "viec" ? "btn-red" : ""}`} onClick={() => setTabCon("viec")}>
                Nhiệm vụ · {dauViecDangXem.total}
              </button>
              <button className={`btn btn-sm ${tabCon === "cum" ? "btn-red" : ""}`} onClick={() => setTabCon("cum")}>
                {kieuDV === "hoan_cong" ? "Bảng hoàn công"
                  : kieuDV === "du_an" ? "Bảng dự án" : "Số liệu theo cụm / FT"}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {!!dauViecDangXem.total && hienViec && (
              <div className="card flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px" }}>
                <input className="inp" style={{ maxWidth: 240 }} placeholder="🔎 Tìm nhiệm vụ…" value={search}
                  onChange={(e) => setSearch(e.target.value)} />
                <span className="muted" style={{ fontSize: 12 }}>{filteredRows.length} nhiệm vụ</span>
              </div>
              )}
              {khungViec}
              {!!dauViecDangXem.total && hienViec && (
                <Card pad={false}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Nhiệm vụ</th><th>Phụ trách</th><th>Kế hoạch</th><th>Thực hiện</th>
                          <th>Tỷ lệ</th><th title="Kế hoạch − BKK − Thực hiện">Tồn</th>
                          <th title="Bất khả kháng">BKK</th><th>Cập nhật gần nhất</th><th>Ghi chú</th>
                          <th style={{ textAlign: "right" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((x) => {
                          const kh = Number(x.volume_plan) || 0, th = Number(x.volume_done) || 0;
                          const bkk = Number(x.volume_bkk) || 0;
                          const cu = (x.im_lang_ngay ?? null);
                          return (
                            <tr key={x.id} style={{ cursor: "pointer", background: x.id === moId ? "#FBF4F5" : undefined }}
                              onClick={() => { setForm(null); setMoId(x.id === moId ? null : x.id); }}>
                              <td><b>{x.title}</b><br />
                                <span className="mono muted" style={{ fontSize: 11.5 }}>NV{String(x.id).padStart(4, "0")}</span>
                                {x.due_at && <span className="muted" style={{ fontSize: 11.5 }}> · hạn {fmtDay(x.due_at)}</span>}
                              </td>
                              <td>{x.assignee || <span className="muted">chưa gán</span>}</td>
                              <td>{kh ? soGon(kh) : <span className="muted">—</span>}{x.volume_unit ? ` ${x.volume_unit}` : ""}</td>
                              <td style={{ color: "#16A34A", fontWeight: 600 }}>{th ? soGon(th) : "—"}</td>
                              <td><TienDoNho percent={x.percent} rong={70} /></td>
                              <td style={{ fontWeight: 600 }}>{kh ? soGon(Math.max(kh - bkk - th, 0)) : "—"}</td>
                              <td>{bkk ? soGon(bkk) : <span className="muted">—</span>}</td>
                              <td style={{ fontSize: 12.5, color: cu !== null && cu >= IM_LANG ? RED : undefined }}>
                                {motaCapNhat(x.updated_at, x.updated_by, cu)}
                              </td>
                              <td className="muted" style={{ fontSize: 12.5, maxWidth: 220 }}>{x.note || "—"}</td>
                              <td style={{ textAlign: "right" }}>
                                <ThaoTac onView={() => { setForm(null); setMoId(x.id === moId ? null : x.id); }}
                                  xemTitle="Xem chi tiết" onEdit={duocSua ? () => suaViec(x) : null}
                                  suaTitle="Sửa nhiệm vụ" onDelete={duocXoa ? () => del(x) : null}
                                  xoaTitle="Xóa (vào Thùng rác)" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Nhìn sâu hơn nhiệm vụ: số liệu định lượng của đầu việc gom tới
                  mức chi nhánh, mức cụm rồi tới từng FT. */}
              {hienCum && (kieuDV === "hoan_cong"
                ? <BangHoanCong category={dauViecDangXem.category} label={dauViecDangXem.label} />
                : kieuDV === "du_an"
                  ? <BangDuAn category={dauViecDangXem.category} label={dauViecDangXem.label} />
                  : <SoLieuCumFT category={dauViecDangXem.category} label={dauViecDangXem.label} />)}
            </div>
          </div>
        </>
      )}

      {!dauViecDangXem && (
        <>
      {/* Tổng quan: mỗi nhóm việc một ô, đọc thẳng ra tỷ lệ hoàn thành của nhóm. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {theNhom.map((g) => {
          const mau = g.percent >= 100 ? "#16A34A" : g.percent >= 50 ? "#0E6CD6" : g.percent > 0 ? "#F2A007" : "#8A8284";
          const dangChon = fNhom === g.id;
          return (
            <div key={g.id || "chua"} className="card" role="button" tabIndex={0}
              title={dangChon ? "Bấm lại để xem tất cả nhóm" : `Xem đầu việc của nhóm “${g.label}”`}
              onClick={() => setFNhom(dangChon ? "" : g.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setFNhom(dangChon ? "" : g.id); }}
              style={{ padding: 0, overflow: "hidden", cursor: "pointer",
                       boxShadow: dangChon ? `0 0 0 2px ${mau} inset` : undefined }}>
              <div style={{ height: 4, background: mau }} />
              <div style={{ padding: "10px 12px" }}>
                <p style={{ fontWeight: 700, fontSize: 13, minHeight: 34 }}>{g.label}</p>
                <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                  <b style={{ fontSize: 22, color: mau, lineHeight: 1.1 }}>{phanTram(g.percent)}</b>
                  <span className="muted" style={{ fontSize: 11.5, textAlign: "right", flex: 1 }}>
                    {g.kh ? <>{soGon(g.th)}/{soGon(g.kh - g.bkk)}</>
                      : g.total ? <>{g.done}/{g.total} nhiệm vụ</>
                        : <span className="muted">chưa có kế hoạch</span>}
                  </span>
                </div>
                <TienDoNho percent={g.percent} rong="100%" anSo />
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {g.cats.length} đầu việc
                  {!!g.overdue && <span style={{ color: RED, fontWeight: 700 }}> · {g.overdue} quá hạn</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!!fNhom && (
        <div className="card flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px" }}>
          <b style={{ fontSize: 13 }}>
            Đang xem nhóm: {theNhom.find((g) => g.id === fNhom)?.label || fNhom}
          </b>
          <span className="muted" style={{ fontSize: 12 }}>
            {theNhom.find((g) => g.id === fNhom)?.cats.length || 0} đầu việc · {filteredRows.length} nhiệm vụ
          </span>
          <button className="btn btn-sm" onClick={() => setFNhom("")}>Xem tất cả nhóm</button>
        </div>
      )}

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
        {(fNhom ? theNhom.filter((g) => g.id === fNhom) : theNhom).map((g) => {
          const tt = trangThaiDauViec(g);
          return (
            <div key={g.id || "chua"} className="card the-nhom" style={{ padding: 0, overflow: "hidden" }}>
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
                          {(c.im_lang_ngay ?? 99) >= IM_LANG && (
                            <span style={{ color: RED, fontWeight: 700 }}
                              title={`Cập nhật gần nhất: ${motaCapNhat(c.updated_at, c.updated_by, c.im_lang_ngay)}`}>
                              · {c.im_lang_ngay == null ? "chưa cập nhật" : `${c.im_lang_ngay}n`}
                            </span>
                          )}
                        </span>
                        <span style={{ flex: 1 }}><TienDoNho percent={c.percent} rong="100%" anSo /></span>
                        <span className="muted" style={{ fontSize: 11.5, minWidth: 34, textAlign: "right" }}>{phanTram(c.percent)}</span>
                      </div>
                    </button>
                  ))}
                  {!g.cats.length && <p className="muted" style={{ fontSize: 12.5, padding: "8px 0" }}>Nhóm này chưa có đầu việc.</p>}
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="flex items-center" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span className="muted">Cả nhóm: hoàn thành <b style={{ color: "#1C1A1B" }}>{g.done}/{g.total}</b></span>
                    <b>{phanTram(g.percent)}</b>
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
        <select className="inp" style={{ maxWidth: 180 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {fNguoi && (
          <select className="inp" style={{ maxWidth: 170 }} value={fVaiTro} onChange={(e) => setFVaiTro(e.target.value)}>
            <option value="">Mọi vai trò</option>
            {Object.entries(VAI_TRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <button className={`btn btn-sm ${cuaToi ? "btn-red" : ""}`} onClick={() => { setCuaToi((v) => !v); setFNguoi(""); }}
          title="Việc tôi phụ trách, phối hợp hoặc báo cáo"><User size={14} />Việc của tôi</button>
        {(fNguoi || fCategory || fStatus || cuaToi || search || fNhom) && (
          <button className="btn btn-sm" onClick={() => { setFNguoi(""); setFVaiTro(""); setFCategory(""); setFStatus(""); setCuaToi(false); setSearch(""); setFNhom(""); }}>
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

      {!dauViecDangXem && (dangLoc || !!filteredRows.length) && (
      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr><th>Đầu việc</th><th>Nhiệm vụ</th><th>Phụ trách</th><th>Kế hoạch</th><th>Thực hiện</th>
                <th>Tỷ lệ</th><th title="Kế hoạch − BKK − Thực hiện">Tồn</th>
                <th title="Bất khả kháng">BKK</th><th>Cập nhật gần nhất</th>
                <th style={{ textAlign: "right" }}>Thao tác</th></tr>
            </thead>
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
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      NV{String(x.id).padStart(4, "0")}
                      {x.due_at && <> · hạn {fmtDay(x.due_at)}</>}
                    </div>
                    {x.note && <span className="muted" style={{ fontSize: 12.5 }}>{x.note}</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {x.assignee ? <b>{x.assignee}</b> : <span className="muted">chưa gán</span>}
                    {!!x.coordinators?.length && <><br /><span className="muted">Phối hợp: {x.coordinators.join(", ")}</span></>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {x.scope === "nhieu_don_vi"
                      ? <span className="muted">{x.units?.length || 0} đơn vị</span>
                      : (x.volume_plan ? `${soGon(x.volume_plan)}${x.volume_unit ? ` ${x.volume_unit}` : ""}` : <span className="muted">—</span>)}
                  </td>
                  <td style={{ color: "#16A34A", fontWeight: 600 }}>{x.volume_done ? soGon(x.volume_done) : "—"}</td>
                  <td><TienDoNho percent={x.percent} rong={70} /></td>
                  <td style={{ fontWeight: 600 }}>
                    {x.volume_plan
                      ? soGon(Math.max((x.volume_plan || 0) - (x.volume_bkk || 0) - (x.volume_done || 0), 0))
                      : "—"}
                  </td>
                  <td>{x.volume_bkk ? soGon(x.volume_bkk) : <span className="muted">—</span>}</td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap",
                               color: (x.im_lang_ngay ?? 0) >= IM_LANG ? RED : undefined }}>
                    {motaCapNhat(x.updated_at, x.updated_by, x.im_lang_ngay)}
                  </td>
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
            <Empty title={cuaToi ? "Bạn chưa được gắn tên trong việc nào." : "Không có việc nào khớp."}
              hint="Đổi từ khóa hoặc bỏ lọc để xem lại." />
          )}
        </div>
      </Card>
      )}
    </div>
  );
}
