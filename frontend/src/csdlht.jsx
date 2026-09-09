import React, { useEffect, useState } from "react";
import { Download, RefreshCw, Upload } from "lucide-react";
import { api, getToken } from "./api";
import { Card, Empty, Field, RED } from "./ui";

async function uploadCsdl(file, commit) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/admin/csdl-ht/import?commit=${commit ? "true" : "false"}`, {
    method: "POST", headers, body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.detail) || "Không nhập được tệp.");
  return data;
}

/** Trang quản trị — nhập file Excel CSDL hạ tầng (nằm trong Khu quản trị, tách khỏi trang tra cứu công khai). */
export function AdminCsdlHtImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doPreview = async () => {
    if (!file) return;
    setBusy(true); setErr(""); setPreview(null);
    try { setPreview(await uploadCsdl(file, false)); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const doCommit = async () => {
    if (!file) return;
    setBusy(true); setErr("");
    try { setPreview(await uploadCsdl(file, true)); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Nhập file Excel CSDL hạ tầng" icon={Upload}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
        Chọn đúng file "TỔNG HỢP" (sheet "TỔNG HỢP" + "DM Mã cụm"). Nhập lại sẽ{" "}
        <b>ghi đè toàn bộ</b> dữ liệu của đúng kỳ báo cáo đọc được trong file, không ảnh hưởng các kỳ khác.
        Sau khi ghi, vào trang "CSDL hạ tầng" ở menu chính để tra cứu.
      </p>
      <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setErr(""); }} />
        <button className="btn btn-sm" disabled={!file || busy} onClick={doPreview}>{busy ? "Đang đọc…" : "Xem trước"}</button>
      </div>
      {err && <p style={{ color: RED, marginTop: 8 }}>{err}</p>}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 13 }}>
            Kỳ báo cáo: <b>{preview.period}</b> · Tổng dòng chỉ tiêu: <b>{preview.total_rows}</b> ·
            Trung tâm nhận diện được: <b>{preview.centers_found}</b>
          </p>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="tbl">
              <thead><tr><th>Nhóm</th><th>Số dòng tiêu đề</th><th>Số cột</th><th>Số dòng dữ liệu</th><th></th></tr></thead>
              <tbody>
                {preview.blocks.map((b, i) => (
                  <tr key={i} style={b.skipped ? { opacity: 0.55 } : undefined}>
                    <td style={{ fontSize: 12.5 }}>{b.section}</td>
                    <td>{b.header_rows}</td>
                    <td>{b.columns}</td>
                    <td>{b.data_rows}</td>
                    <td>{b.skipped ? <span className="tag tag-grey">Bỏ qua — {b.skip_reason}</span> : <span className="tag tag-green">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!preview.committed && (
            <button className="btn btn-red" style={{ marginTop: 12 }} disabled={busy} onClick={doCommit}>
              {busy ? "Đang ghi…" : `Xác nhận ghi đè kỳ ${preview.period}`}
            </button>
          )}
          {preview.committed && <p className="tag tag-green" style={{ marginTop: 10, display: "inline-flex" }}>Đã ghi vào hệ thống.</p>}
        </div>
      )}
    </Card>
  );
}

const isPercentLabel = (label) => /t[ỉỷ]\s*l[ệê]|hi[ệê]u\s*su[ấâ]t/i.test(label || "");

const fmtVal = (v, label) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v !== "number") return v;
  if (isPercentLabel(label)) return `${(Math.round(v * 1000) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
};

function downloadCsv(filename, header, rows) {
  const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lines = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob(["﻿" + lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Bảng đúng như trong file Excel gốc: cột đầu là Mã cụm, các cột sau là từng
 * chỉ tiêu, dòng cuối là "Tổng" — tô nền riêng để dễ nhận ra. */
function SectionTable({ periods, period, setPeriod }) {
  const [sections, setSections] = useState([]);
  const [section, setSection] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const p = period ? `?period=${encodeURIComponent(period)}` : "";
    api.get(`/api/admin/csdl-ht/sections${p}`).then((x) => {
      const list = Array.isArray(x) ? x : [];
      setSections(list);
      setSection((s) => (list.includes(s) ? s : list[0] || ""));
    }).catch((e) => setErr(e.message));
  }, [period]);

  const load = () => {
    if (!section) return;
    const p = new URLSearchParams({ section });
    if (period) p.set("period", period);
    api.get(`/api/admin/csdl-ht/section?${p}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); }, [section, period]);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(`csdl-${section}-${period}.csv`, ["Mã cụm", ...data.columns],
      data.rows.map((r) => [r.center, ...r.values.map((v, i) => fmtVal(v, data.columns[i]))]));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <Field label="Nhóm">
          <select className="inp" style={{ minWidth: 320 }} value={section} onChange={(e) => setSection(e.target.value)}>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Kỳ báo cáo">
          <select className="inp" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
        <button className="btn btn-sm" onClick={exportCsv}><Download size={14} />Xuất CSV</button>
      </div>
      {err && <p style={{ color: RED }}>{err}</p>}
      {data && (
        <Card title={data.section} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, lineHeight: 1.2, tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, width: 100, minWidth: 100, background: "#EAF3EA", border: "1px solid #D7E3D7", padding: "4px 8px", zIndex: 1, whiteSpace: "nowrap" }}>Mã cụm</th>
                  {data.columns.map((c, i) => (
                    <th key={i} style={{ width: 110, minWidth: 110, background: "#EAF3EA", border: "1px solid #D7E3D7", padding: "4px 6px", textAlign: "center", fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const isTotal = r.center === "Tổng";
                  return (
                    <tr key={r.center} style={isTotal ? { fontWeight: 800 } : undefined}>
                      <td style={{
                        position: "sticky", left: 0, width: 100, minWidth: 100, border: "1px solid #E7E3E4", padding: "3px 8px",
                        background: isTotal ? "#DCEBDC" : "#fff", fontWeight: 700, whiteSpace: "nowrap",
                      }}>{r.center}</td>
                      {r.values.map((v, i) => (
                        <td key={i} style={{
                          width: 110, minWidth: 110, border: "1px solid #E7E3E4", padding: "3px 8px", textAlign: "right",
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace", whiteSpace: "nowrap",
                          background: isTotal ? "#EAF3EA" : undefined,
                        }}>{fmtVal(v, data.columns[i])}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {data && !data.rows.length && <Empty title="Chưa có dữ liệu cho nhóm / kỳ này." />}
    </div>
  );
}

/** Trang tra cứu công khai (chỉ tài khoản được cấp quyền "csdl_ht" mới thấy ở menu chính) — không có phần nhập liệu. */
export function AdminCsdlHt() {
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState("");

  useEffect(() => {
    api.get("/api/admin/csdl-ht/periods").then((x) => {
      const list = Array.isArray(x) ? x : [];
      setPeriods(list);
      if (list.length) setPeriod((p) => p || list[0]);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="card">
        <b>CSDL HTML</b>
        <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>Tra cứu cơ sở dữ liệu hạ tầng mạng lưới — mỗi nhóm 1 bảng, đúng như file gốc.</p>
      </div>

      {!periods.length
        ? <Empty title="Chưa có dữ liệu." hint="Vào Khu quản trị → Nhập dữ liệu CSDL hạ tầng để bắt đầu." />
        : <SectionTable periods={periods} period={period} setPeriod={setPeriod} />}
    </div>
  );
}
