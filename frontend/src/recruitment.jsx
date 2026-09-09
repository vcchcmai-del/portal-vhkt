import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Download, MapPin, Plus, RefreshCw, TrendingDown, Trash2, UserCheck, Users } from "lucide-react";
import { api, getUser, useCenters } from "./api";
import { Card, Empty, Field, RED } from "./ui";

const EDU_OPTIONS = ["THPT", "Trung cấp", "Cao đẳng", "Đại học", "Sau đại học"];

const CURRENT_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 55 }, (_, i) => CURRENT_YEAR - 16 - i); // 16 → 70 tuổi

const RECRUITMENT_NEEDS = [
  { center: "Trung tâm Thới Hòa", position: "Nhân viên Kỹ thuật nhà trạm" },
  { center: "Trung tâm Tân Uyên", position: "Nhân viên Lái xe" },
  { center: "Trung tâm Thuận Giao", position: "Nhân viên Kỹ thuật dây máy" },
  { center: "Trung tâm Chánh Hiệp", position: "Giám đốc kỹ thuật" },
  { center: "Trung tâm Tân Đông Hiệp", position: "Phó Giám đốc Trung tâm phụ trách Kỹ thuật" },
  { center: "Trung tâm Dầu Tiếng", position: "Nhân viên Kỹ thuật Cơ điện và Năng lượng" },
  { center: "Trung tâm Phú Giáo", position: "Nhân viên Vận hành Năng lượng mặt trời" },
  { center: "Trung tâm Bà Rịa", position: "" },
  { center: "Trung tâm Hồ Tràm", position: "" },
  { center: "Trung tâm Tam Thắng", position: "" },
  { center: "Trung tâm Phú Mỹ", position: "" },
  { center: "Trung tâm Ngãi Giao", position: "" },
  { center: "Trung tâm Côn Đảo", position: "" },
];
const POSITION_OPTIONS = [...new Set(RECRUITMENT_NEEDS.map((r) => r.position).filter(Boolean))];
const OTHER_POSITION = "__khac__";

const MAJOR_OPTIONS = [
  "Điện - Điện tử", "Điện tử viễn thông", "Công nghệ thông tin", "Cơ điện tử",
  "Cơ khí", "Kỹ thuật ô tô", "Xây dựng", "Điện công nghiệp", "Quản trị kinh doanh", "Kế toán",
];
const OTHER_MAJOR = "__khac__";

const CAND_STATUS = {
  new: "Mới nộp", reviewing: "Đang xem xét", interview: "Đã phỏng vấn",
  negotiating: "Đang trao đổi", hired: "Đã tuyển", probation: "Đã thử việc",
  left: "Đã nghỉ", rejected: "Từ chối",
};
const STATUS_TAG = {
  new: "tag-grey", reviewing: "tag-amber", interview: "tag-amber", negotiating: "tag-amber",
  hired: "tag-green", probation: "tag-green", left: "tag-red", rejected: "tag-red",
};

const blankCandidate = {
  full_name: "", position: "", position_type: "", desired_location: "", birth_year: "",
  education_level: "", major: "", referrer: "",
};

/* ---- Các trường chọn dùng chung cho form ứng viên (công khai + quản trị) ---- */

function LocationField({ form, setForm }) {
  return (
    <Field label="Khu vực mong muốn làm việc">
      <select className="inp" value={form.desired_location || ""}
        onChange={(e) => {
          const center = e.target.value;
          const need = RECRUITMENT_NEEDS.find((r) => r.center === center);
          setForm({ ...form, desired_location: center, position: need?.position || form.position });
        }}>
        <option value="">— Chọn khu vực —</option>
        {RECRUITMENT_NEEDS.map((r) => <option key={r.center} value={r.center}>{r.center}</option>)}
      </select>
    </Field>
  );
}

function PositionField({ form, setForm }) {
  const [customMode, setCustomMode] = useState(() => !!form.position && !POSITION_OPTIONS.includes(form.position));
  return (
    <Field label="Vị trí cần ứng cử">
      <select className="inp" value={customMode ? OTHER_POSITION : (form.position || "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER_POSITION) { setCustomMode(true); setForm({ ...form, position: "" }); }
          else { setCustomMode(false); setForm({ ...form, position: v }); }
        }}>
        <option value="">— Chọn vị trí —</option>
        {POSITION_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        <option value={OTHER_POSITION}>Khác (vị trí khác)…</option>
      </select>
      {customMode && (
        <input className="inp" style={{ marginTop: 6 }} placeholder="Nhập vị trí cụ thể"
          value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
      )}
    </Field>
  );
}

const POSITION_TYPES = { OFT: "OFT", FT: "FT" };

function PositionTypeField({ form, setForm }) {
  return (
    <Field label="Vị trí ứng tuyển (OFT/FT)">
      <select className="inp" value={form.position_type || ""}
        onChange={(e) => setForm({ ...form, position_type: e.target.value })}>
        <option value="">— Chọn loại —</option>
        {Object.entries(POSITION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </Field>
  );
}

function EducationField({ form, setForm }) {
  return (
    <Field label="Trình độ">
      <select className="inp" value={form.education_level || ""}
        onChange={(e) => setForm({ ...form, education_level: e.target.value })}>
        <option value="">— Chọn trình độ —</option>
        {EDU_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

function MajorField({ form, setForm }) {
  const [customMode, setCustomMode] = useState(() => !!form.major && !MAJOR_OPTIONS.includes(form.major));
  return (
    <Field label="Chuyên môn">
      <select className="inp" value={customMode ? OTHER_MAJOR : (form.major || "")}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER_MAJOR) { setCustomMode(true); setForm({ ...form, major: "" }); }
          else { setCustomMode(false); setForm({ ...form, major: v }); }
        }}>
        <option value="">— Chọn chuyên môn —</option>
        {MAJOR_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
        <option value={OTHER_MAJOR}>Khác (chuyên môn khác)…</option>
      </select>
      {customMode && (
        <input className="inp" style={{ marginTop: 6 }} placeholder="Nhập chuyên môn cụ thể"
          value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
      )}
    </Field>
  );
}

function BirthYearField({ form, setForm }) {
  return (
    <Field label="Năm sinh">
      <select className="inp" value={form.birth_year || ""}
        onChange={(e) => setForm({ ...form, birth_year: e.target.value })}>
        <option value="">— Chọn năm sinh —</option>
        {BIRTH_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </Field>
  );
}

const blankStaffing = {
  report_date: new Date().toISOString().slice(0, 10), center: "",
  nt_ft_dinh_bien: 0, nt_ft_hien_tai: 0,
  dm_ft_dinh_bien: 0, dm_ft_hien_tai: 0,
  dm_oft_dinh_bien: 0, dm_oft_hien_tai: 0,
  posted_channels: 0, school_contacts: 0, banners_posted: 0,
  banner_location: "", note: "",
};

const fmtDay = (v) => v ? new Date(v).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const statusCount = (summary, key) => summary?.by_status?.find((s) => s.status === key)?.count ?? 0;

/* ============================== TRANG TUYỂN DỤNG (công khai) ============================== */

function CandidateForm({ onDone }) {
  const [form, setForm] = useState(blankCandidate);
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const field = (label, key, kind = "text") => (
    <Field label={label}>
      <input className="inp" type={kind} value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </Field>
  );

  const submit = async () => {
    if (!form.full_name.trim()) { setMsg("Chưa nhập họ và tên."); return; }
    if (!form.position.trim()) { setMsg("Chưa nhập vị trí ứng tuyển."); return; }
    setBusy(true); setMsg("");
    try {
      await api.post("/api/recruitment/candidates", {
        ...form, birth_year: form.birth_year ? Number(form.birth_year) : null,
      });
      setForm(blankCandidate);
      setFormKey((k) => k + 1);
      setMsg("Đã ghi nhận ứng viên. Cảm ơn bạn đã giới thiệu.");
      onDone?.();
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <Card title="Giới thiệu ứng viên" icon={Plus}>
      {msg && (
        <p style={{ fontSize: 13, color: msg.startsWith("Đã ghi nhận") ? "#137333" : RED, marginBottom: 10 }}>{msg}</p>
      )}
      <div className="grid md:grid-cols-2 gap-3" key={formKey}>
        {field("Họ và tên", "full_name")}
        <LocationField form={form} setForm={setForm} />
        <PositionField form={form} setForm={setForm} />
        <PositionTypeField form={form} setForm={setForm} />
        <BirthYearField form={form} setForm={setForm} />
        <EducationField form={form} setForm={setForm} />
        <MajorField form={form} setForm={setForm} />
        {field("Người giới thiệu", "referrer")}
      </div>
      <button className="btn btn-red" style={{ marginTop: 12 }} disabled={busy} onClick={submit}>
        <Plus size={15} /> {busy ? "Đang gửi…" : "Gửi thông tin ứng viên"}
      </button>
    </Card>
  );
}

export function RecruitmentView() {
  const [summary, setSummary] = useState(null);
  const user = getUser();
  const staffing = summary?.staffing;
  const { tenTrungTam } = useCenters();

  const load = () => api.get("/api/recruitment/summary").then(setSummary).catch(() => {});
  useEffect(() => { load(); }, []);

  const centers = staffing?.centers || [];
  const criticalCenters = centers.filter((c) => c.total_gap >= 8).sort((a, b) => b.total_gap - a.total_gap);
  const urgentCenters = centers.filter((c) => c.total_gap > 0 && c.total_gap < 8).sort((a, b) => b.total_gap - a.total_gap);

  return (
    <div className="flex flex-col gap-4">
      {(criticalCenters.length > 0 || urgentCenters.length > 0) && (
        <div className="card" style={{
          background: "linear-gradient(135deg,#FDEEEF,#FBF4F5)", border: `1.5px solid ${RED}`,
          borderRadius: 14, padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <AlertTriangle size={26} color={RED} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 800, color: RED, fontSize: 15 }}>
              Cảnh báo: {criticalCenters.length + urgentCenters.length} trung tâm đang thiếu nhân sự — cần tuyển gấp
            </p>
            {criticalCenters.length > 0 && (
              <p style={{ fontSize: 13.5, marginTop: 6 }}>
                <b style={{ color: RED }}>Thiếu nghiêm trọng (≥8 người):</b>{" "}
                {criticalCenters.map((c) => `${c.center.replace("Trung tâm ", "")} (thiếu ${c.total_gap})`).join(", ")}
              </p>
            )}
            {urgentCenters.length > 0 && (
              <p style={{ fontSize: 13.5, marginTop: 4, color: "#4B4749" }}>
                <b>Đang thiếu:</b>{" "}
                {urgentCenters.map((c) => `${c.center.replace("Trung tâm ", "")} (thiếu ${c.total_gap})`).join(", ")}
              </p>
            )}
            <p style={{ fontSize: 12.5, marginTop: 6, color: "#807A7C" }}>
              Ưu tiên giới thiệu ứng viên cho các khu vực trên bằng biểu mẫu bên dưới.
            </p>
          </div>
        </div>
      )}

      <Card title="Định biên thiếu nhân sự — Toàn chi nhánh" icon={Building2}
        action={staffing?.report_date && <span className="muted" style={{ fontSize: 12 }}>Số liệu ngày {fmtDay(staffing.report_date)}</span>}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div><p className="muted" style={{ fontSize: 12 }}>Thiếu OFT</p><p style={{ fontSize: 26, fontWeight: 800, color: RED, marginTop: 5 }}>{staffing?.total_oft_gap ?? "—"}</p></div>
          <div><p className="muted" style={{ fontSize: 12 }}>Thiếu FT</p><p style={{ fontSize: 26, fontWeight: 800, color: RED, marginTop: 5 }}>{staffing?.total_ft_gap ?? "—"}</p></div>
          <div><p className="muted" style={{ fontSize: 12 }}>Tổng thiếu</p><p style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{staffing?.total_gap ?? "—"}</p></div>
          <div><p className="muted" style={{ fontSize: 12 }}>Hồ sơ nhận trong tháng</p><p style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{staffing?.total_applications ?? "—"}</p></div>
        </div>
      </Card>

      <Card title="Định biên thiếu theo trung tâm" icon={TrendingDown} pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>Trung tâm</th><th>Thiếu OFT</th><th>Thiếu FT</th><th>Tổng thiếu</th><th>Hồ sơ nhận</th></tr></thead>
            <tbody>
              {(staffing?.centers || []).map((c) => (
                <tr key={c.center}>
                  <td><b>{tenTrungTam(c.center)}</b></td>
                  <td>{c.oft_gap}</td>
                  <td>{c.ft_gap}</td>
                  <td><span className={`tag ${c.total_gap >= 8 ? "tag-red" : c.total_gap > 0 ? "tag-amber" : "tag-grey"}`}>{c.total_gap}</span></td>
                  <td>{c.applications_received || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(staffing?.centers || []).length && <Empty title="Chưa có báo cáo định biên theo trung tâm." />}
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>Tổng hồ sơ nhận</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: RED, marginTop: 5 }}>{summary?.total ?? "—"}</p>
        </Card>
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>HS đang trao đổi</p>
          <p style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>{statusCount(summary, "negotiating")}</p>
        </Card>
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>HS đã thử việc</p>
          <p style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>{statusCount(summary, "probation")}</p>
        </Card>
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>HS đã nghỉ</p>
          <p style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>{statusCount(summary, "left")}</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Ứng viên theo vị trí" icon={Users} pad={false}>
          <div style={{ padding: "4px 18px 14px" }}>
            {(summary?.by_position || []).map((p) => (
              <div key={p.label} className="flex justify-between" style={{ padding: "7px 0", borderBottom: "1px solid #eee", fontSize: 13.5 }}>
                <span>{p.label}</span><b>{p.count}</b>
              </div>
            ))}
            {!(summary?.by_position || []).length && <Empty title="Chưa có dữ liệu ứng viên." />}
          </div>
        </Card>
        <Card title="Khu vực ít ứng viên nhất — cần bổ sung nhân sự" icon={TrendingDown} pad={false}>
          <div style={{ padding: "4px 18px 14px" }}>
            {(summary?.short_staffed_locations || []).map((p) => (
              <div key={p.label} className="flex justify-between items-center" style={{ padding: "7px 0", borderBottom: "1px solid #eee", fontSize: 13.5 }}>
                <span className="flex items-center gap-1.5"><MapPin size={12} />{p.label}</span>
                <b>{p.count} ứng viên</b>
              </div>
            ))}
            {!(summary?.short_staffed_locations || []).length && <Empty title="Chưa có dữ liệu khu vực." />}
          </div>
        </Card>
      </div>

      {user ? <CandidateForm onDone={load} /> : (
        <Card>
          <p className="muted" style={{ fontSize: 13.5 }}>Đăng nhập để giới thiệu ứng viên mới cho chi nhánh.</p>
        </Card>
      )}
    </div>
  );
}

/* ============================== KHU QUẢN TRỊ ============================== */

export function AdminCandidates() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api.get("/api/admin/recruitment/candidates")
    .then((x) => setRows(Array.isArray(x) ? x : []))
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (form.id) await api.put(`/api/admin/recruitment/candidates/${form.id}`, form);
      else await api.post("/api/admin/recruitment/candidates", form);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const del = async (x) => {
    if (!window.confirm(`Xóa hồ sơ “${x.full_name}”?`)) return;
    try { await api.del(`/api/admin/recruitment/candidates/${x.id}`); load(); }
    catch (e) { setErr(e.message); }
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob("/api/admin/recruitment/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "ung-vien.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  const [search, setSearch] = useState("");
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((x) => [x.full_name, x.position, x.position_type, x.desired_location, x.referrer]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [rows, search]);

  const field = (label, key, kind = "text") => (
    <Field label={label}>
      <input className="inp" type={kind} value={form?.[key] || ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex justify-between items-center" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <b>Ứng viên tuyển dụng</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Quản lý hồ sơ ứng viên do nhân viên giới thiệu hoặc nhập trực tiếp.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
          <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất báo cáo</button>
          <button className="btn btn-red btn-sm" onClick={() => setForm(blankCandidate)}><Plus size={14} />Thêm</button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>Tổng hồ sơ nhận</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: RED, marginTop: 5 }}>{rows.length}</p>
        </Card>
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>HS đang trao đổi</p>
          <p style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{rows.filter((x) => x.status === "negotiating").length}</p>
        </Card>
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>HS đã thử việc</p>
          <p style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{rows.filter((x) => x.status === "probation").length}</p>
        </Card>
        <Card>
          <p className="muted" style={{ fontSize: 12 }}>HS đã nghỉ</p>
          <p style={{ fontSize: 26, fontWeight: 800, marginTop: 5 }}>{rows.filter((x) => x.status === "left").length}</p>
        </Card>
      </div>
      <input className="inp" style={{ maxWidth: 320 }} placeholder="🔎 Tìm theo tên / vị trí / khu vực…"
        value={search} onChange={(e) => setSearch(e.target.value)} />
      {err && <p style={{ color: RED }}>{err}</p>}

      {form && (
        <Card key={form.id || "new"} title={form.id ? "Cập nhật ứng viên" : "Thêm ứng viên"} icon={UserCheck}>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Họ và tên", "full_name")}
            <LocationField form={form} setForm={setForm} />
            <PositionField form={form} setForm={setForm} />
            <PositionTypeField form={form} setForm={setForm} />
            <BirthYearField form={form} setForm={setForm} />
            <EducationField form={form} setForm={setForm} />
            <MajorField form={form} setForm={setForm} />
            {field("Người giới thiệu", "referrer")}
            <Field label="Trạng thái">
              <select className="inp" value={form.status || "new"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(CAND_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Ghi chú">
            <textarea className="inp" rows="3" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setForm(null)}>Hủy</button>
            <button className="btn btn-red" onClick={save}>Lưu</button>
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Họ và tên</th><th>Vị trí</th><th>OFT/FT</th><th>Khu vực</th><th>Năm sinh</th>
                <th>Trình độ</th><th>Chuyên môn</th><th>Người giới thiệu</th><th>Trạng thái</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((x) => (
                <tr key={x.id}>
                  <td><b>{x.full_name}</b></td>
                  <td>{x.position}</td>
                  <td>{x.position_type ? <span className="tag tag-grey">{x.position_type}</span> : "—"}</td>
                  <td>{x.desired_location || "—"}</td>
                  <td>{x.birth_year || "—"}</td>
                  <td>{x.education_level || "—"}</td>
                  <td>{x.major || "—"}</td>
                  <td>{x.referrer || "—"}</td>
                  <td><span className={`tag ${STATUS_TAG[x.status] || "tag-grey"}`}>{x.status_label}</span></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setForm(x)}>Sửa</button>{" "}
                    <button className="btn btn-sm" onClick={() => del(x)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && <Empty title="Chưa có hồ sơ ứng viên." hint={rows.length ? "Không có hồ sơ nào khớp tìm kiếm." : undefined} />}
        </div>
      </Card>
    </div>
  );
}

export function AdminStaffing() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api.get("/api/admin/recruitment/staffing")
    .then((x) => setRows(Array.isArray(x) ? x : []))
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const { danhSach: danhSachTrungTam, tenTrungTam } = useCenters();

  const save = async () => {
    try {
      if (form.id) await api.put(`/api/admin/recruitment/staffing/${form.id}`, form);
      else await api.post("/api/admin/recruitment/staffing", form);
      setForm(null); load();
    } catch (e) { setErr(e.message); }
  };

  const del = async (x) => {
    if (!window.confirm(`Xóa báo cáo trung tâm “${x.center}”?`)) return;
    try { await api.del(`/api/admin/recruitment/staffing/${x.id}`); load(); }
    catch (e) { setErr(e.message); }
  };

  const exportCsv = async () => {
    try {
      const { blob, filename } = await api.blob("/api/admin/recruitment/staffing/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || "dinh-bien-trung-tam.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  const [search, setSearch] = useState("");
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((x) => (x.center || "").toLowerCase().includes(term));
  }, [rows, search]);

  const field = (label, key, kind = "text") => (
    <Field label={label}>
      <input className="inp" type={kind} value={form?.[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: kind === "number" ? Number(e.target.value) : e.target.value })} />
    </Field>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex justify-between items-center" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <b>Định biên thiếu theo trung tâm</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Báo cáo nhanh thiếu OFT/FT và hoạt động tuyển dụng từng trung tâm, cập nhật theo đợt.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
          <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất báo cáo</button>
          <button className="btn btn-red btn-sm" onClick={() => setForm(blankStaffing)}><Plus size={14} />Thêm</button>
        </div>
      </div>
      <input className="inp" style={{ maxWidth: 280 }} placeholder="🔎 Tìm theo trung tâm…"
        value={search} onChange={(e) => setSearch(e.target.value)} />
      {err && <p style={{ color: RED }}>{err}</p>}

      {form && (
        <Card title={form.id ? "Cập nhật báo cáo trung tâm" : "Thêm báo cáo trung tâm"} icon={Building2}>
          <div className="grid md:grid-cols-2 gap-3">
            {field("Ngày chốt số liệu", "report_date", "date")}
            <Field label="Trung tâm">
              <select className="inp" value={form.center || ""}
                onChange={(e) => setForm({ ...form, center: e.target.value })}>
                <option value="">— Chọn trung tâm —</option>
                {danhSachTrungTam.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.short || c.name}</option>
                ))}
              </select>
            </Field>
            {field("Nhà trạm — FT tối thiểu", "nt_ft_dinh_bien", "number")}
            {field("Nhà trạm — FT hiện tại", "nt_ft_hien_tai", "number")}
            {field("Dây máy — FT tối thiểu", "dm_ft_dinh_bien", "number")}
            {field("Dây máy — FT hiện tại", "dm_ft_hien_tai", "number")}
            {field("Dây máy — OFT tối thiểu", "dm_oft_dinh_bien", "number")}
            {field("Dây máy — OFT hiện tại", "dm_oft_hien_tai", "number")}
            {field("Đã đăng Zalo/FB/Hội nhóm (luỹ kế)", "posted_channels", "number")}
            {field("Tiếp xúc trường/BCHQS (luỹ kế)", "school_contacts", "number")}
            {field("Dán băng rôn (luỹ kế)", "banners_posted", "number")}
            {field("Vị trí treo băng rôn", "banner_location")}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 14 }}>
            Không nhập số thiếu FT/OFT — hệ thống lấy định biên trừ hiện tại (âm nghĩa là đang thừa người).
            Cũng không cần nhập "Hồ sơ nhận trong tháng" — hệ thống tự đếm từ danh sách Ứng viên có Khu vực mong muốn khớp trung tâm này.
          </p>
          <Field label="Ghi chú">
            <textarea className="inp" rows="3" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setForm(null)}>Hủy</button>
            <button className="btn btn-red" onClick={save}>Lưu</button>
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Ngày</th><th>Trung tâm</th><th>Thiếu OFT</th><th>Thiếu FT</th><th>Tổng thiếu</th>
                <th>Hồ sơ nhận</th><th>Vị trí băng rôn</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((x) => (
                <tr key={x.id}>
                  <td className="mono">{fmtDay(x.report_date)}</td>
                  <td><b>{tenTrungTam(x.center)}</b></td>
                  <td>{x.oft_gap}</td>
                  <td>{x.ft_gap}</td>
                  <td><span className={`tag ${x.total_gap >= 8 ? "tag-red" : x.total_gap > 0 ? "tag-amber" : "tag-grey"}`}>{x.total_gap}</span></td>
                  <td>{x.applications_received || "—"}</td>
                  <td>{x.banner_location || "—"}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setForm(x)}>Sửa</button>{" "}
                    <button className="btn btn-sm" onClick={() => del(x)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length && <Empty title="Chưa có báo cáo định biên trung tâm." hint={rows.length ? "Không có báo cáo nào khớp tìm kiếm." : undefined} />}
        </div>
      </Card>
    </div>
  );
}
