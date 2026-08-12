/**
 * KHU QUẢN TRỊ — chỉ hiện với tài khoản có quyền biên tập trở lên.
 *
 * Gồm 8 mục:
 *   Quản lý bản tin, Quản lý thông báo, Quản lý banner, Thông điệp Giám đốc,
 *   Quản lý ứng dụng, Quản lý tài liệu, Quản lý nhân viên, Cấu hình website.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Bell, BellRing, BookOpen, Briefcase, Building2, Check, Database, Download, Edit3, FileText,
  Image as ImageIcon, MessageSquare, Pin, Plus, Rocket, Save, Send, Settings, Star,
  Trash2, Users, X, Calendar, Eye, EyeOff, RefreshCw, KeyRound, ShieldCheck, UserCog, Table2, Stethoscope, CalendarClock, Images, Video,
  History, Search, Filter, RotateCcw, Trash, Upload,
} from "lucide-react";

import { api } from "./api";
import { AdminImport } from "./bulkimport";
import { AdminDiagnostics } from "./diagnostics";
import { AdminDutyRosterImport } from "./dutyroster";
import { AdminForum } from "./forum";
import { AdminDutyRoster, AdminHandovers, AdminOperations, AdminWorkOrders } from "./operations";
import { AdminCandidates, AdminStaffing } from "./recruitment";
import { GalleryPicker, ImagePicker } from "./imagepicker";
import { Card, Check as CheckBox, Empty, Field, norm, RED, RED_DARK, SwitchRow } from "./ui";

/* --------------------------------------------------------------- Tiện ích */

const iso = (v) => (v ? String(v).slice(0, 10) : "");
const isoLocal = (v) => (v ? String(v).slice(0, 16) : "");

// Danh sách nhóm ứng dụng của Chi nhánh.
// Người quản trị vẫn có thể chọn "Nhóm khác / Tự nhập" để tạo nhóm mới.
const APP_GROUPS_BASE = [
  "Vận hành",
  "Điều hành",
  "Cơ điện",
  "Truyền dẫn",
  "Hạ tầng",
  "Hoàn Công",
  "AI & Công nghệ",
  "Truyền thông",
  "An toàn",
  "Vật tư",
  "Tài chính",
  "Tổ chức - Nhân sự",
  "Văn phòng",
  "Đơn vị",
];

function useAdminList(path, deps = []) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = () => {
    setLoading(true);
    api.get(path)
      .then((d) => { setRows(Array.isArray(d) ? d : []); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, deps);
  return { rows, loading, error, reload, setRows };
}

function Toolbar({ title, hint, onAdd, addLabel = "Thêm mới", onReload, onExport, exportLabel = "Xuất báo cáo" }) {
  return (
    <div className="card flex items-center justify-between gap-3" style={{ padding: 16, flexWrap: "wrap", borderLeft: `3px solid ${RED}` }}>
      <div>
        <p style={{ fontWeight: 700, fontSize: 15 }}>{title}</p>
        {hint && <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{hint}</p>}
      </div>
      <div className="flex gap-2">
        {onReload && <button className="btn btn-sm" onClick={onReload}><RefreshCw size={13} /> Tải lại</button>}
        {onExport && <button className="btn btn-sm" onClick={onExport}><Download size={13} /> {exportLabel}</button>}
        {onAdd && <button className="btn btn-red" onClick={onAdd}><Plus size={15} /> {addLabel}</button>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, onSave, saving, wide }) {
  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: wide ? "min(760px,100%)" : "min(560px,100%)", maxHeight: "88vh", display: "flex", flexDirection: "column", borderRadius: 16 }}>
        <div className="card-h">
          <h3 className="card-t" style={{ fontSize: 16 }}>{title}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>{children}</div>
        <div className="flex gap-2" style={{ padding: 14, borderTop: "1px solid #E7E3E4" }}>
          <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Huỷ</button>
          <button className="btn btn-red" style={{ flex: 1, justifyContent: "center" }} disabled={saving} onClick={onSave}>
            <Save size={15} /> {saving ? "Đang lưu…" : "Lưu lại"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Status({ error, loading, empty, emptyHint }) {
  if (loading) return <Empty title="Đang tải dữ liệu…" />;
  if (error) return <Empty title="Không tải được dữ liệu." hint={error} />;
  if (empty) return <Empty title="Chưa có dữ liệu." hint={emptyHint} />;
  return null;
}

/* ================================================== 1. QUẢN LÝ BẢN TIN */

const CATEGORIES = ["Hoạt động", "Phong trào", "Gương điển hình", "Văn hoá", "Bản tin", "Thành tích"];

export function AdminNews() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/news");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const blank = {
    title: "", excerpt: "", body: "", cover_url: "", author: "",
    published_at: new Date().toISOString().slice(0, 16),
    category: "Hoạt động", tag: "Tin tức",
    gallery: [],
    featured: false, pinned: false, visible: true,
  };

  const save = async () => {
    if (!edit.title.trim()) { setMsg("Chưa nhập tiêu đề bản tin."); return; }
    setSaving(true); setMsg("");
    const payload = { ...edit, published_at: edit.published_at ? new Date(edit.published_at).toISOString() : null };
    try {
      if (edit.id) await api.put(`/api/admin/news/${edit.id}`, payload);
      else await api.post("/api/admin/news", payload);
      setEdit(null); reload();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const remove = async (row) => {
    if (!window.confirm(`Chuyển bản tin "${row.title}" vào thùng rác?\n\nQuản trị viên có thể khôi phục trong vòng 30 ngày, sau đó sẽ tự động xoá hẳn.`)) return;
    try { await api.del(`/api/admin/news/${row.id}`); reload(); }
    catch (e) { window.alert(e.message); }
  };

  const toggle = async (row, field) => {
    try { await api.put(`/api/admin/news/${row.id}`, { [field]: !row[field] }); reload(); }
    catch (e) { window.alert(e.message); }
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Bản tin" onReload={reload} onAdd={() => setEdit({ ...blank })} addLabel="Thêm bản tin"
        hint="Sửa tiêu đề, nội dung, ảnh đại diện, người đăng, ngày đăng, chuyên mục, tin nổi bật, ghim trang chủ và trạng thái hiển thị." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
        {rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 280 }}>Tiêu đề</th>
                  <th>Chuyên mục</th>
                  <th>Người đăng</th>
                  <th>Ngày đăng</th>
                  <th style={{ textAlign: "center" }}>Nổi bật</th>
                  <th style={{ textAlign: "center" }}>Ghim</th>
                  <th style={{ textAlign: "center" }}>Hiển thị</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p style={{ fontWeight: 600 }}>{r.title}</p>
                      <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{(r.excerpt || "").slice(0, 70)}</p>
                    </td>
                    <td><span className="tag tag-grey">{r.category}</span></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{r.author}</td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{iso(r.published_at).split("-").reverse().join("/")}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className="btn btn-sm btn-ghost" title="Tin nổi bật" onClick={() => toggle(r, "featured")}>
                        <Star size={15} style={{ color: r.featured ? RED : "#C6C1C2", fill: r.featured ? RED : "none" }} />
                      </button>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button className="btn btn-sm btn-ghost" title="Ghim lên trang chủ" onClick={() => toggle(r, "pinned")}>
                        <Pin size={15} style={{ color: r.pinned ? RED : "#C6C1C2" }} />
                      </button>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button className="btn btn-sm btn-ghost" title="Trạng thái hiển thị" onClick={() => toggle(r, "visible")}>
                        {r.visible ? <Eye size={15} style={{ color: "#0A7A50" }} /> : <EyeOff size={15} style={{ color: "#C6C1C2" }} />}
                      </button>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setEdit({ ...r, published_at: isoLocal(r.published_at) })}>
                        <Edit3 size={13} /> Sửa
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && (
        <Modal wide saving={saving} onSave={save} onClose={() => setEdit(null)}
          title={edit.id ? "Sửa bản tin" : "Thêm bản tin mới"}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}

          <Field label="Tiêu đề">
            <input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder="Ví dụ: Đơn vị hoàn thành 106% kế hoạch sản lượng tháng 7" />
          </Field>

          <Field label="Tóm tắt (hiện ở danh sách tin)">
            <textarea className="inp" rows={2} value={edit.excerpt || ""} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} />
          </Field>

          <Field label="Nội dung">
            <textarea className="inp" rows={7} value={edit.body || ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })}
              placeholder="Nội dung đầy đủ của bản tin" />
          </Field>

          <ImagePicker label="Ảnh đại diện" value={edit.cover_url || ""}
            onChange={(url) => setEdit({ ...edit, cover_url: url })}
            hint="Ảnh này hiện ở đầu bài và trên thẻ tin ngoài danh sách." />

          <GalleryPicker value={edit.gallery || []}
            onChange={(list) => setEdit({ ...edit, gallery: list })} />

          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Người đăng">
              <input className="inp" value={edit.author || ""} onChange={(e) => setEdit({ ...edit, author: e.target.value })}
                placeholder="Để trống sẽ lấy tên tài khoản đang đăng nhập" />
            </Field>
            <Field label="Ngày đăng">
              <input className="inp" type="datetime-local" value={edit.published_at || ""}
                onChange={(e) => setEdit({ ...edit, published_at: e.target.value })} />
            </Field>
            <Field label="Chuyên mục">
              <select className="inp" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Nhãn hiển thị trên thẻ tin">
              <input className="inp" value={edit.tag || ""} onChange={(e) => setEdit({ ...edit, tag: e.target.value })}
                placeholder="Ví dụ: Tin nổi bật, Thi đua" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" style={{ marginTop: 4 }}>
            <CheckBox label="Tin nổi bật" checked={edit.featured} onChange={(v) => setEdit({ ...edit, featured: v })} />
            <CheckBox label="Ghim lên trang chủ" checked={edit.pinned} onChange={(v) => setEdit({ ...edit, pinned: v })} />
            <CheckBox label="Đang hiển thị" checked={edit.visible} onChange={(v) => setEdit({ ...edit, visible: v })} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================================================ 2. QUẢN LÝ THÔNG BÁO */

export function AdminNotices() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/notices");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (edit.id) await api.put(`/api/admin/notices/${edit.id}`, edit);
      else await api.post("/api/admin/notices", edit);
      setEdit(null); reload();
    } catch (e) { window.alert(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm("Xoá thông báo này?")) return;
    await api.del(`/api/admin/notices/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Quản lý thông báo khẩn" onReload={reload} addLabel="Thêm thông báo"
        onAdd={() => setEdit({ content: "", level: "urgent", active: true })}
        hint="Thông báo đang bật sẽ hiện dải đỏ trên cùng trang chủ. Chỉ thông báo mới nhất được hiển thị." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-start gap-3" style={{ padding: "14px 16px", borderTop: i ? "1px solid #F1EEEF" : 0 }}>
            <Bell size={17} style={{ color: r.active ? RED : "#C6C1C2", flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13.5, fontWeight: 500 }}>{r.content}</p>
              <p className="muted mono" style={{ fontSize: 11.5, marginTop: 4 }}>
                {r.active ? "Đang hiển thị" : "Đã tắt"} · {iso(r.starts_at).split("-").reverse().join("/")}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm" onClick={() => setEdit({ ...r })}><Edit3 size={13} /> Sửa</button>
              <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </Card>

      {edit && (
        <Modal title={edit.id ? "Sửa thông báo" : "Thêm thông báo"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          <Field label="Nội dung thông báo">
            <textarea className="inp" rows={4} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })}
              placeholder="Ví dụ: Cắt điện lưới khu vực Hóc Môn từ 22:00 hôm nay…" />
          </Field>
          <CheckBox label="Đang hiển thị trên trang chủ" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
        </Modal>
      )}
    </div>
  );
}

/* ================================================== 3. QUẢN LÝ BANNER */

export function AdminBanners() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/banners");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (edit.id) await api.put(`/api/admin/banners/${edit.id}`, edit);
      else await api.post("/api/admin/banners", edit);
      setEdit(null); reload();
    } catch (e) { window.alert(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá banner "${r.title}"?`)) return;
    await api.del(`/api/admin/banners/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Quản lý banner trang chủ" onReload={reload} addLabel="Thêm banner"
        onAdd={() => setEdit({ title: "", image_url: "", link_url: "#", color: RED, order_no: rows.length, active: true })}
        hint="Banner hiện thành dải ngang phía trên trang chủ. Không có ảnh thì hiện nền màu kèm chữ." />

      <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((r) => (
          <div key={r.id} className="card" style={{ overflow: "hidden", opacity: r.active ? 1 : 0.5 }}>
            <div className="thumb" style={{ height: 100, borderRadius: 0, background: r.color || RED, padding: 14, alignItems: "flex-start", justifyContent: "center", flexDirection: "column" }}>
              {r.image_url ? <img src={r.image_url} alt={r.title} />
                : <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, textAlign: "left", lineHeight: 1.35 }}>{r.title}</span>}
            </div>
            <div style={{ padding: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</p>
              <p className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>
                Thứ tự {r.order_no} · {r.active ? "Đang bật" : "Đã tắt"}
              </p>
              <div className="flex gap-2" style={{ marginTop: 10 }}>
                <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setEdit({ ...r })}><Edit3 size={13} /> Sửa</button>
                <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit.id ? "Sửa banner" : "Thêm banner"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          <Field label="Tiêu đề banner">
            <input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </Field>
          <ImagePicker label="Ảnh banner (để trống thì dùng nền màu)" value={edit.image_url || ""}
            onChange={(url) => setEdit({ ...edit, image_url: url })}
            hint="Nên dùng ảnh ngang, khoảng 1200 x 400 điểm ảnh." />
          <Field label="Bấm vào banner sẽ mở">
            <input className="inp" value={edit.link_url || ""} onChange={(e) => setEdit({ ...edit, link_url: e.target.value })} placeholder="# hoặc https://..." />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Màu nền">
              <input className="inp" type="color" value={edit.color || RED} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ height: 42, padding: 4 }} />
            </Field>
            <Field label="Thứ tự hiển thị">
              <input className="inp" type="number" value={edit.order_no ?? 0} onChange={(e) => setEdit({ ...edit, order_no: Number(e.target.value) })} />
            </Field>
          </div>
          <CheckBox label="Đang hiển thị" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
        </Modal>
      )}
    </div>
  );
}

/* ============================================ 4. THÔNG ĐIỆP GIÁM ĐỐC */

const DIRECTOR_KEYS = [
  ["director_name", "Họ và tên Giám đốc", "text"],
  ["director_title", "Chức danh hiển thị", "text"],
  ["director_message", "Nội dung thông điệp", "textarea"],
];

export function AdminDirector() {
  return <ConfigEditor keys={DIRECTOR_KEYS} title="Thông điệp Giám đốc"
    hint="Nội dung này hiện ở khối lớn giữa trang chủ. Nên cập nhật mỗi tháng hoặc khi có chỉ đạo mới." />;
}

/* ============================================== 5. QUẢN LÝ ỨNG DỤNG */

export function AdminApps() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/apps");
  const appGroups = Array.from(new Set([
    ...APP_GROUPS_BASE,
    ...rows.map((r) => String(r.category || "").trim()).filter(Boolean),
  ]));
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState("");

  const save = async () => {
    if (!edit?.name?.trim()) {
      setMsg("Chưa nhập tên ứng dụng.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        name: edit.name.trim(),
        description: (edit.description || "").trim(),
        url: (edit.url || "").trim() || "#",
        category: edit.category || "Chi nhánh",
        color: edit.color || RED,
        order_no: Number.isFinite(Number(edit.order_no)) ? Number(edit.order_no) : rows.length,
      };
      if (edit.id) {
        await api.put(`/api/admin/apps/${edit.id}`, payload);
      } else {
        await api.post("/api/admin/apps", payload);
      }
      setEdit(null);
      await reload();
    } catch (e) {
      setMsg(e.message || "Không lưu được ứng dụng.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá ứng dụng "${r.name}"?`)) return;
    try {
      await api.del(`/api/admin/apps/${r.id}`);
      await reload();
    } catch (e) {
      window.alert(e.message || "Không xoá được ứng dụng.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Quản lý ứng dụng" onReload={reload} addLabel="Thêm ứng dụng"
        onAdd={() => setEdit({ name: "", description: "", url: "#", category: "Đơn vị", color: RED, icon_url: "", order_no: rows.length })}
        hint="Đây là nơi điền đường dẫn thật cho GNOC, NIMS, Portal Viettel và các phần mềm tự phát triển." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
        {rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Ứng dụng</th><th>Nhóm</th><th style={{ minWidth: 200 }}>Đường dẫn</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="thumb" style={{ width: 30, height: 30, background: r.color, fontSize: 12, overflow: "hidden" }}>
                          {r.icon_url ? <img src={r.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} /> : r.name[0]}
                        </span>
                        <span>
                          <p style={{ fontWeight: 600 }}>{r.name}</p>
                          <p className="muted" style={{ fontSize: 12 }}>{r.description}</p>
                        </span>
                      </div>
                    </td>
                    <td><span className="tag tag-grey">{r.category}</span></td>
                    <td className="mono" style={{ fontSize: 12, color: r.url === "#" ? RED : "#4A3A40" }}>
                      {r.url === "#" ? "Chưa điền đường dẫn" : r.url}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setEdit({ ...r })}><Edit3 size={13} /> Sửa</button>{" "}
                      <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && (
        <Modal title={edit.id ? "Sửa ứng dụng" : "Thêm ứng dụng"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}
          <Field label="Tên ứng dụng"><input className="inp" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
          <Field label="Mô tả ngắn"><input className="inp" value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <Field label="Đường dẫn mở ứng dụng"><input className="inp" value={edit.url || ""} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="http://gnoc.viettel.local" /></Field>
          <ImagePicker label="Biểu tượng ứng dụng" value={edit.icon_url || ""}
            onChange={(url) => setEdit({ ...edit, icon_url: url })}
            hint="Tải logo/icon PNG, JPG, WEBP hoặc SVG. Nên dùng ảnh vuông 128×128 hoặc 256×256." />
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Nhóm">
              <select
                className="inp"
                value={appGroups.includes(edit.category) ? edit.category : "__CUSTOM__"}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__CUSTOM__") {
                    setEdit({ ...edit, category: edit.category && !appGroups.includes(edit.category) ? edit.category : "" });
                  } else {
                    setEdit({ ...edit, category: value });
                  }
                }}
              >
                {appGroups.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__CUSTOM__">+ Nhóm khác / Tự nhập</option>
              </select>
              {(!appGroups.includes(edit.category) || edit.category === "") && (
                <input
                  className="inp"
                  style={{ marginTop: 8 }}
                  value={edit.category || ""}
                  onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                  placeholder="Nhập tên nhóm mới, ví dụ: Chuyển đổi số"
                  maxLength={60}
                  autoFocus
                />
              )}
            </Field>
            <Field label="Màu biểu tượng">
              <input className="inp" type="color" value={edit.color || RED} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ height: 42, padding: 4 }} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================== 6. QUẢN LÝ TÀI LIỆU */

export function AdminDocs() {
  const { rows, loading, error, reload } = useAdminList("/api/documents");
  const { rows: nhomTaiLieu } = useAdminList("/api/admin/document-categories");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (edit.id) await api.put(`/api/admin/documents/${edit.id}`, edit);
      else await api.post("/api/admin/documents", edit);
      setEdit(null); reload();
    } catch (e) { window.alert(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Chuyển tài liệu "${r.title}" vào thùng rác?\n\nQuản trị viên có thể khôi phục trong vòng 30 ngày, sau đó sẽ tự động xoá hẳn.`)) return;
    await api.del(`/api/admin/documents/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Quản lý tài liệu" onReload={reload} addLabel="Thêm tài liệu"
        onAdd={() => setEdit({ title: "", code: "", category: "Quy trình", file_url: "", size_label: "", content_text: "", updated_on: new Date().toISOString().slice(0, 10) })}
        hint="Trường Từ khoá tìm kiếm quyết định việc anh em có tìm ra tài liệu hay không — nên ghi đầy đủ." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
        {rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th style={{ minWidth: 260 }}>Tài liệu</th><th>Số hiệu</th><th>Nhóm</th><th>Cập nhật</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="flex items-center gap-2.5" style={{ border: 0 }}>
                      <FileText size={16} style={{ color: RED }} />
                      <span style={{ fontWeight: 600 }}>{r.title}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{r.code}</td>
                    <td><span className="tag tag-grey">{r.category}</span></td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{iso(r.updated_on).split("-").reverse().join("/")}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setEdit({ ...r, updated_on: iso(r.updated_on) })}><Edit3 size={13} /> Sửa</button>{" "}
                      <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && (
        <Modal wide title={edit.id ? "Sửa tài liệu" : "Thêm tài liệu"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          <Field label="Tên tài liệu"><input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Số hiệu văn bản"><input className="inp" value={edit.code || ""} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="QT-VHKT-01" /></Field>
            <Field label="Nhóm tài liệu">
              <select className="inp" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                {(nhomTaiLieu.length ? nhomTaiLieu : ["Quy trình", "Văn bản"]).map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Dung lượng hiển thị"><input className="inp" value={edit.size_label || ""} onChange={(e) => setEdit({ ...edit, size_label: e.target.value })} placeholder="2,4 MB" /></Field>
            <Field label="Ngày cập nhật"><input className="inp" type="date" value={edit.updated_on || ""} onChange={(e) => setEdit({ ...edit, updated_on: e.target.value })} /></Field>
          </div>
          <Field label="Đường dẫn tệp (Google Drive hoặc thư mục nội bộ)">
            <input className="inp" value={edit.file_url || ""} onChange={(e) => setEdit({ ...edit, file_url: e.target.value })} placeholder="https://drive.google.com/..." />
          </Field>
          <Field label="Từ khoá tìm kiếm toàn văn">
            <textarea className="inp" rows={3} value={edit.content_text || ""} onChange={(e) => setEdit({ ...edit, content_text: e.target.value })}
              placeholder="Liệt kê các từ anh em hay gõ khi tìm: xăng dầu, định mức, nhiên liệu, xe công tác…" />
          </Field>
        </Modal>
      )}
    </div>
  );
}

/* ============================================ 7. QUẢN LÝ NHÂN VIÊN */

export function AdminPeople() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/people");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!edit.full_name?.trim()) { window.alert("Chưa nhập họ tên."); return; }
    setSaving(true);
    try {
      const payload = { ...edit, birthday: edit.birthday || null };
      if (edit.id) await api.put(`/api/admin/people/${edit.id}`, payload);
      else await api.post("/api/admin/people", payload);
      setEdit(null); reload();
    } catch (e) { window.alert(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá "${r.full_name}" khỏi danh sách?`)) return;
    await api.del(`/api/admin/people/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob("/api/admin/people/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "danh-sach-nhan-vien.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { window.alert(e.message); }
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Quản lý nhân viên" onReload={reload} addLabel="Thêm nhân viên"
        onAdd={() => setEdit({ full_name: "", role: "", dept: "Phòng Vận hành khai thác", phone: "", email: "", birthday: "", color: RED, active: true })}
        onExport={exportCsv}
        hint="Ngày sinh nhập ở đây sẽ tự hiện ở mục Sinh nhật trên trang chủ và Góc văn hoá." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
        {rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Họ và tên</th><th>Chức vụ</th><th>Đơn vị</th><th>Điện thoại</th><th>Ngày sinh</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{r.role}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{r.dept}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{r.phone}</td>
                    <td className="mono muted" style={{ fontSize: 12 }}>
                      {r.birthday ? iso(r.birthday).split("-").reverse().join("/") : "—"}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setEdit({ ...r, birthday: iso(r.birthday) })}><Edit3 size={13} /> Sửa</button>{" "}
                      <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && (
        <Modal wide title={edit.id ? "Sửa thông tin nhân viên" : "Thêm nhân viên"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Họ và tên"><input className="inp" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></Field>
            <Field label="Chức vụ"><input className="inp" value={edit.role || ""} onChange={(e) => setEdit({ ...edit, role: e.target.value })} /></Field>
            <Field label="Đơn vị / phòng ban"><input className="inp" value={edit.dept || ""} onChange={(e) => setEdit({ ...edit, dept: e.target.value })} /></Field>
            <Field label="Số điện thoại"><input className="inp" value={edit.phone || ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Thư điện tử"><input className="inp" value={edit.email || ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Ngày sinh"><input className="inp" type="date" value={edit.birthday || ""} onChange={(e) => setEdit({ ...edit, birthday: e.target.value })} /></Field>
            <ImagePicker label="Ảnh nhân viên" value={edit.photo_url || ""}
              onChange={(url) => setEdit({ ...edit, photo_url: url })}
              hint="Để trống sẽ hiện chữ cái đầu của tên." />
            <Field label="Màu đại diện"><input className="inp" type="color" value={edit.color || RED} onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ height: 42, padding: 4 }} /></Field>
          </div>
          <CheckBox label="Đang công tác" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
        </Modal>
      )}
    </div>
  );
}

/* ==================================== 8. GÓC VĂN HOÁ: SỰ KIỆN & SINH NHẬT */

export function AdminCulture() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/events?kind=culture");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...edit, kind: "culture", start_at: new Date(edit.start_at).toISOString() };
      if (edit.id) await api.put(`/api/admin/events/${edit.id}`, payload);
      else await api.post("/api/admin/events", payload);
      setEdit(null); reload();
    } catch (e) { window.alert(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá sự kiện "${r.title}"?`)) return;
    await api.del(`/api/admin/events/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Góc văn hoá: sự kiện" onReload={reload} addLabel="Thêm sự kiện"
        onAdd={() => setEdit({ title: "", start_at: new Date().toISOString().slice(0, 16), place: "", host: "" })}
        hint="Sinh nhật lấy tự động từ ngày sinh trong mục Quản lý nhân viên — sửa ở đó thì Góc văn hoá cập nhật theo." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0} />
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3" style={{ padding: "13px 16px", borderTop: i ? "1px solid #F1EEEF" : 0 }}>
            <Calendar size={17} style={{ color: RED, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</p>
              <p className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>
                {isoLocal(r.start_at).replace("T", " · ")} · {r.place}
              </p>
            </div>
            <button className="btn btn-sm" onClick={() => setEdit({ ...r, start_at: isoLocal(r.start_at) })}><Edit3 size={13} /> Sửa</button>
            <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
          </div>
        ))}
      </Card>

      <div className="card flex items-start gap-3" style={{ padding: 14 }}>
        <AlertCircle size={17} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
        <p className="dim" style={{ fontSize: 13 }}>
          Danh sách sinh nhật không nhập tại đây. Vào <strong>Quản lý nhân viên</strong>, điền ô Ngày sinh
          cho từng người là mục Sinh nhật tự cập nhật.
        </p>
      </div>

      {edit && (
        <Modal title={edit.id ? "Sửa sự kiện" : "Thêm sự kiện"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          <Field label="Tên sự kiện"><input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          <Field label="Thời gian"><input className="inp" type="datetime-local" value={edit.start_at} onChange={(e) => setEdit({ ...edit, start_at: e.target.value })} /></Field>
          <Field label="Địa điểm"><input className="inp" value={edit.place || ""} onChange={(e) => setEdit({ ...edit, place: e.target.value })} /></Field>
          <Field label="Đơn vị tổ chức"><input className="inp" value={edit.host || ""} onChange={(e) => setEdit({ ...edit, host: e.target.value })} /></Field>
          <MeetingFields edit={edit} setEdit={setEdit} />
        </Modal>
      )}
    </div>
  );
}

/* ============================================= 9. CẤU HÌNH WEBSITE */

function ConfigEditor({ keys, title, hint, children }) {
  const [values, setValues] = useState({});
  const [meta, setMeta] = useState([]);
  const [state, setState] = useState("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/api/admin/config")
      .then((rows) => {
        setMeta(rows);
        setValues(Object.fromEntries(rows.map((r) => [r.key, r.value || ""])));
        setState("ready");
      })
      .catch((e) => { setMsg(e.message); setState("error"); });
  }, []);

  const list = keys || meta.map((m) => [m.key, m.label || m.key, m.kind || "text"]);

  const save = async () => {
    setState("saving"); setMsg("");
    const payload = Object.fromEntries(list.map(([k]) => [k, values[k] ?? ""]));
    try {
      await api.put("/api/admin/config", { values: payload });
      setMsg("Đã lưu. Tải lại trang để thấy thay đổi trên toàn bộ cổng thông tin.");
    } catch (e) { setMsg(e.message); }
    setState("ready");
  };

  if (state === "loading") return <Empty title="Đang tải cấu hình…" />;
  if (state === "error") return <Empty title="Không tải được cấu hình." hint={msg} />;

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title={title} hint={hint} />
      <Card>
        {list.map(([key, label, kind]) => (
          <Field key={key} label={label}>
            {kind === "textarea"
              ? <textarea className="inp" rows={4} value={values[key] || ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
              : kind === "color"
                ? <input className="inp" type="color" value={values[key] || RED} onChange={(e) => setValues({ ...values, [key]: e.target.value })} style={{ height: 42, padding: 4 }} />
                : <input className="inp" value={values[key] || ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />}
          </Field>
        ))}
        {children}
        {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{msg}</p>}
        <button className="btn btn-red" onClick={save} disabled={state === "saving"}>
          <Save size={15} /> {state === "saving" ? "Đang lưu…" : "Lưu cấu hình"}
        </button>
      </Card>
    </div>
  );
}

const SITE_KEYS = [
  ["site_title", "Tên đầy đủ của cổng thông tin", "textarea"],
  ["site_short", "Tên rút gọn (hiện ở góc trái)", "text"],
  ["site_dept", "Tên phòng", "text"],
  ["site_branch", "Tên chi nhánh", "text"],
  ["support_name", "Người phụ trách cổng thông tin", "text"],
  ["support_role", "Đơn vị phụ trách", "text"],
  ["support_phone", "Số điện thoại liên hệ", "text"],
  ["guide_url", "Đường dẫn tài liệu hướng dẫn sử dụng", "text"],
];

export function AdminConfig() {
  return (
    <div className="flex flex-col gap-4">
      <ConfigEditor keys={SITE_KEYS} title="Cấu hình website"
        hint="Những thông tin chung hiện trên toàn bộ cổng thông tin." />
      <DataCenter />
    </div>
  );
}

/* ================================ Dữ liệu và tài liệu hướng dẫn */

export function DataCenter() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/api/admin/database/info").then(setInfo).catch((e) => setErr(e.message));
  }, []);

  const download = () => {
    // Tải kèm token đăng nhập nên phải lấy về dạng nhị phân rồi tự lưu
    api.blob("/api/admin/database/download")
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename || "portal.db"; a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => window.alert(e.message));
  };

  return (
    <Card title="Dữ liệu và tài liệu hướng dẫn" icon={Database}>
      {err && <p className="muted" style={{ fontSize: 13 }}>{err}</p>}

      {info && (
        <>
          <div className="grid sm:grid-cols-3 gap-3" style={{ marginBottom: 16 }}>
            <div style={{ padding: 12, background: "#F8F6F6", borderRadius: 11 }}>
              <p className="eyebrow-grey" style={{ fontSize: 10 }}>Loại cơ sở dữ liệu</p>
              <p style={{ fontWeight: 700, marginTop: 4 }}>{info.engine}</p>
            </div>
            <div style={{ padding: 12, background: "#F8F6F6", borderRadius: 11 }}>
              <p className="eyebrow-grey" style={{ fontSize: 10 }}>Dung lượng</p>
              <p className="mono" style={{ fontWeight: 700, marginTop: 4 }}>{info.size_kb ? `${info.size_kb} KB` : "—"}</p>
            </div>
            <div style={{ padding: 12, background: "#F8F6F6", borderRadius: 11 }}>
              <p className="eyebrow-grey" style={{ fontSize: 10 }}>Vị trí tệp</p>
              <p className="mono" style={{ fontSize: 11.5, marginTop: 4, wordBreak: "break-all" }}>{info.path || "Trong máy chủ PostgreSQL"}</p>
            </div>
          </div>

          <p className="eyebrow-grey" style={{ marginBottom: 8 }}>Số bản ghi hiện có</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" style={{ marginBottom: 16 }}>
            {Object.entries(info.counts).map(([k, v]) => (
              <div key={k} style={{ padding: "8px 10px", border: "1px solid #E7E3E4", borderRadius: 9 }}>
                <p className="muted" style={{ fontSize: 11 }}>{k}</p>
                <p className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{v}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {info.downloadable
              ? <button className="btn btn-red" onClick={download}><Download size={15} /> Tải tệp cơ sở dữ liệu</button>
              : <span className="muted" style={{ fontSize: 12.5 }}>Đang dùng PostgreSQL — sao lưu bằng lệnh <code>bash backup.sh</code> trên máy chủ.</span>}
            <a className="btn" href="/docs" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <BookOpen size={15} /> Tài liệu API
            </a>
          </div>
        </>
      )}

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #E7E3E4" }}>
        <p className="eyebrow-grey" style={{ marginBottom: 10 }}>Tài liệu hướng dẫn kèm theo bộ mã nguồn</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
          <li><code>README.md</code> — hướng dẫn triển khai đầy đủ cho người mới</li>
          <li><code>windows/HUONG-DAN-CHAY-TREN-MAY-TINH.md</code> — chạy trên máy tính cá nhân, dữ liệu ổ D</li>
          <li><code>windows/3-CAU-HINH.txt</code> — đổi ổ lưu, đổi cổng, mở tường lửa</li>
          <li><code>deploy.sh</code>, <code>backup.sh</code>, <code>restore.sh</code> — cài đặt và sao lưu trên máy chủ</li>
        </ul>
      </div>
    </Card>
  );
}

/* ========================================= Cài đặt thông báo */

export function AdminNotifications() {
  const [data, setData] = useState(null);
  const [values, setValues] = useState({
    telegram_bot_token: "", telegram_chat_id: "",
    notify_email_on: true, notify_telegram_on: true, notify_bell_on: true,
  });
  const [state, setState] = useState("loading");
  const [msg, setMsg] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);

  const load = () => {
    setState("loading");
    api.get("/api/admin/notifications/settings")
      .then((d) => {
        setData(d);
        setValues({
          telegram_bot_token: d.telegram_bot_token || "",
          telegram_chat_id: d.telegram_chat_id || "",
          notify_email_on: d.notify_email_on,
          notify_telegram_on: d.notify_telegram_on,
          notify_bell_on: d.notify_bell_on,
        });
        setState("ready");
      })
      .catch((e) => { setMsg(e.message); setState("error"); });
  };
  useEffect(load, []);

  const save = async () => {
    setState("saving"); setMsg(""); setTestMsg("");
    try {
      const d = await api.put("/api/admin/notifications/settings", values);
      setData(d);
      setMsg("Đã lưu cấu hình thông báo.");
    } catch (e) { setMsg(e.message); }
    setState("ready");
  };

  const testTelegram = async () => {
    setTesting(true); setTestMsg("");
    try {
      await api.post("/api/admin/notifications/test-telegram");
      setTestMsg("Đã gửi tin nhắn thử — kiểm tra Telegram.");
    } catch (e) { setTestMsg(e.message); }
    setTesting(false);
  };

  if (state === "loading") return <Empty title="Đang tải cấu hình…" />;
  if (state === "error") return <Empty title="Không tải được cấu hình." hint={msg} />;

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Cài đặt thông báo"
        hint="Bật/tắt từng kênh và cấu hình gửi qua Telegram khi có thao tác nhạy cảm: sửa/xoá bản tin, đổi cấu hình website." />

      <Card title="Kênh gửi thông báo" icon={BellRing}>
        <SwitchRow label="Chuông thông báo trong ứng dụng"
          hint="Hiện chuông cảnh báo ở đầu trang cho quản trị viên."
          checked={values.notify_bell_on}
          onChange={(v) => setValues({ ...values, notify_bell_on: v })} />
        <SwitchRow label="Gửi email"
          hint={data?.email_configured ? "Đã cấu hình SMTP." : "Chưa cấu hình SMTP (biến môi trường trên máy chủ) — bật cũng sẽ không gửi được."}
          checked={values.notify_email_on}
          onChange={(v) => setValues({ ...values, notify_email_on: v })} />
        <SwitchRow label="Gửi qua Telegram"
          hint={data?.telegram_configured ? "Đã nhập Bot token và Chat ID." : "Chưa nhập đủ Bot token và Chat ID bên dưới."}
          checked={values.notify_telegram_on}
          onChange={(v) => setValues({ ...values, notify_telegram_on: v })} />
      </Card>

      <Card title="Cấu hình Telegram" icon={Send}>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
          Tạo bot qua @BotFather trên Telegram để lấy Bot token, nhắn thử cho bot (hoặc thêm bot vào
          nhóm) rồi mở đường dẫn https://api.telegram.org/bot&lt;token&gt;/getUpdates để lấy Chat ID.
        </p>
        <Field label="Bot token">
          <input className="inp" value={values.telegram_bot_token}
            onChange={(e) => setValues({ ...values, telegram_bot_token: e.target.value })}
            placeholder="123456789:AAExampleTokenFromBotFather" />
        </Field>
        <Field label="Chat ID">
          <input className="inp" value={values.telegram_chat_id}
            onChange={(e) => setValues({ ...values, telegram_chat_id: e.target.value })}
            placeholder="-1001234567890" />
        </Field>

        {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{msg}</p>}
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-red" onClick={save} disabled={state === "saving"}>
            <Save size={15} /> {state === "saving" ? "Đang lưu…" : "Lưu cấu hình"}
          </button>
          <button className="btn" onClick={testTelegram} disabled={testing}>
            <Send size={15} /> {testing ? "Đang gửi…" : "Gửi thử Telegram"}
          </button>
        </div>
        {testMsg && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{testMsg}</p>}
      </Card>
    </div>
  );
}

/* ==================================== QUẢN LÝ DASHBOARD — THÊM THỦ CÔNG */

const DASHBOARD_BOARDS = [
  { value: "PAKH", label: "Sự cố truyền dẫn (theo tỉnh)" },
  { value: "PAKH_TARGET", label: "Chỉ tiêu/Target Sự cố truyền dẫn" },
  { value: "FUEL", label: "Ksub*min (theo tỉnh)" },
  { value: "FUEL_TARGET", label: "Chỉ tiêu/Target Ksub*min" },
  { value: "OUTPUT", label: "GĐTT & Cell*h tổng (theo tỉnh)" },
  { value: "OUTPUT_TARGET", label: "Chỉ tiêu/Target GĐTT & Cell*h" },
  { value: "NETWORK", label: "XLCS CĐBR (Số PA phát sinh, XLCS 3h/10h/24h)" },
  { value: "NETWORK_TARGET", label: "Chỉ tiêu/Target XLCS CĐBR" },
  { value: "VHKT", label: "TKM CĐBR (Triển khai mới, KPI TKM 3h/10h/24h)" },
  { value: "VHKT_TARGET", label: "Chỉ tiêu/Target TKM CĐBR" },
  { value: "KPI", label: "Tiền phạt & Doanh thu" },
  { value: "KPI_TARGET", label: "Chỉ tiêu/Target Tiền phạt & Doanh thu" },
  { value: "KPI_VTNET", label: "Nguyên nhân phạt — nhóm VTNet" },
  { value: "KPI_VTT", label: "Nguyên nhân phạt — nhóm VTT" },
  { value: "WO", label: "Rời mạng CĐBR (tỷ lệ / số lượng KH)" },
  { value: "WO_TARGET", label: "Chỉ tiêu/Target Rời mạng CĐBR" },
  { value: "WO_TINH", label: "Rời mạng CĐBR — số lượng theo tỉnh" },
  { value: "WO_HUYEN_BD", label: "Rời mạng CĐBR — theo huyện (Bình Dương)" },
  { value: "WO_HUYEN_BRVT", label: "Rời mạng CĐBR — theo huyện (Bà Rịa - Vũng Tàu)" },
];

const boardsOf = (...ma) => DASHBOARD_BOARDS.filter((b) => ma.includes(b.value));

// Mỗi tab Dashboard có màn "Nhập từ Excel" riêng, chỉ gồm đúng các bảng của tab đó
// — tách biệt để tránh nhầm dữ liệu giữa các tab khi nhập hàng loạt.
const DASHBOARD_IMPORT_TABS = [
  { id: "kpi", label: "Tiền phạt & Doanh thu", boards: boardsOf("KPI", "KPI_TARGET", "KPI_VTNET", "KPI_VTT") },
  { id: "wo", label: "Rời mạng CĐBR", boards: boardsOf("WO", "WO_TARGET", "WO_TINH", "WO_HUYEN_BD", "WO_HUYEN_BRVT") },
  { id: "pakh", label: "Sự cố truyền dẫn", boards: boardsOf("PAKH", "PAKH_TARGET") },
  { id: "fuel", label: "Ksub*min", boards: boardsOf("FUEL", "FUEL_TARGET") },
  { id: "output", label: "GĐTT & Cell*h", boards: boardsOf("OUTPUT", "OUTPUT_TARGET") },
  { id: "network", label: "XLCS CĐBR", boards: boardsOf("NETWORK", "NETWORK_TARGET") },
  { id: "vhkt", label: "TKM CĐBR", boards: boardsOf("VHKT", "VHKT_TARGET") },
];

const blankMetric = { board: "KPI", period: "", label: "", unit_name: "", value: "" };

export function AdminMetrics() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/metrics");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filterTab, setFilterTab] = useState("");
  const [filterBoard, setFilterBoard] = useState("");
  const [search, setSearch] = useState("");

  const boardLabel = (v) => DASHBOARD_BOARDS.find((b) => b.value === v)?.label || v;
  const tabOf = (id) => DASHBOARD_IMPORT_TABS.find((t) => t.id === id);
  const tabBoardCodes = (id) => (tabOf(id)?.boards || []).map((b) => b.value);

  const filteredRows = useMemo(() => {
    let r = rows;
    if (filterTab) { const ma = tabBoardCodes(filterTab); r = r.filter((x) => ma.includes(x.board)); }
    else if (filterBoard) r = r.filter((x) => x.board === filterBoard);
    const term = search.trim().toLowerCase();
    if (term) r = r.filter((x) => [x.period, x.label, x.unit_name].filter(Boolean).join(" ").toLowerCase().includes(term));
    return r;
  }, [rows, filterTab, filterBoard, search]);

  const save = async () => {
    if (!edit.board) { setMsg("Chưa chọn bảng."); return; }
    if (!edit.period?.trim()) { setMsg("Chưa nhập kỳ (ví dụ 2026-08)."); return; }
    if (!edit.label?.trim()) { setMsg("Chưa nhập tên chỉ tiêu."); return; }
    if (edit.value === "" || edit.value == null || isNaN(Number(edit.value))) { setMsg("Giá trị phải là số."); return; }
    setSaving(true); setMsg("");
    try {
      const payload = { ...edit, value: Number(edit.value) };
      if (edit.id) await api.put(`/api/admin/metrics/${edit.id}`, payload);
      else await api.post("/api/admin/metrics", payload);
      setEdit(null); reload();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá "${r.label}" (${r.period})?`)) return;
    await api.del(`/api/admin/metrics/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  const exportCsv = async () => {
    try {
      let qs = "";
      if (filterTab) {
        const tab = tabOf(filterTab);
        qs = `?board=${encodeURIComponent(tabBoardCodes(filterTab).join(","))}&nhom=${encodeURIComponent(tab.label)}`;
      } else if (filterBoard) {
        qs = `?board=${encodeURIComponent(filterBoard)}`;
      }
      const { blob, filename } = await api.blob(`/api/admin/metrics/export${qs}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "so-lieu-dashboard.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { window.alert(e.message); }
  };

  const exportLabel = filterTab ? `Xuất "${tabOf(filterTab)?.label}"`
    : filterBoard ? `Xuất "${boardLabel(filterBoard)}"` : "Xuất tất cả";

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Số liệu Dashboard" onReload={reload} addLabel="Thêm chỉ số"
        onAdd={() => { setEdit({ ...blankMetric }); setMsg(""); }}
        onExport={exportCsv} exportLabel={exportLabel}
        hint="Kỳ nhập dạng YYYY-MM, ví dụ 2026-08. Đặt cùng tên chỉ tiêu + cùng kỳ ở bảng Target thì Dashboard tự đối chiếu.
              Xuất báo cáo để lấy đúng khuôn cột nhập Excel — sửa/lọc trong Excel rồi nhập ngược lên sẽ ghi đè đúng dòng cũ.
              Chọn Hạng mục dashboard để xuất gộp đúng các bảng của một tab (khớp tên tab trên Dashboard)." />

      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <select className="inp" style={{ maxWidth: 260 }} value={filterTab}
          onChange={(e) => { setFilterTab(e.target.value); setFilterBoard(""); }}>
          <option value="">Hạng mục dashboard (theo tab)…</option>
          {DASHBOARD_IMPORT_TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select className="inp" style={{ maxWidth: 260 }} value={filterBoard}
          onChange={(e) => { setFilterBoard(e.target.value); setFilterTab(""); }}>
          <option value="">Tất cả các bảng</option>
          {DASHBOARD_BOARDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
        <input className="inp" style={{ maxWidth: 260 }} placeholder="🔎 Tìm theo kỳ / chỉ tiêu / đơn vị…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && filteredRows.length === 0} />
        {filteredRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr><th>Bảng</th><th>Kỳ</th><th>Chỉ tiêu</th><th>Đơn vị</th><th style={{ textAlign: "right" }}>Giá trị</th><th style={{ textAlign: "right" }}>Thao tác</th></tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="tag tag-grey">{boardLabel(r.board)}</span></td>
                    <td className="mono">{r.period}</td>
                    <td style={{ fontWeight: 600 }}>{r.label}</td>
                    <td className="muted">{r.unit_name || "—"}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{r.value?.toLocaleString("vi-VN")}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => setEdit({ ...r, value: String(r.value) })}><Edit3 size={13} /> Sửa</button>{" "}
                      <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && (
        <Modal title={edit.id ? "Sửa chỉ số" : "Thêm chỉ số"} saving={saving} onSave={save} onClose={() => setEdit(null)}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}
          <Field label="Bảng">
            <select className="inp" value={edit.board} onChange={(e) => setEdit({ ...edit, board: e.target.value })}>
              {DASHBOARD_BOARDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Kỳ (YYYY-MM)"><input className="inp" value={edit.period || ""} onChange={(e) => setEdit({ ...edit, period: e.target.value })} placeholder="2026-08" /></Field>
          <Field label="Tên chỉ tiêu"><input className="inp" value={edit.label || ""} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="Cell*h" /></Field>
          <Field label="Đơn vị / trung tâm (nếu có)"><input className="inp" value={edit.unit_name || ""} onChange={(e) => setEdit({ ...edit, unit_name: e.target.value })} placeholder="Trung tâm Thới Hòa" /></Field>
          <Field label="Giá trị"><input className="inp" type="number" value={edit.value ?? ""} onChange={(e) => setEdit({ ...edit, value: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------- Danh mục khu quản trị */

export const ADMIN_PAGES = [
  { id: "adm-notice", label: "Quản lý thông báo", icon: Bell, comp: AdminNotices, module: "notices",
    group: "content", groupLabel: "Nội dung trang chủ", groupIcon: ImageIcon },
  { id: "adm-media", label: "Album ảnh và video", icon: Images, comp: AdminMedia, module: "media",
    group: "content", groupLabel: "Nội dung trang chủ", groupIcon: ImageIcon },
  { id: "adm-banner", label: "Banner", icon: ImageIcon, comp: AdminBanners, module: "banners",
    group: "content", groupLabel: "Nội dung trang chủ", groupIcon: ImageIcon },
  { id: "adm-director", label: "Thông điệp Giám đốc", icon: MessageSquare, comp: AdminDirector, adminOnly: true,
    group: "content", groupLabel: "Nội dung trang chủ", groupIcon: ImageIcon },
  { id: "adm-apps", label: "Quản lý ứng dụng", icon: Rocket, comp: AdminApps, module: "apps" },
  { id: "adm-docs", label: "Quản lý tài liệu", icon: BookOpen, comp: AdminDocs, module: "documents" },
  { id: "adm-people", label: "Danh sách nhân viên", icon: Users, comp: AdminPeople, module: "people",
    group: "people", groupLabel: "Quản lý nhân viên", groupIcon: Users },
  { id: "adm-people-import", label: "Nhập từ Excel", icon: Upload, comp: () => <AdminImport fixedKind="people" />, module: "people",
    group: "people", groupLabel: "Quản lý nhân viên", groupIcon: Users },
  { id: "adm-incidents", label: "Danh sách sự cố", icon: AlertCircle, comp: AdminOperations, module: "operations",
    group: "ops", groupLabel: "Sự cố kỹ thuật", groupIcon: AlertCircle },
  { id: "adm-incidents-import", label: "Nhập sự cố", icon: Upload, comp: () => <AdminImport fixedKind="incidents" />, module: "operations",
    group: "ops", groupLabel: "Sự cố kỹ thuật", groupIcon: AlertCircle },
  { id: "adm-work-orders", label: "WO chi tiết", icon: FileText, comp: AdminWorkOrders, module: "operations",
    group: "ops", groupLabel: "Sự cố kỹ thuật", groupIcon: AlertCircle },
  { id: "adm-wo-import", label: "Nhập WO", icon: Upload, comp: () => <AdminImport fixedKind="work_orders" />, module: "operations",
    group: "ops", groupLabel: "Sự cố kỹ thuật", groupIcon: AlertCircle },
  { id: "adm-handovers", label: "Bàn giao ca", icon: CalendarClock, comp: AdminHandovers, module: "operations",
    group: "ops", groupLabel: "Sự cố kỹ thuật", groupIcon: AlertCircle },
  { id: "adm-handovers-import", label: "Nhập bàn giao", icon: Upload, comp: () => <AdminImport fixedKind="handovers" />, module: "operations",
    group: "ops", groupLabel: "Sự cố kỹ thuật", groupIcon: AlertCircle },
  { id: "adm-duty-roster", label: "Thêm thủ công", icon: Calendar, comp: AdminDutyRoster, module: "duty_roster",
    group: "duty", groupLabel: "Lịch trực vận hành", groupIcon: Calendar },
  { id: "adm-duty-roster-import", label: "Nhập từ Excel", icon: Upload, comp: AdminDutyRosterImport, module: "duty_roster",
    group: "duty", groupLabel: "Lịch trực vận hành", groupIcon: Calendar },
  { id: "adm-recruitment", label: "Ứng viên", icon: Briefcase, comp: AdminCandidates, module: "recruitment",
    group: "recruit", groupLabel: "Quản lý tuyển dụng", groupIcon: Briefcase },
  { id: "adm-recruitment-import", label: "Nhập ứng viên", icon: Upload, comp: () => <AdminImport fixedKind="candidates" />, module: "recruitment",
    group: "recruit", groupLabel: "Quản lý tuyển dụng", groupIcon: Briefcase },
  { id: "adm-staffing", label: "Định biên thiếu trung tâm", icon: Building2, comp: AdminStaffing, module: "recruitment",
    group: "recruit", groupLabel: "Quản lý tuyển dụng", groupIcon: Briefcase },
  { id: "adm-staffing-import", label: "Nhập định biên", icon: Upload, comp: () => <AdminImport fixedKind="center_staffing" />, module: "recruitment",
    group: "recruit", groupLabel: "Quản lý tuyển dụng", groupIcon: Briefcase },
  { id: "adm-schedule", label: "Thêm thủ công", icon: CalendarClock, comp: AdminSchedule, module: "events",
    group: "schedule", groupLabel: "Lịch công tác tuần", groupIcon: CalendarClock },
  { id: "adm-schedule-import", label: "Nhập từ Excel", icon: Upload, comp: () => <AdminImport fixedKind="schedule" />, module: "events",
    group: "schedule", groupLabel: "Lịch công tác tuần", groupIcon: CalendarClock },
  { id: "adm-dashboard-manual", label: "Thêm thủ công", icon: Table2, comp: AdminMetrics, module: "import",
    group: "dashboard", groupLabel: "Quản lý dashboard", groupIcon: Table2 },
  ...DASHBOARD_IMPORT_TABS.map((tab) => ({
    id: `adm-dashboard-import-${tab.id}`, label: `Nhập Excel — ${tab.label}`, icon: Upload,
    comp: () => <AdminImport fixedKind="metrics" boardScope={tab.boards} />, module: "import",
    group: "dashboard", groupLabel: "Quản lý dashboard", groupIcon: Table2,
  })),
  { id: "adm-sheets", label: "Nguồn dữ liệu Sheet", icon: Database, comp: AdminSheets, module: "sheets",
    group: "sysconfig", groupLabel: "Cấu hình website", groupIcon: Settings },
  { id: "adm-users", label: "Danh sách tài khoản", icon: UserCog, comp: AdminUsers, adminOnly: true,
    group: "account", groupLabel: "Quản lý tài khoản", groupIcon: UserCog },
  { id: "adm-users-import", label: "Nhập từ Excel", icon: Upload, comp: () => <AdminImport fixedKind="users" />, adminOnly: true,
    group: "account", groupLabel: "Quản lý tài khoản", groupIcon: UserCog },
  { id: "adm-logs", label: "Nhật ký hệ thống", icon: History, comp: AdminLogs, adminOnly: true,
    group: "sysconfig", groupLabel: "Cấu hình website", groupIcon: Settings },
  { id: "adm-trash", label: "Thùng rác", icon: Trash, comp: AdminTrash, adminOnly: true,
    group: "sysconfig", groupLabel: "Cấu hình website", groupIcon: Settings },
  { id: "adm-check", label: "Kiểm tra hệ thống", icon: Stethoscope, comp: AdminDiagnostics, adminOnly: true,
    group: "sysconfig", groupLabel: "Cấu hình website", groupIcon: Settings },
  { id: "adm-config", label: "Cấu hình chung", icon: Settings, comp: AdminConfig, adminOnly: true,
    group: "sysconfig", groupLabel: "Cấu hình website", groupIcon: Settings },
  { id: "adm-notifications", label: "Cài đặt thông báo", icon: BellRing, comp: AdminNotifications, adminOnly: true,
    group: "sysconfig", groupLabel: "Cấu hình website", groupIcon: Settings },
];

/* ========================================== 10. QUẢN LÝ TÀI KHOẢN */

const ROLE_HINTS = {
  admin: "Toàn quyền: quản lý nội dung, tài khoản và cấu hình website.",
  editor: "Mặc định chỉ đăng bài (Tin tức) và Tài liệu. Quản trị viên có thể mở thêm module khác riêng cho từng tài khoản ở bảng bên dưới.",
  staff: "Mặc định không vào khu quản trị. Chỉ xem, bình chọn sáng kiến và đăng bài thảo luận.",
};

const ROLE_TAG = { admin: "tag-red", editor: "tag-amber", staff: "tag-grey" };

const ACTION_LABELS = { view: "Xem", create: "Thêm", update: "Sửa", delete: "Xóa" };

/** Cấp quyền theo từng thao tác của từng mục menu quản trị. */
function PermissionMatrix({ role, modules, roleDefaults, value, onChange }) {
  if (role === "admin") {
    return (
      <p className="dim" style={{ fontSize: 12.5, background: "#FBF4F5", padding: "9px 12px", borderRadius: 9 }}>
        Quản trị viên luôn có toàn quyền trên mọi module, không cần chọn riêng.
      </p>
    );
  }
  const matrix = value || {};
  const defaults = roleDefaults?.[role] || {};
  const toggle = (moduleId, action) => {
    const next = { ...matrix };
    const actions = new Set(next[moduleId] || []);
    if (actions.has(action)) actions.delete(action); else actions.add(action);
    // Không thể thao tác ở một mục mà không nhìn thấy mục đó trong menu trái.
    if (action !== "view" && actions.has(action)) actions.add("view");
    if (action === "view" && !actions.has("view")) actions.clear();
    if (actions.size) next[moduleId] = ["view", "create", "update", "delete"].filter((a) => actions.has(a));
    else delete next[moduleId];
    onChange(next);
  };
  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <p className="eyebrow-grey">Quyền theo mục menu quản trị</p>
        <button type="button" className="btn btn-sm" onClick={() => onChange({ ...defaults })}>
          Đặt lại về mặc định của quyền
        </button>
      </div>
      <p className="dim" style={{ fontSize: 12, margin: "0 0 9px" }}>Bỏ quyền Xem sẽ ẩn mục đó ở menu trái. Thêm, Sửa và Xóa luôn tự kèm quyền Xem.</p>
      <div style={{ overflowX: "auto", border: "1px solid #E7E3E4", borderRadius: 9 }}>
        <table className="tbl" style={{ minWidth: 560 }}>
          <thead><tr><th>Mục menu</th>{["view", "create", "update", "delete"].map((a) => <th key={a} style={{ textAlign: "center" }}>{ACTION_LABELS[a]}</th>)}</tr></thead>
          <tbody>
        {modules.map((m) => (
          <tr key={m.id}>
            <td>{m.label}</td>
            {["view", "create", "update", "delete"].map((action) => (
              <td key={action} style={{ textAlign: "center" }}>
                <input type="checkbox" checked={(matrix[m.id] || []).includes(action)} onChange={() => toggle(m.id, action)} aria-label={`${ACTION_LABELS[action]} ${m.label}`} />
              </td>
            ))}
          </tr>
        ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminUsers() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/users");
  const { rows: people } = useAdminList("/api/admin/people");
  const { rows: quyenTuMayChu } = useAdminList("/api/admin/roles");
  const [modInfo, setModInfo] = useState({ modules: [], role_defaults: {} });
  const [edit, setEdit] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const term = norm(search.trim());
    if (!term) return rows;
    return rows.filter((r) => norm([r.username, r.full_name, r.role_label, r.person_name].filter(Boolean).join(" ")).includes(term));
  }, [rows, search]);

  useEffect(() => {
    api.get("/api/admin/permissions/modules").then(setModInfo).catch(() => {});
  }, []);
  const moduleLabel = (id) => modInfo.modules.find((m) => m.id === id)?.label || id;

  const blank = { username: "", password: "", full_name: "", role: "staff", person_id: null, permissions: {} };

  const changeRole = (role) => {
    setEdit({ ...edit, role, permissions: modInfo.role_defaults?.[role] || {} });
  };

  const save = async () => {
    // Kiểm tra ngay tại chỗ để báo lỗi rõ ràng, không phải chờ máy chủ
    if (!edit.id) {
      const u = (edit.username || "").trim();
      if (!u) { setMsg("Chưa nhập tên tài khoản."); return; }
      if (!/^[a-z0-9._-]{3,}$/.test(u)) {
        setMsg("Tên tài khoản chỉ gồm chữ thường, số, dấu chấm, gạch ngang hoặc gạch dưới, ít nhất 3 ký tự.");
        return;
      }
      if ((edit.password || "").length < 8) {
        setMsg(`Mật khẩu phải có ít nhất 8 ký tự. Bạn đang nhập ${(edit.password || "").length} ký tự.`);
        return;
      }
    }
    if (!(edit.full_name || "").trim()) { setMsg("Chưa nhập họ và tên hiển thị."); return; }

    setSaving(true); setMsg("");
    try {
      if (edit.id) {
        await api.put(`/api/admin/users/${edit.id}`, {
          full_name: edit.full_name, role: edit.role, person_id: edit.person_id,
          permissions: edit.permissions || [],
        });
      } else {
        await api.post("/api/admin/users", edit);
      }
      setEdit(null); reload();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const resetPw = async () => {
    setSaving(true); setMsg("");
    try {
      await api.post(`/api/admin/users/${pwFor.id}/password`, { password: newPw });
      window.alert(`Đã đặt lại mật khẩu cho “${pwFor.username}”.\n\nBáo lại mật khẩu mới cho người dùng và nhắc họ tự đổi sau khi đăng nhập.`);
      setPwFor(null); setNewPw("");
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá tài khoản "${r.username}"? Người này sẽ không đăng nhập được nữa.`)) return;
    try { await api.del(`/api/admin/users/${r.id}`); reload(); }
    catch (e) { window.alert(e.message); }
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob("/api/admin/users/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "danh-sach-tai-khoan.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { window.alert(e.message); }
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Quản lý tài khoản" onReload={reload} addLabel="Tạo tài khoản"
        onAdd={() => { setEdit({ ...blank }); setMsg(""); }}
        onExport={exportCsv}
        hint="Tạo tài khoản cho cán bộ, nhân viên và phân quyền chi tiết theo từng module. Mật khẩu tối thiểu 8 ký tự." />

      <input className="inp" style={{ maxWidth: 320 }} placeholder="🔎 Tìm theo tài khoản / họ tên / quyền / nhân viên…"
        value={search} onChange={(e) => setSearch(e.target.value)} />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && filteredRows.length === 0}
          emptyHint={rows.length > 0 && filteredRows.length === 0 ? "Không tìm thấy tài khoản phù hợp." : undefined} />
        {filteredRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tài khoản</th><th>Họ và tên</th><th>Quyền</th><th>Module được cấp</th>
                  <th>Gắn với nhân viên</th><th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{r.username}</td>
                    <td>{r.full_name}</td>
                    <td><span className={`tag ${ROLE_TAG[r.role] || "tag-grey"}`}>{r.role_label}</span></td>
                    <td className="muted" style={{ fontSize: 12.5, maxWidth: 260 }}>
                      {r.role === "admin"
                        ? "Toàn quyền"
                        : Object.keys(r.permission_actions || {}).length
                          ? Object.entries(r.permission_actions).map(([id, actions]) => `${moduleLabel(id)}: ${(actions || []).map((a) => ACTION_LABELS[a]).join("/")}`).join("; ")
                          : "— chưa cấp module nào —"}
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{r.person_name || "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-sm" onClick={() => { setEdit({ ...r, permissions: r.permission_actions || {} }); setMsg(""); }}>
                        <Edit3 size={13} /> Sửa
                      </button>{" "}
                      <button className="btn btn-sm" title="Đặt lại mật khẩu"
                        onClick={() => { setPwFor(r); setNewPw(""); setMsg(""); }}>
                        <KeyRound size={13} />
                      </button>{" "}
                      <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Ba mức quyền" icon={ShieldCheck}>
        {(quyenTuMayChu.length
          ? quyenTuMayChu.map((r) => [r.value, r.desc])
          : Object.entries(ROLE_HINTS)
        ).map(([k, v]) => (
          <div key={k} className="flex items-start gap-3" style={{ padding: "9px 0", borderTop: k === "admin" ? 0 : "1px solid #F1EEEF" }}>
            <span className={`tag ${ROLE_TAG[k]}`} style={{ minWidth: 104, justifyContent: "center" }}>
              {k === "admin" ? "Quản trị viên" : k === "editor" ? "Biên tập viên" : "Nhân viên"}
            </span>
            <span className="dim" style={{ fontSize: 13 }}>{v}</span>
          </div>
        ))}
      </Card>

      {edit && (
        <Modal saving={saving} onSave={save} onClose={() => setEdit(null)} wide
          title={edit.id ? `Sửa tài khoản ${edit.username}` : "Tạo tài khoản mới"}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}

          {!edit.id && (
            <>
              <Field label="Tên tài khoản (dùng để đăng nhập)">
                <input className="inp mono" value={edit.username}
                  onChange={(e) => setEdit({ ...edit, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                  placeholder="Ví dụ: luongdv — nên đặt theo tên viết tắt" />
              </Field>
              <Field label="Mật khẩu ban đầu (tối thiểu 8 ký tự)">
                <input className="inp" type="text" value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="Báo lại cho người dùng và nhắc họ tự đổi" />
                <span style={{ fontSize: 12, fontWeight: 600, marginTop: 5, display: "block",
                               color: (edit.password || "").length >= 8 ? "#0A7A50" : RED_DARK }}>
                  {(edit.password || "").length} / 8 ký tự
                  {(edit.password || "").length >= 8 ? " — đạt" : " — cần thêm"}
                </span>
              </Field>
            </>
          )}

          <Field label="Họ và tên hiển thị">
            <input className="inp" value={edit.full_name || ""} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
          </Field>

          <Field label="Quyền">
            <select className="inp" value={edit.role} onChange={(e) => changeRole(e.target.value)}>
              <option value="admin">Quản trị viên</option>
              <option value="editor">Biên tập viên</option>
              <option value="staff">Nhân viên</option>
            </select>
          </Field>
          <p className="dim" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14, paddingLeft: 2 }}>
            {ROLE_HINTS[edit.role]}
          </p>

          <div style={{ marginBottom: 16 }}>
            <PermissionMatrix
              role={edit.role}
              modules={modInfo.modules}
              roleDefaults={modInfo.role_defaults}
              value={edit.permissions}
              onChange={(permissions) => setEdit({ ...edit, permissions })}
            />
          </div>

          <Field label="Gắn với nhân viên trong danh sách (không bắt buộc)">
            <select className="inp" value={edit.person_id ?? ""}
              onChange={(e) => setEdit({ ...edit, person_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— Không gắn —</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name} — {p.dept}</option>)}
            </select>
          </Field>
        </Modal>
      )}

      {pwFor && (
        <Modal saving={saving} onSave={resetPw} onClose={() => setPwFor(null)}
          title={`Đặt lại mật khẩu: ${pwFor.username}`}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}
          <Field label="Mật khẩu mới (tối thiểu 8 ký tự)">
            <input className="inp" type="text" value={newPw} autoFocus onChange={(e) => setNewPw(e.target.value)} />
          </Field>
          <p className="dim" style={{ fontSize: 12.5 }}>
            Mật khẩu cũ sẽ mất hiệu lực ngay. Báo lại mật khẩu mới cho người dùng và nhắc họ tự đổi
            sau khi đăng nhập.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ========================================== 11. NHẬT KÝ HỆ THỐNG */

export function fmtDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const LOG_ACTION_TAG = {
  login: "tag-grey", login_failed: "tag-red", create: "tag-green",
  update: "tag-amber", delete: "tag-red", config: "tag-amber",
  sync: "tag-grey", import: "tag-amber",
  password_reset: "tag-red", change_password: "tag-grey",
};

export function AdminLogs() {
  const [filters, setFilters] = useState({ modules: [], actions: [] });
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [username, setUsername] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 40;

  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/logs/filters").then(setFilters).catch(() => {});
  }, []);

  const filterParams = () => {
    const params = new URLSearchParams();
    if (module) params.set("module", module);
    if (action) params.set("action", action);
    if (username.trim()) params.set("username", username.trim());
    if (q.trim()) params.set("q", q.trim());
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    return params;
  };
  const hasActiveFilters = () => module || action || username.trim() || q.trim() || dateFrom || dateTo;

  const load = () => {
    setLoading(true);
    const params = filterParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    api.get(`/api/admin/logs?${params.toString()}`)
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [module, action, page]);

  const applyFreeFilters = () => { setPage(1); load(); };

  const clearFilters = () => {
    setModule(""); setAction(""); setUsername(""); setQ(""); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const deleteOne = async (l) => {
    if (!window.confirm(`Xoá dòng nhật ký này?\n\n${l.action_label} — ${l.module_label}: ${l.target_label || ""}`)) return;
    try { await api.del(`/api/admin/logs/${l.id}`); load(); }
    catch (e) { window.alert(e.message); }
  };

  const deleteFiltered = async () => {
    const params = filterParams();
    const active = hasActiveFilters();
    const msg = active
      ? `Xoá toàn bộ ${data.total} dòng nhật ký đang lọc? Không thể hoàn tác.`
      : `Chưa chọn bộ lọc nào — thao tác này sẽ XOÁ TOÀN BỘ ${data.total} dòng nhật ký của hệ thống. Không thể hoàn tác. Tiếp tục?`;
    if (!window.confirm(msg)) return;
    if (!active) params.set("confirm_all", "true");
    try {
      const r = await api.del(`/api/admin/logs?${params.toString()}`);
      window.alert(`Đã xoá ${r.deleted} dòng nhật ký.`);
      setPage(1); load();
    } catch (e) { window.alert(e.message); }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Nhật ký hệ thống" onReload={load}
        hint="Ghi lại mọi thao tác có tác động: đăng nhập, thêm/sửa/xoá nội dung, đổi cấu hình. Lọc theo hạng mục để tra cứu nhanh." />

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          <Field label="Hạng mục">
            <select className="inp" value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }}>
              <option value="">Tất cả hạng mục</option>
              {filters.modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Loại hành động">
            <select className="inp" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">Tất cả hành động</option>
              {filters.actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </Field>
          <Field label="Tài khoản">
            <input className="inp" value={username} placeholder="Tên đăng nhập hoặc họ tên"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFreeFilters()} />
          </Field>
          <Field label="Từ khoá">
            <input className="inp" value={q} placeholder="Tìm trong nội dung bị tác động"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFreeFilters()} />
          </Field>
          <Field label="Từ ngày">
            <input className="inp" type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); }} />
          </Field>
          <Field label="Đến ngày">
            <input className="inp" type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); }} />
          </Field>
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          <div className="flex gap-2">
            <button className="btn btn-red btn-sm" onClick={applyFreeFilters}><Search size={13} /> Lọc</button>
            <button className="btn btn-sm" onClick={clearFilters}><Filter size={13} /> Bỏ lọc</button>
          </div>
          <button className="btn btn-sm" style={{ color: RED_DARK }} onClick={deleteFiltered}>
            <Trash2 size={13} /> {hasActiveFilters() ? "Xoá theo bộ lọc" : "Xoá toàn bộ nhật ký"}
          </button>
        </div>
      </Card>

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && data.rows.length === 0} />
        {data.rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Thời gian</th><th>Tài khoản</th><th>Hành động</th>
                    <th>Hạng mục</th><th>Nội dung</th><th>Ghi chú</th><th>IP</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((l) => (
                    <tr key={l.id}>
                      <td className="mono muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDateTime(l.created_at)}</td>
                      <td style={{ fontSize: 12.5 }}>
                        <div style={{ fontWeight: 600 }}>{l.full_name || l.username || "—"}</div>
                        {l.username && <div className="dim mono" style={{ fontSize: 11 }}>{l.username}</div>}
                      </td>
                      <td><span className={`tag ${LOG_ACTION_TAG[l.action] || "tag-grey"}`}>{l.action_label}</span></td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{l.module_label}</td>
                      <td style={{ fontSize: 12.5, maxWidth: 260 }}>{l.target_label || "—"}</td>
                      <td className="dim" style={{ fontSize: 12 }}>{l.detail || ""}</td>
                      <td className="mono muted" style={{ fontSize: 11 }}>{l.ip_address || ""}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm" title="Xoá dòng này" onClick={() => deleteOne(l)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between" style={{ padding: 14, fontSize: 12.5 }}>
              <span className="muted">Tổng {data.total} lượt ghi nhận</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
                <span className="muted">Trang {page}/{totalPages}</span>
                <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Trang sau</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ========================================== 12. THÙNG RÁC */

const TRASH_MODULE_ICON = { news: FileText, documents: BookOpen };

export function AdminTrash() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/trash");
  const [busyId, setBusyId] = useState(null);

  const restore = async (item) => {
    if (!window.confirm(`Khôi phục "${item.title}"?`)) return;
    setBusyId(`${item.module}-${item.id}`);
    try { await api.post(`/api/admin/trash/${item.module}/${item.id}/restore`); reload(); }
    catch (e) { window.alert(e.message); }
    setBusyId(null);
  };

  const purgeNow = async (item) => {
    if (!window.confirm(`Xoá vĩnh viễn "${item.title}"?\n\nKhông thể khôi phục sau khi xoá.`)) return;
    setBusyId(`${item.module}-${item.id}`);
    try { await api.del(`/api/admin/trash/${item.module}/${item.id}`); reload(); }
    catch (e) { window.alert(e.message); }
    setBusyId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Thùng rác" onReload={reload}
        hint="Bản tin và tài liệu đã xoá nằm ở đây tối đa 30 ngày để quản trị viên duyệt trước khi xoá hẳn. Quá hạn sẽ tự động xoá vĩnh viễn." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0}
          emptyHint="Thùng rác đang trống." />
        {rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Hạng mục</th><th>Tiêu đề</th><th>Người xoá</th><th>Ngày xoá</th>
                  <th>Còn lại</th><th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const I = TRASH_MODULE_ICON[item.module] || FileText;
                  const busy = busyId === `${item.module}-${item.id}`;
                  return (
                    <tr key={`${item.module}-${item.id}`}>
                      <td className="flex items-center gap-2" style={{ fontSize: 12.5 }}>
                        <I size={14} style={{ color: RED }} /> {item.module_label}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{item.deleted_by || "—"}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{fmtDateTime(item.deleted_at)}</td>
                      <td style={{ fontSize: 12.5 }}>
                        <span className={`tag ${item.days_left <= 3 ? "tag-red" : "tag-amber"}`}>
                          {item.days_left} ngày
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-sm" disabled={busy} onClick={() => restore(item)}>
                          <RotateCcw size={13} /> Khôi phục
                        </button>{" "}
                        <button className="btn btn-sm" style={{ color: RED_DARK }} disabled={busy}
                          onClick={() => purgeNow(item)}>
                          <Trash2 size={13} /> Xoá vĩnh viễn
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------- Người dùng tự đổi mật khẩu ---------------------------- */

export function ChangePasswordBox({ onClose, forced, onDone, onLogout }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (newPw !== again) { setMsg("Hai ô mật khẩu mới chưa khớp nhau."); return; }
    if (newPw.length < 8) { setMsg("Mật khẩu mới phải có ít nhất 8 ký tự."); return; }
    setBusy(true); setMsg("");
    try {
      await api.post("/api/auth/change-password", { old_password: oldPw, new_password: newPw });
      if (forced) {
        onDone();
      } else {
        window.alert("Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.");
        onClose();
      }
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  const fields = (
    <>
      {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}
      <Field label="Mật khẩu hiện tại">
        <input className="inp" type="password" value={oldPw} autoFocus onChange={(e) => setOldPw(e.target.value)} />
      </Field>
      <Field label="Mật khẩu mới (tối thiểu 8 ký tự)">
        <input className="inp" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
      </Field>
      <Field label="Nhập lại mật khẩu mới">
        <input className="inp" type="password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
    </>
  );

  if (forced) {
    return (
      <div className="sheet" style={{ zIndex: 200 }}>
        <div className="card" style={{ width: "min(420px,100%)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(150deg, #B8112B, #78091B)", padding: "22px 20px", color: "#fff" }}>
            <KeyRound size={26} />
            <h3 style={{ fontWeight: 800, fontSize: 18, marginTop: 10 }}>Phải đổi mật khẩu trước khi tiếp tục</h3>
            <p style={{ fontSize: 12.5, color: "#EBD4D8", marginTop: 4 }}>
              Tài khoản đang dùng mật khẩu ban đầu do quản trị viên cấp. Đặt mật khẩu riêng của bạn để tiếp tục dùng cổng thông tin.
            </p>
          </div>
          <div style={{ padding: 20 }}>
            {fields}
            <button className="btn btn-red" style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={save}>
              <Save size={15} /> {busy ? "Đang lưu…" : "Đổi mật khẩu"}
            </button>
            <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Modal title="Đổi mật khẩu" saving={busy} onSave={save} onClose={onClose}>
      {fields}
    </Modal>
  );
}

/* ============================ 11. NGUỒN DỮ LIỆU GOOGLE SHEET ============================ */

const SHEET_GUIDE = [
  "Mở bảng tính trên Google Sheets.",
  "Vào Tệp → Chia sẻ → Đăng lên web.",
  "Ở ô thứ hai chọn định dạng Giá trị được phân tách bằng dấu phẩy (.csv).",
  "Bấm Đăng, sao chép đường dẫn hiện ra.",
  "Dán vào ô bên dưới rồi bấm Kiểm tra.",
];

function SheetPreview({ rows }) {
  if (!rows?.length) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div style={{ overflowX: "auto", border: "1px solid #E7E3E4", borderRadius: 10, marginTop: 10 }}>
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c} className="mono" style={{ fontSize: 12 }}>{String(r[c] ?? "")}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSheets() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/sheets");
  const { rows: kinds } = useAdminList("/api/admin/sheets/kinds");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(false);

  const kindInfo = (k) => kinds.find((x) => x.kind === k);

  const test = async () => {
    setTesting(true); setMsg(""); setPreview(null);
    try {
      const r = await api.post("/api/admin/sheets/preview", { kind: edit.kind, csv_url: edit.csv_url });
      setPreview(r);
      setMsg(`Đọc được ${r.row_count} dòng. Xem thử bên dưới, đúng rồi thì bấm Lưu lại.`);
    } catch (e) { setMsg(e.message); }
    setTesting(false);
  };

  const save = async () => {
    setSaving(true); setMsg("");
    try {
      if (edit.id) await api.put(`/api/admin/sheets/${edit.id}`, edit);
      else await api.post("/api/admin/sheets", edit);
      setEdit(null); setPreview(null); reload();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const syncNow = async (r) => {
    try {
      const res = await api.post(`/api/admin/sheets/${r.id}/sync`);
      window.alert(res.ok ? res.message : `Đồng bộ không thành công.\n\n${res.message}`);
      reload();
    } catch (e) { window.alert(e.message); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá nguồn "${r.name}"? Số liệu sẽ quay về dữ liệu trong hệ thống.`)) return;
    await api.del(`/api/admin/sheets/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Nguồn dữ liệu Google Sheet" onReload={reload} addLabel="Thêm nguồn"
        onAdd={() => { setEdit({ kind: "home_stats", name: "", csv_url: "", active: true }); setMsg(""); setPreview(null); }}
        hint="Nối cổng thông tin với bảng tính Google. Sửa số liệu trên bảng tính là trang tự cập nhật theo, chậm nhất 10 phút." />

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0}
          emptyHint="Chưa nối nguồn nào. Khi chưa có, hệ thống dùng số liệu nhập tay trong cơ sở dữ liệu." />
        {rows.map((r, i) => (
          <div key={r.id} style={{ padding: "14px 16px", borderTop: i ? "1px solid #F1EEEF" : 0 }}>
            <div className="flex items-start gap-3" style={{ flexWrap: "wrap" }}>
              <Database size={17} style={{ color: r.last_status === "ok" ? "#0A7A50" : RED, flexShrink: 0, marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</p>
                  <span className="tag tag-grey">{r.kind_label}</span>
                  {!r.active && <span className="tag tag-grey">Đang tắt</span>}
                  {r.last_status === "ok"
                    ? <span className="tag tag-green">{r.row_count} dòng</span>
                    : r.last_status === "error" && <span className="tag tag-red">Lỗi</span>}
                </div>
                {r.last_error
                  ? <p style={{ fontSize: 12.5, color: RED_DARK, marginTop: 5 }}>{r.last_error}</p>
                  : <p className="muted mono" style={{ fontSize: 11.5, marginTop: 5, wordBreak: "break-all" }}>{r.csv_url}</p>}
                {r.last_sync_at && (
                  <p className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                    Lần đồng bộ gần nhất: {new Date(r.last_sync_at).toLocaleString("vi-VN")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => syncNow(r)}><RefreshCw size={13} /> Đồng bộ</button>
                <button className="btn btn-sm" onClick={() => { setEdit({ ...r }); setMsg(""); setPreview(null); }}><Edit3 size={13} /> Sửa</button>
                <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Cách lấy đường dẫn từ Google Sheets" icon={BookOpen}>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 2 }}>
          {SHEET_GUIDE.map((g, i) => <li key={i}>{g}</li>)}
        </ol>
        <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>
          Dán đường dẫn bảng tính thông thường cũng được — hệ thống tự chuyển sang dạng đọc dữ liệu.
          Điều kiện là bảng tính đã được đăng lên web hoặc đặt quyền xem cho người có đường dẫn.
        </p>
      </Card>

      {kinds.length > 0 && (
        <Card title="Cấu trúc cột từng loại bảng tính" icon={FileText}>
          {kinds.map((k, i) => (
            <div key={k.kind} style={{ paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0, borderTop: i ? "1px solid #F1EEEF" : 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{k.label}</p>
              <p className="dim" style={{ fontSize: 13, margin: "4px 0 8px" }}>{k.desc}</p>
              <div className="flex gap-1.5" style={{ flexWrap: "wrap" }}>
                {k.columns.map((c) => (
                  <span key={c} className={`tag ${k.required.includes(c) ? "tag-red" : "tag-grey"}`}>{c}</span>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Cột tô đỏ là bắt buộc.</p>
            </div>
          ))}
        </Card>
      )}

      {edit && (
        <Modal wide saving={saving} onSave={save} onClose={() => { setEdit(null); setPreview(null); }}
          title={edit.id ? `Sửa nguồn: ${edit.name}` : "Thêm nguồn dữ liệu"}>
          {msg && (
            <p style={{ background: preview ? "#EEF8F1" : "#FBF4F5", color: preview ? "#0A7A50" : RED_DARK,
                        padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>
          )}

          {!edit.id && (
            <Field label="Loại dữ liệu">
              <select className="inp" value={edit.kind} onChange={(e) => { setEdit({ ...edit, kind: e.target.value }); setPreview(null); }}>
                {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
              </select>
            </Field>
          )}

          {kindInfo(edit.kind) && (
            <p className="dim" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>
              {kindInfo(edit.kind).desc}<br />
              Cột bắt buộc: <strong>{kindInfo(edit.kind).required.join(", ")}</strong>
            </p>
          )}

          <Field label="Tên gọi (để bạn dễ nhận ra)">
            <input className="inp" value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              placeholder="Ví dụ: Lịch công tác tuần 32" />
          </Field>

          <Field label="Đường dẫn Google Sheet">
            <input className="inp mono" style={{ fontSize: 12.5 }} value={edit.csv_url || ""}
              onChange={(e) => { setEdit({ ...edit, csv_url: e.target.value }); setPreview(null); }}
              placeholder="https://docs.google.com/spreadsheets/d/..." />
          </Field>

          <div className="flex gap-2" style={{ marginBottom: 14 }}>
            <button type="button" className="btn" onClick={test} disabled={testing || !edit.csv_url}>
              <RefreshCw size={14} /> {testing ? "Đang kiểm tra…" : "Kiểm tra đường dẫn"}
            </button>
          </div>

          <CheckBox label="Đang sử dụng nguồn này" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />

          {preview?.sample?.length > 0 && (
            <>
              <p className="eyebrow-grey" style={{ marginTop: 16 }}>Năm dòng đầu đọc được</p>
              <SheetPreview rows={preview.sample} />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ==================================== LỊCH CÔNG TÁC TUẦN ==================================== */

const MEETING_OPTS = [
  { value: "truc_tiep", label: "Họp trực tiếp", canThongTin: false,
    goiY: "Ghi phòng họp ở ô Địa điểm phía trên." },
  { value: "cau_truyen_hinh", label: "Cầu truyền hình", canThongTin: true,
    nhan: "Địa chỉ IP điểm cầu", vd: "10.255.58.3",
    goiY: "Nhập địa chỉ IP của điểm cầu. Kèm cổng cũng được, ví dụ 10.255.58.3:5060." },
  { value: "zoom", label: "Zoom", canThongTin: true,
    nhan: "Đường dẫn phòng họp Zoom", vd: "https://zoom.us/j/81234567890",
    goiY: "Dán đường dẫn phòng họp. Có mã và mật khẩu thì điền thêm bên dưới." },
  { value: "google_meet", label: "Google Meet", canThongTin: true,
    nhan: "Đường dẫn Google Meet", vd: "https://meet.google.com/abc-defg-hij", goiY: "" },
  { value: "teams", label: "Microsoft Teams", canThongTin: true,
    nhan: "Đường dẫn phòng họp Teams", vd: "https://teams.microsoft.com/l/meetup-join/...", goiY: "" },
  { value: "khac", label: "Hình thức khác", canThongTin: true,
    nhan: "Thông tin kết nối", vd: "", goiY: "" },
];

const meetOpt = (v) => MEETING_OPTS.find((m) => m.value === v) || MEETING_OPTS[0];

/** Nhóm ô nhập về hình thức họp, dùng chung cho lịch công tác và sự kiện văn hoá. */
export function MeetingFields({ edit, setEdit }) {
  // Đối chiếu với máy chủ để phát hiện lệch danh sách hình thức họp
  const { rows: tuMayChu } = useAdminList("/api/admin/meeting-types");
  const opt = meetOpt(edit.meeting_type || "truc_tiep");
  const lech = tuMayChu.length > 0
    && tuMayChu.map((m) => m.value).sort().join() !== MEETING_OPTS.map((m) => m.value).sort().join();
  const online = ["zoom", "google_meet", "teams"].includes(opt.value);

  return (
    <>
      <Field label="Thành phần tham gia">
        <textarea className="inp" rows={2} value={edit.participants || ""}
          onChange={(e) => setEdit({ ...edit, participants: e.target.value })}
          placeholder="Ví dụ: Ban Giám đốc, Trưởng các phòng, Tổ trưởng các tổ" />
      </Field>

      <Field label="Hình thức họp">
        <select className="inp" value={edit.meeting_type || "truc_tiep"}
          onChange={(e) => setEdit({ ...edit, meeting_type: e.target.value })}>
          {MEETING_OPTS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>

      {opt.goiY && (
        <p className="dim" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 14 }}>{opt.goiY}</p>
      )}

      {lech && (
        <p style={{ background: "#FFF8E8", color: "#6B5426", fontSize: 12.5, padding: "8px 11px",
                    borderRadius: 9, marginTop: -6, marginBottom: 14 }}>
          Danh sách hình thức họp trên máy chủ khác với giao diện. Có thể hai phần đang lệch bản.
        </p>
      )}

      {opt.canThongTin && (
        <>
          <Field label={opt.nhan}>
            <input className="inp mono" style={{ fontSize: 13 }} value={edit.meeting_info || ""}
              onChange={(e) => setEdit({ ...edit, meeting_info: e.target.value })}
              placeholder={opt.vd} />
          </Field>

          {online && (
            <div className="grid grid-cols-2 gap-x-4">
              <Field label="Mã phòng họp (nếu có)">
                <input className="inp mono" style={{ fontSize: 13 }} value={edit.meeting_id || ""}
                  onChange={(e) => setEdit({ ...edit, meeting_id: e.target.value })}
                  placeholder="812 3456 7890" />
              </Field>
              <Field label="Mật khẩu phòng họp (nếu có)">
                <input className="inp mono" style={{ fontSize: 13 }} value={edit.meeting_pass || ""}
                  onChange={(e) => setEdit({ ...edit, meeting_pass: e.target.value })}
                  placeholder="vhkt2026" />
              </Field>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Hiển thị gọn hình thức họp trong bảng danh sách. */
function MeetingBadge({ e }) {
  const t = e.meeting_type || "truc_tiep";
  if (t === "truc_tiep") return <span className="tag tag-grey">Trực tiếp</span>;
  const opt = meetOpt(t);
  const laLink = (e.meeting_info || "").toLowerCase().startsWith("http");
  return (
    <span>
      <span className={`tag ${t === "cau_truyen_hinh" ? "tag-amber" : "tag-green"}`}>{opt.label}</span>
      {e.meeting_info && (
        <p className="mono" style={{ fontSize: 11.5, marginTop: 4, wordBreak: "break-all" }}>
          {laLink
            ? <a className="link" href={e.meeting_info} target="_blank" rel="noreferrer">Mở phòng họp</a>
            : e.meeting_info}
        </p>
      )}
    </span>
  );
}

export function AdminSchedule() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/events?kind=work");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const blank = {
    title: "", start_at: new Date().toISOString().slice(0, 16), place: "", host: "",
    participants: "", meeting_type: "truc_tiep", meeting_info: "", meeting_id: "", meeting_pass: "",
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => [r.title, r.place, r.host, r.participants]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [rows, search]);

  const save = async () => {
    if (!edit.title?.trim()) { setMsg("Chưa nhập nội dung công việc."); return; }
    const opt = meetOpt(edit.meeting_type || "truc_tiep");
    const tt = (edit.meeting_info || "").trim();

    // Kiểm tra ngay tại chỗ cho khớp với kiểm tra ở máy chủ
    if (edit.meeting_type === "cau_truyen_hinh") {
      if (!tt) { setMsg("Họp cầu truyền hình phải có địa chỉ IP điểm cầu."); return; }
    }
    if (["zoom", "google_meet", "teams"].includes(edit.meeting_type)) {
      if (!tt) { setMsg(`Họp ${opt.label} phải có đường dẫn phòng họp.`); return; }
      if (!/^https?:\/\//i.test(tt)) { setMsg("Đường dẫn phòng họp phải bắt đầu bằng https://"); return; }
    }

    setSaving(true); setMsg("");
    try {
      const payload = { ...edit, kind: "work", start_at: new Date(edit.start_at).toISOString() };
      if (edit.id) await api.put(`/api/admin/events/${edit.id}`, payload);
      else await api.post("/api/admin/events", payload);
      setEdit(null); reload();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá lịch "${r.title}"?`)) return;
    await api.del(`/api/admin/events/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob("/api/admin/events/export?kind=work");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "lich-cong-tac-tuan.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { window.alert(e.message); }
  };

  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleSelectAll = () => setSelected((s) =>
    s.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.id)));

  const deleteMany = async (ids) => {
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => api.del(`/api/admin/events/${id}`).catch(() => {})));
      setSelected(new Set());
      reload();
    } finally { setBulkBusy(false); }
  };

  const removeSelected = () => {
    if (!selected.size) return;
    if (!window.confirm(`Xoá ${selected.size} lịch đã chọn?`)) return;
    deleteMany([...selected]);
  };

  const removeAll = () => {
    if (!rows.length) return;
    if (!window.confirm(`Xoá TOÀN BỘ ${rows.length} lịch công tác tuần? Không thể hoàn tác.`)) return;
    deleteMany(rows.map((r) => r.id));
  };

  const ngayGio = (v) => {
    const d = new Date(v);
    return {
      ngay: d.toLocaleDateString("vi-VN"),
      gio: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Lịch công tác tuần" onReload={reload} addLabel="Thêm lịch"
        onAdd={() => { setEdit({ ...blank }); setMsg(""); }}
        onExport={exportCsv}
        hint="Lịch của ngày hôm nay tự hiện trên trang chủ. Cần nhập cả tuần một lần thì dùng Nhập dữ liệu hàng loạt." />

      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <input className="inp" style={{ maxWidth: 300 }} placeholder="🔎 Tìm theo nội dung / địa điểm / chủ trì / thành phần…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2" style={{ marginLeft: "auto" }}>
          <button className="btn btn-sm" disabled={!selected.size || bulkBusy} onClick={removeSelected}>
            <Trash2 size={13} /> Xoá mục đã chọn ({selected.size})
          </button>
          <button className="btn btn-sm" disabled={!rows.length || bulkBusy} onClick={removeAll}>
            <Trash2 size={13} /> Xoá toàn bộ
          </button>
        </div>
      </div>

      <Card pad={false}>
        <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0}
          emptyHint="Chưa có lịch nào. Bấm Thêm lịch, hoặc nhập cả tuần bằng Nhập dữ liệu hàng loạt." />
        {filteredRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <input type="checkbox" checked={selected.size > 0 && selected.size === filteredRows.length}
                      onChange={toggleSelectAll} />
                  </th>
                  <th style={{ width: 110 }}>Ngày</th>
                  <th style={{ width: 60 }}>Giờ</th>
                  <th style={{ minWidth: 220 }}>Nội dung</th>
                  <th style={{ minWidth: 170 }}>Thành phần</th>
                  <th style={{ minWidth: 170 }}>Hình thức họp</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const { ngay, gio } = ngayGio(r.start_at);
                  return (
                    <tr key={r.id}>
                      <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                      <td className="mono" style={{ fontSize: 12.5 }}>{ngay}</td>
                      <td className="mono" style={{ fontWeight: 700, color: RED }}>{gio}</td>
                      <td>
                        <p style={{ fontWeight: 600 }}>{r.title}</p>
                        <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                          {[r.place, r.host].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{r.participants || "—"}</td>
                      <td><MeetingBadge e={r} /></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn btn-sm" onClick={() => { setEdit({ ...r, start_at: isoLocal(r.start_at) }); setMsg(""); }}>
                          <Edit3 size={13} /> Sửa
                        </button>{" "}
                        <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!filteredRows.length && rows.length > 0 && (
          <div style={{ padding: 24, textAlign: "center" }} className="muted">Không có lịch nào khớp tìm kiếm.</div>
        )}
      </Card>

      {edit && (
        <Modal wide title={edit.id ? "Sửa lịch công tác" : "Thêm lịch công tác"}
          saving={saving} onSave={save} onClose={() => setEdit(null)}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}

          <Field label="Nội dung công việc">
            <input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder="Ví dụ: Giao ban tuần Phòng Vận hành khai thác" />
          </Field>

          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Thời gian">
              <input className="inp" type="datetime-local" value={edit.start_at}
                onChange={(e) => setEdit({ ...edit, start_at: e.target.value })} />
            </Field>
            <Field label="Đơn vị chủ trì">
              <input className="inp" value={edit.host || ""} onChange={(e) => setEdit({ ...edit, host: e.target.value })}
                placeholder="Ban Giám đốc" />
            </Field>
          </div>

          <Field label="Địa điểm">
            <input className="inp" value={edit.place || ""} onChange={(e) => setEdit({ ...edit, place: e.target.value })}
              placeholder="Phòng họp 301" />
          </Field>

          <MeetingFields edit={edit} setEdit={setEdit} />
        </Modal>
      )}
    </div>
  );
}

/* ==================================== ALBUM ẢNH VÀ VIDEO ==================================== */

export function AdminMedia() {
  const { rows, loading, error, reload } = useAdminList("/api/admin/media");
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const blank = {
    title: "", kind: "image", url: "", thumb_url: "", author: "", album: "",
    color: RED, order_no: rows.length, active: true,
  };

  const save = async () => {
    if (!edit.title?.trim()) { setMsg("Chưa nhập tiêu đề."); return; }
    if (edit.kind === "video" && !(edit.url || "").trim()) {
      setMsg("Video phải có đường dẫn. Dán liên kết YouTube, Google Drive hoặc tệp mp4.");
      return;
    }
    if (edit.kind === "image" && !(edit.url || "").trim()) {
      setMsg("Chưa chọn ảnh. Bấm Chọn ảnh để tải lên từ máy tính.");
      return;
    }
    setSaving(true); setMsg("");
    try {
      if (edit.id) await api.put(`/api/admin/media/${edit.id}`, edit);
      else await api.post("/api/admin/media", edit);
      setEdit(null); reload();
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!window.confirm(`Xoá "${r.title}" khỏi album?`)) return;
    await api.del(`/api/admin/media/${r.id}`).catch((e) => window.alert(e.message));
    reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar title="Album ảnh và video" onReload={reload} addLabel="Thêm mục"
        onAdd={() => { setEdit({ ...blank }); setMsg(""); }}
        hint="Ảnh tải lên từ máy tính. Video dán đường dẫn YouTube, Google Drive hoặc tệp mp4." />

      <Status loading={loading} error={error} empty={!loading && !error && rows.length === 0}
        emptyHint="Chưa có mục nào. Bấm Thêm mục để bắt đầu." />

      <div className="grid md:grid-cols-3 xl:grid-cols-4 gap-4">
        {rows.map((r) => {
          const anh = r.kind === "video" ? r.thumb_url : (r.url || r.thumb_url);
          return (
            <div key={r.id} className="card" style={{ overflow: "hidden", opacity: r.active ? 1 : 0.5 }}>
              <div style={{ height: 110, background: r.color || RED, display: "grid",
                            placeItems: "center", position: "relative" }}>
                {anh
                  ? <img src={anh} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (r.kind === "video" ? <Video size={24} color="#fff" /> : <ImageIcon size={24} color="#fff" />)}
                <span className="tag" style={{ position: "absolute", top: 7, left: 7,
                        background: "rgba(255,255,255,.92)", color: RED_DARK }}>
                  {r.kind === "video" ? "Video" : "Ảnh"}
                </span>
              </div>
              <div style={{ padding: 12 }}>
                <p style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</p>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                  {[r.author, r.album].filter(Boolean).join(" · ") || "—"}
                </p>
                <div className="flex gap-2" style={{ marginTop: 10 }}>
                  <button className="btn btn-sm" style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => { setEdit({ ...r }); setMsg(""); }}>
                    <Edit3 size={13} /> Sửa
                  </button>
                  <button className="btn btn-sm" onClick={() => remove(r)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {edit && (
        <Modal title={edit.id ? "Sửa mục album" : "Thêm vào album"}
          saving={saving} onSave={save} onClose={() => setEdit(null)}>
          {msg && <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px",
                              borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{msg}</p>}

          <Field label="Loại">
            <select className="inp" value={edit.kind}
              onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
              <option value="image">Ảnh</option>
              <option value="video">Video</option>
            </select>
          </Field>

          <Field label="Tiêu đề">
            <input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder="Ví dụ: Diễn tập ứng cứu thông tin mùa mưa bão" />
          </Field>

          {edit.kind === "image" ? (
            <ImagePicker label="Ảnh" value={edit.url || ""}
              onChange={(url) => setEdit({ ...edit, url })}
              hint="Chọn ảnh từ máy tính. Bấm vào ảnh ngoài trang sẽ phóng to." />
          ) : (
            <>
              <Field label="Đường dẫn video">
                <input className="inp mono" style={{ fontSize: 12.5 }} value={edit.url || ""}
                  onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... hoặc liên kết Google Drive" />
              </Field>
              <ImagePicker label="Ảnh đại diện video (không bắt buộc)" value={edit.thumb_url || ""}
                onChange={(url) => setEdit({ ...edit, thumb_url: url })}
                hint="Để trống sẽ hiện nền màu kèm nút phát." />
            </>
          )}

          <div className="grid md:grid-cols-2 gap-x-4">
            <Field label="Người chụp hoặc đơn vị">
              <input className="inp" value={edit.author || ""} onChange={(e) => setEdit({ ...edit, author: e.target.value })}
                placeholder="Tổ KV1" />
            </Field>
            <Field label="Thuộc album">
              <input className="inp" value={edit.album || ""} onChange={(e) => setEdit({ ...edit, album: e.target.value })}
                placeholder="Diễn tập 2026" />
            </Field>
            <Field label="Thứ tự hiển thị">
              <input className="inp" type="number" value={edit.order_no ?? 0}
                onChange={(e) => setEdit({ ...edit, order_no: Number(e.target.value) })} />
            </Field>
            <Field label="Màu nền khi chưa có ảnh">
              <input className="inp" type="color" value={edit.color || RED}
                onChange={(e) => setEdit({ ...edit, color: e.target.value })} style={{ height: 42, padding: 4 }} />
            </Field>
          </div>

          <CheckBox label="Đang hiển thị" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
        </Modal>
      )}
    </div>
  );
}
