/**
 * Lịch trực toàn chi nhánh — đội xe, chỉ huy, PVHKT và từng trung tâm.
 * Dữ liệu nhập theo tháng từ file Excel (xem AdminDutyRosterImport bên dưới).
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarClock, ChevronLeft, ChevronRight, Download, Phone, Search, Upload, Users,
} from "lucide-react";
import { api, getToken } from "./api";
import { Card, Empty, Field, RED, RED_DARK } from "./ui";

const SHIFT_COLORS = {
  TB: "#2E6FDB", CH: "#B4780C", LX: "#1E7A46", KT: "#6B4FA0",
};
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAY_FULL = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const MAIN_BLOCKS = ["PVHKT", "Lái xe", "Chỉ Huy"];

function ShiftBadge({ code }) {
  if (!code) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28,
      padding: "2px 7px", borderRadius: 5, color: "#fff", fontWeight: 700, fontSize: 11,
      background: SHIFT_COLORS[code] || "#807A7C",
    }}>{code}</span>
  );
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function weekdayIdx(iso) { return new Date(iso + "T00:00:00").getDay(); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function personMatches(p, term) {
  if (!term) return true;
  const hay = `${p.name} ${p.code} ${p.phone} ${p.title}`.toLowerCase();
  return hay.includes(term);
}

function RosterTable({ people }) {
  if (!people.length) return <p className="muted" style={{ fontSize: 13, fontStyle: "italic", padding: "10px 0" }}>Không có ai trực.</p>;
  return (
    <table className="tbl">
      <thead><tr><th style={{ width: 32 }}>STT</th><th>Tên nhân viên</th><th>SĐT</th><th>Chức danh</th></tr></thead>
      <tbody>
        {people.map((p, i) => (
          <tr key={p.code || p.name}>
            <td className="mono muted">{i + 1}</td>
            <td>
              <b>{p.name}</b>
              {p.event && <span style={{ display: "block", fontSize: 11, color: "#B4780C", fontWeight: 700, marginTop: 2 }}>⚠ Hỗ trợ {p.location || p.event}</span>}
            </td>
            <td className="mono">{p.phone || "—"}</td>
            <td>{p.title || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DutyRosterView() {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [date, setDate] = useState("");
  const [view, setView] = useState("day");     // "day" | "grid"
  const [subTab, setSubTab] = useState("main"); // "main" | center name
  const [gridBlock, setGridBlock] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/api/duty-roster/months").then((m) => { setMonths(m); if (m.length) setMonth(m[0]); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!month) return;
    api.get(`/api/duty-roster?month=${month}`)
      .then((d) => {
        setData(d);
        const t = todayISO();
        setDate(d.dates.includes(t) ? t : (d.dates[0] || ""));
      })
      .catch((e) => setErr(e.message));
  }, [month]);

  const centerBlocks = useMemo(
    () => (data?.blocks || []).filter((b) => !MAIN_BLOCKS.includes(b.name)),
    [data],
  );

  if (err) return <Empty title="Không tải được lịch trực." hint={err} />;
  if (!months.length) return <Empty title="Chưa có dữ liệu lịch trực." hint="Quản trị viên cần tải file Excel lịch trực lên ở khu quản trị." />;
  if (!data) return <Empty title="Đang tải…" />;

  const dayIdx = data.dates.indexOf(date);
  const term = search.trim().toLowerCase();

  const findBlock = (name) => data.blocks.find((b) => b.name === name);
  const onDutyThatDay = (block) => (block ? block.people.filter((p) => p.shifts[dayIdx] && personMatches(p, term)) : []);

  return (
    <div className="flex flex-col gap-4">
      <Card title="Lịch trực toàn chi nhánh" icon={CalendarClock}
        action={months.length > 1 && (
          <select className="inp" style={{ maxWidth: 140 }} value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}>
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 260 }} placeholder="🔎 Tìm tên / mã NV / SĐT…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex items-center gap-1" style={{ marginLeft: "auto" }}>
            <button className="btn btn-sm" disabled={dayIdx <= 0}
              onClick={() => setDate(data.dates[dayIdx - 1])}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 800, color: RED, fontSize: 14, minWidth: 170, textAlign: "center" }}>
              {date && `${WEEKDAY_FULL[weekdayIdx(date)]} ${fmtDate(date)}`}
            </span>
            <button className="btn btn-sm" disabled={dayIdx < 0 || dayIdx >= data.dates.length - 1}
              onClick={() => setDate(data.dates[dayIdx + 1])}><ChevronRight size={14} /></button>
            {data.dates.includes(todayISO()) && (
              <button className="btn btn-sm" onClick={() => setDate(todayISO())}>Hôm nay</button>
            )}
          </div>
        </div>
        <div className="flex gap-2" style={{ marginTop: 12 }}>
          <button className={`btn btn-sm ${view === "day" ? "btn-red" : ""}`} onClick={() => setView("day")}>Theo ngày</button>
          <button className={`btn btn-sm ${view === "grid" ? "btn-red" : ""}`} onClick={() => setView("grid")}>Bảng đầy đủ cả tháng</button>
        </div>
      </Card>

      {view === "day" && (
        <>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            <button className={`btn btn-sm ${subTab === "main" ? "btn-red" : ""}`} onClick={() => setSubTab("main")}>
              PVHKT / Lái xe / Chỉ huy
            </button>
            {centerBlocks.map((b) => (
              <button key={b.name} className={`btn btn-sm ${subTab === b.name ? "btn-red" : ""}`} onClick={() => setSubTab(b.name)}>
                {b.name}
              </button>
            ))}
          </div>

          {subTab === "main" ? (
            <>
              <Card title="Trực ban PVHKT" icon={Users} pad={false}>
                <div style={{ padding: "4px 16px 14px", overflowX: "auto" }}><RosterTable people={onDutyThatDay(findBlock("PVHKT"))} /></div>
              </Card>
              <Card title="Trực chỉ huy" icon={Building2} pad={false}>
                <div style={{ padding: "4px 16px 14px", overflowX: "auto" }}><RosterTable people={onDutyThatDay(findBlock("Chỉ Huy"))} /></div>
              </Card>
              <Card title="Trực lái xe" icon={Phone} pad={false}>
                <div style={{ padding: "4px 16px 14px", overflowX: "auto" }}><RosterTable people={onDutyThatDay(findBlock("Lái xe"))} /></div>
              </Card>
            </>
          ) : (
            <Card title={subTab} icon={Building2} pad={false}>
              <div style={{ padding: "4px 16px 14px", overflowX: "auto" }}><RosterTable people={onDutyThatDay(findBlock(subTab))} /></div>
            </Card>
          )}
        </>
      )}

      {view === "grid" && (
        <Card title="Bảng đầy đủ cả tháng" icon={CalendarClock}
          action={
            <select className="inp" style={{ maxWidth: 220 }} value={gridBlock} onChange={(e) => setGridBlock(Number(e.target.value))}>
              {data.blocks.map((b, i) => <option key={b.name} value={i}>{b.name}</option>)}
            </select>
          }
          pad={false}>
          <div style={{ overflowX: "auto", padding: 4 }}>
            <table className="tbl mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, background: "#FBF4F5", textAlign: "left", minWidth: 170 }}>Họ tên / Chức danh</th>
                  {data.dates.map((d) => (
                    <th key={d} style={{ background: d === todayISO() ? RED_DARK : undefined, color: d === todayISO() ? "#fff" : undefined }}>
                      {fmtDate(d).slice(0, 5)}<br />{WEEKDAY_SHORT[weekdayIdx(d)]}
                    </th>
                  ))}
                  <th>Hỗ trợ</th>
                </tr>
              </thead>
              <tbody>
                {(data.blocks[gridBlock]?.people || []).filter((p) => personMatches(p, term)).map((p) => (
                  <tr key={p.code || p.name}>
                    <td style={{ position: "sticky", left: 0, background: "#fff", textAlign: "left" }}>
                      <b>{p.name}</b><br /><span className="muted" style={{ fontSize: 11 }}>{p.title}</span>
                    </td>
                    {p.shifts.map((code, i) => (
                      <td key={i} style={{ background: data.dates[i] === todayISO() ? "#FFF6E5" : undefined }}>
                        <ShiftBadge code={code} />
                      </td>
                    ))}
                    <td style={{ textAlign: "left", fontSize: 11, color: RED_DARK }}>
                      {p.event ? `${p.event}${p.location ? " · " + p.location : ""}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================== KHU QUẢN TRỊ — nhập lịch trực ============================== */

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function AdminDutyRosterImport() {
  const [templateMonth, setTemplateMonth] = useState(currentMonthStr());
  const [tplErr, setTplErr] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const downloadTemplate = async () => {
    setTplErr("");
    try {
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/admin/duty-roster/template?month=${templateMonth}`, { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Không tải được tệp mẫu.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `mau-lich-truc-${templateMonth}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setTplErr(e.message); }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true); setMsg(""); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/admin/duty-roster/import", { method: "POST", headers, body: fd });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.detail || `Máy chủ báo lỗi ${res.status}.`);
      setMsg(`Đã nhập ${r.rows} dòng · ${r.people} người · ${r.blocks.length} khối · từ ${r.date_from} đến ${r.date_to}.`);
      setFile(null);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card title="Bước 1 — Tải biểu mẫu Excel" icon={Download}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          Tệp mẫu đã điền sẵn đúng số cột ngày của tháng bạn chọn, kèm vài dòng ví dụ (PVHKT / Lái
          xe / Chỉ Huy / một trung tâm) và trang hướng dẫn cách nhập.
        </p>
        <div className="flex items-end gap-3" style={{ flexWrap: "wrap" }}>
          <Field label="Tháng">
            <input type="month" className="inp" value={templateMonth} onChange={(e) => setTemplateMonth(e.target.value)} />
          </Field>
          <button className="btn btn-red" onClick={downloadTemplate} style={{ marginBottom: 14 }}>
            <Download size={15} /> Tải biểu mẫu
          </button>
        </div>
        {tplErr && <p style={{ background: "#FBF4F5", color: RED, padding: "9px 12px", borderRadius: 9, fontSize: 13 }}>{tplErr}</p>}
      </Card>

      <Card title="Bước 2 — Nhập lại sau khi điền dữ liệu" icon={Upload}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
          Tải lên đúng tệp Excel dạng "Tổng hợp" (cột A là tên khối: PVHKT / Lái xe / Chỉ Huy /
          tên trung tâm; cột B–F là mã NV, tên, SĐT, tổ nhóm, chức danh; từ cột G là các cột ngày
          trong tháng). Nhập lại đúng khoảng ngày đã có sẽ tự thay thế dữ liệu cũ của khoảng đó,
          không tạo trùng.
        </p>
        <Field label="Tệp Excel (.xlsx)">
          <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </Field>
        {msg && <p style={{ background: "#E7F6EF", color: "#0A7A50", padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{msg}</p>}
        {err && <p style={{ background: "#FBF4F5", color: RED, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{err}</p>}
        <button className="btn btn-red" onClick={upload} disabled={!file || busy}>
          <Upload size={15} /> {busy ? "Đang nhập…" : "Nhập lịch trực"}
        </button>
      </Card>
    </div>
  );
}
