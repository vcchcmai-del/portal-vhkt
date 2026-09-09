/**
 * NHẬP DỮ LIỆU HÀNG LOẠT
 *
 * Ba cách đưa dữ liệu vào, xếp theo mức độ dễ dùng:
 *   1. Sao chép từ Excel rồi dán thẳng vào ô — nhanh nhất, không cần lưu tệp.
 *   2. Chọn tệp CSV hoặc Excel từ máy tính.
 *   3. Tải tệp mẫu về, điền, rồi nhập lại.
 *
 * Luôn xem trước rồi mới ghi: người dùng thấy từng dòng sẽ thêm mới hay cập nhật,
 * dòng nào lỗi và lỗi vì sao, trước khi bấm xác nhận.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, ClipboardPaste, Download, FileSpreadsheet,
  Loader2, RefreshCw, Table2, Upload, X,
} from "lucide-react";

import { API_BASE, api, getToken } from "./api";
import { Card, Check as CheckBox, Empty, Field, RED, RED_DARK } from "./ui";

const STATUS = {
  them_moi: { label: "Thêm mới", cls: "tag-green" },
  cap_nhat: { label: "Cập nhật", cls: "tag-amber" },
  bo_qua: { label: "Bỏ qua", cls: "tag-grey" },
  loi: { label: "Lỗi", cls: "tag-red" },
};

export function AdminImport({ fixedKind, boardScope, nhomLabel } = {}) {
  const [kinds, setKinds] = useState([]);
  const [kind, setKind] = useState(fixedKind || "people");
  const [text, setText] = useState("");
  const [mode, setMode] = useState("upsert");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    api.get("/api/admin/import/kinds").then(setKinds).catch((e) => setErr(e.message));
  }, []);

  const spec = kinds.find((k) => k.kind === kind);

  const reset = () => { setResult(null); setErr(""); setFileName(""); setPendingFile(null); };

  /* ---------------- Xem trước và ghi ---------------- */

  const runText = async (commit) => {
    if (!text.trim()) { setErr("Chưa có dữ liệu. Hãy dán bảng vào ô bên dưới hoặc chọn tệp."); return; }
    setBusy(true); setErr("");
    try {
      const r = await api.post("/api/admin/import/text", { kind, text, mode, commit });
      setResult(r);
      if (commit) { setText(""); setPendingFile(null); }
    } catch (e) { setErr(e.message); setResult(null); }
    setBusy(false);
  };

  const runFile = async (file, commit) => {
    if (!file) return;
    setBusy(true); setErr("");
    const form = new FormData();
    form.append("file", file);
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/import/file?kind=${kind}&mode=${mode}&commit=${commit}`,
        { method: "POST", headers, body: form }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Máy chủ báo lỗi ${res.status}.`);
      setResult(data);
      if (commit) setPendingFile(null);
    } catch (e) { setErr(e.message); setResult(null); }
    setBusy(false);
  };

  const downloadTemplate = async (dinhDang) => {
    try {
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const qs = boardScope
        ? `?boards=${encodeURIComponent(boardScope.map((b) => b.value).join(","))}${nhomLabel ? `&nhom=${encodeURIComponent(nhomLabel)}` : ""}`
        : "";
      const path = dinhDang === "xlsx"
        ? `/api/admin/import/template-xlsx/${kind}${qs}`
        : `/api/admin/import/template/${kind}${qs}`;
      const res = await fetch(`${API_BASE}${path}`, { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Không tải được tệp mẫu.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      // Lấy đúng tên tệp máy chủ đã đặt (khớp tên tab) thay vì đặt cứng "mau-{kind}".
      const dat = res.headers.get("content-disposition") || "";
      const khop = dat.match(/filename="?([^"]+)"?/);
      a.href = url; a.download = khop ? khop[1] : `mau-${kind}.${dinhDang}`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  // Xuất số liệu Dashboard đúng phạm vi các bảng của tab này — chỉ áp dụng
  // cho nhóm "metrics" (số liệu Dashboard), các nhóm khác (nhân viên, lịch
  // công tác...) chưa có API xuất theo hạng mục tương tự.
  const xuatDuLieuTab = async () => {
    if (fixedKind !== "metrics" || !boardScope) return;
    try {
      const headers = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const qs = `?board=${encodeURIComponent(boardScope.map((b) => b.value).join(","))}${nhomLabel ? `&nhom=${encodeURIComponent(nhomLabel)}` : ""}`;
      const res = await fetch(`${API_BASE}/api/admin/metrics/export${qs}`, { headers });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Không xuất được báo cáo.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dat = res.headers.get("content-disposition") || "";
      const khop = dat.match(/filename="?([^"]+)"?/);
      a.href = url; a.download = khop ? khop[1] : "so-lieu-dashboard.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  const t = result?.tom_tat;
  const rows = result?.chi_tiet || [];
  const shown = onlyProblems ? rows.filter((r) => r.trang_thai === "loi" || r.trang_thai === "bo_qua") : rows;
  const coTheGhi = t && (t.them_moi > 0 || t.cap_nhat > 0);
  const coDuLieu = text.trim() || pendingFile;

  // Dòng nào có cột "bang" nằm ngoài phạm vi màn này — chặn hẳn, không cho xem
  // trước/ghi, để đúng yêu cầu "chỉ nhập được dữ liệu của đúng tab đang mở".
  // Kiểm tra sớm từ chữ dán vào (trước khi xem trước) lẫn từ kết quả xem
  // trước/tệp tải lên (bang sau khi máy chủ đã đọc, che luôn đường vòng qua tệp).
  // Cột "bang" giờ chấp nhận cả mã (PAKH) lẫn đúng tên hiển thị (Sự cố truyền
  // dẫn...) — so khớp cả hai dạng, không phân biệt hoa/thường, mới không báo
  // nhầm "ngoài phạm vi" khi dán lại đúng tệp vừa xuất ra.
  const trongPhamVi = (raw) => {
    const sach = (raw || "").trim().replace(/^"|"$/g, "");
    if (!sach) return true;
    const ck = sach.toLowerCase();
    return boardScope.some((b) => b.value.toLowerCase() === ck || b.label.toLowerCase() === ck);
  };
  // Một vài tên bảng có dấu phẩy ngay trong tên (ví dụ "XLCS CĐBR (Số PA phát
  // sinh, XLCS 3h/10h/24h)") — nếu tách cột kiểu CSV bằng dấu phẩy sẽ cắt
  // nhầm giữa chừng tên đó. Dán từ Excel luôn phân tách bằng tab nên ưu tiên
  // tách bằng tab trước, chỉ dùng phẩy/chấm phẩy khi dòng không có tab.
  const cotDauTien = (dong) => (dong.includes("\t") ? dong.split("\t")[0] : dong.split(/,|;/)[0]);
  const maBangNgoaiPhamDanChu = boardScope && text.trim()
    ? [...new Set(
        text.trim().split(/\r?\n/).slice(1)
          .map((dong) => cotDauTien(dong)?.trim())
          .filter((ma) => ma && !trongPhamVi(ma))
      )]
    : [];
  const maBangNgoaiPhamKetQua = boardScope && rows.length
    ? [...new Set(
        rows.map((r) => r.du_lieu?.bang?.trim())
          .filter((ma) => ma && !trongPhamVi(ma))
      )]
    : [];
  const maBangNgoaiPham = [...new Set([...maBangNgoaiPhamDanChu, ...maBangNgoaiPhamKetQua])];

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-start gap-3" style={{ padding: 16, borderLeft: `3px solid ${RED}` }}>
        <Table2 size={19} style={{ color: RED, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Nhập dữ liệu hàng loạt</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
            Thêm và sửa nhiều dòng cùng lúc. Hệ thống luôn cho xem trước kết quả trước khi ghi.
            Nhập lại cùng một tệp sẽ cập nhật bản ghi cũ chứ không tạo bản trùng.
          </p>
        </div>
      </div>

      {boardScope && (
        <div className="card" style={{ padding: 14, borderLeft: "3px solid #0E6CD6" }}>
          <div className="flex items-center justify-between gap-2" style={{ flexWrap: "wrap" }}>
            <p style={{ fontWeight: 700, fontSize: 13.5 }}>Mã bảng dùng ở màn này</p>
            {fixedKind === "metrics" && (
              <button className="btn btn-sm" onClick={xuatDuLieuTab}>
                <Download size={13} /> Xuất số liệu {nhomLabel ? `"${nhomLabel}"` : "của tab này"}
              </button>
            )}
          </div>
          <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
            {boardScope.map((b) => (
              <span key={b.value} className="tag tag-grey mono" style={{ fontSize: 12 }}>{b.value} — {b.label}</span>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Cột "bang" trong dữ liệu dán/tải lên chỉ nên dùng đúng mã HOẶC đúng tên ở trên (tệp xuất từ đúng
            màn này dùng sẵn tên, không cần đổi lại). Nhập cho bảng khác thì dùng đúng màn "Nhập từ Excel"
            của tab đó, tránh nhầm dữ liệu giữa các tab.
          </p>
          {maBangNgoaiPham.length > 0 && (
            <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px",
                        borderRadius: 9, fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>
              Dữ liệu có mã bảng ngoài phạm vi màn này: <strong>{maBangNgoaiPham.join(", ")}</strong> — đã
              chặn xem trước/ghi. Xoá các dòng đó hoặc dán vào đúng màn "Nhập từ Excel" của tab tương ứng.
            </p>
          )}
        </div>
      )}

      {/* Bước 1: chọn nhóm dữ liệu (bỏ qua nếu đã gắn cố định một nhóm) */}
      <Card title={fixedKind ? "Cột dữ liệu cần có" : "Bước 1 — Chọn nhóm dữ liệu"} icon={FileSpreadsheet}>
        {!fixedKind && (
          <div className="flex gap-2 scroll-x" style={{ paddingBottom: 2 }}>
            {kinds.map((k) => (
              <button key={k.kind} className={`chip ${kind === k.kind ? "on" : ""}`}
                onClick={() => { setKind(k.kind); reset(); }}>
                {k.label}
              </button>
            ))}
          </div>
        )}

        {spec && (
          <>
            <p className="dim" style={{ fontSize: 13, marginTop: 14 }}>{spec.note}</p>

            <p className="eyebrow-grey" style={{ marginTop: 16, marginBottom: 8 }}>Các cột của bảng</p>
            <div style={{ overflowX: "auto", border: "1px solid #E7E3E4", borderRadius: 10 }}>
              <table className="tbl">
                <thead><tr><th>Tên cột</th><th>Ý nghĩa</th><th>Ví dụ</th></tr></thead>
                <tbody>
                  {spec.columns.map((c) => (
                    <tr key={c.name}>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {c.name} {c.required && <span className="tag tag-red" style={{ marginLeft: 6 }}>bắt buộc</span>}
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{c.label}</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{c.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn btn-red btn-sm" onClick={() => downloadTemplate("xlsx")}>
                <FileSpreadsheet size={14} /> Tải tệp mẫu Excel
              </button>
              <button className="btn btn-sm" onClick={() => downloadTemplate("csv")}>
                <Download size={14} /> Tải tệp mẫu CSV
              </button>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Tệp Excel có sẵn dòng tiêu đề đúng chuẩn, một dòng ví dụ, cột bắt buộc tô đỏ,
              kèm một trang hướng dẫn cách điền. Điền xong tải ngược lên là xong.
            </p>
          </>
        )}
      </Card>

      {/* Bước 2: đưa dữ liệu vào */}
      <Card title="Bước 2 — Đưa dữ liệu vào" icon={ClipboardPaste}>
        <p className="dim" style={{ fontSize: 13, marginBottom: 10 }}>
          Mở bảng tính, bôi đen cả vùng dữ liệu <strong>kèm dòng tiêu đề</strong>, nhấn Ctrl+C,
          rồi dán vào ô bên dưới bằng Ctrl+V.
        </p>

        <textarea className="inp mono" rows={7} value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          placeholder={spec ? spec.columns.map((c) => c.name).join("\t") : "Dán bảng vào đây…"}
          style={{ fontSize: 12.5, whiteSpace: "pre", overflowX: "auto" }} />

        <div className="flex items-center gap-3" style={{ margin: "14px 0", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12.5 }}>hoặc</span>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Chọn tệp CSV hoặc Excel
          </button>
          {fileName && <span className="tag tag-grey">{fileName}</span>}
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xlsm,text/csv" style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFileName(f.name); setPendingFile(f); setText(""); runFile(f, false); }
              e.target.value = "";
            }} />
        </div>

        <p className="eyebrow-grey" style={{ marginBottom: 8 }}>Khi gặp dòng đã có sẵn</p>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className={`chip ${mode === "upsert" ? "on" : ""}`} onClick={() => { setMode("upsert"); setResult(null); }}>
            Cập nhật đè lên
          </button>
          <button className={`chip ${mode === "create_only" ? "on" : ""}`} onClick={() => { setMode("create_only"); setResult(null); }}>
            Bỏ qua, chỉ thêm mới
          </button>
        </div>

        <div className="flex gap-2" style={{ marginTop: 16 }}>
          <button className="btn btn-red" disabled={busy || !coDuLieu || maBangNgoaiPhamDanChu.length > 0}
            onClick={() => (pendingFile ? runFile(pendingFile, false) : runText(false))}>
            {busy ? <Loader2 size={15} className="spin" /> : <ArrowRight size={15} />}
            {busy ? "Đang đọc…" : "Xem trước kết quả"}
          </button>
          {(text || result) && (
            <button className="btn" onClick={() => { setText(""); reset(); }}>
              <X size={14} /> Xoá hết
            </button>
          )}
        </div>

        {err && (
          <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "10px 13px",
                      borderRadius: 9, fontSize: 13, marginTop: 14 }}>{err}</p>
        )}
      </Card>

      {/* Bước 3: kiểm tra rồi ghi */}
      {result && (
        <Card title={result.da_ghi ? "Kết quả đã ghi" : "Bước 3 — Kiểm tra rồi xác nhận ghi"}
          icon={result.da_ghi ? Check : AlertTriangle}
          action={
            <button className="btn btn-sm" onClick={() => setOnlyProblems((v) => !v)}>
              {onlyProblems ? "Xem tất cả dòng" : "Chỉ xem dòng có vấn đề"}
            </button>
          }>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" style={{ marginBottom: 14 }}>
            {[
              ["Tổng số dòng", t.tong_dong, "#4B4749"],
              ["Thêm mới", t.them_moi, "#0A7A50"],
              ["Cập nhật", t.cap_nhat, "#95610A"],
              ["Bỏ qua", t.bo_qua, "#807A7C"],
              ["Lỗi", t.loi, RED],
            ].map(([l, v, color]) => (
              <div key={l} style={{ padding: "10px 12px", border: "1px solid #E7E3E4", borderRadius: 10 }}>
                <p className="muted" style={{ fontSize: 11 }}>{l}</p>
                <p className="mono" style={{ fontWeight: 800, fontSize: 20, color }}>{v}</p>
              </div>
            ))}
          </div>

          {result.da_ghi ? (
            <p style={{ background: "#EEF8F1", color: "#0A7A50", padding: "11px 13px",
                        borderRadius: 10, fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>
              Đã ghi vào hệ thống: {result.da_them} bản ghi mới, {result.da_cap_nhat} bản ghi được cập nhật.
              {t.loi > 0 && ` ${t.loi} dòng lỗi đã được bỏ qua.`}
            </p>
          ) : (
            <>
              {t.loi > 0 && (
                <p style={{ background: "#FFF8E8", color: "#8A5A08", padding: "11px 13px",
                            borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                  Có {t.loi} dòng lỗi. Bấm ghi thì các dòng lỗi bị bỏ qua, những dòng còn lại vẫn được nhập.
                  Muốn nhập đủ thì sửa trên bảng tính rồi dán lại.
                </p>
              )}
              <div className="flex gap-2" style={{ marginBottom: 16, flexWrap: "wrap" }}>
                <button className="btn btn-red" disabled={busy || !coTheGhi || maBangNgoaiPhamKetQua.length > 0}
                  onClick={() => (pendingFile ? runFile(pendingFile, true) : runText(true))}>
                  {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                  Xác nhận ghi {t.them_moi + t.cap_nhat} dòng vào hệ thống
                </button>
                <button className="btn" onClick={reset}>Huỷ</button>
              </div>
              {!coTheGhi && (
                <p className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
                  Không có dòng nào ghi được. Sửa lại dữ liệu rồi thử lần nữa.
                </p>
              )}
            </>
          )}

          {shown.length === 0 ? (
            <Empty title="Không có dòng nào để hiện." />
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #E7E3E4", borderRadius: 10 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Dòng</th>
                    <th style={{ width: 110 }}>Trạng thái</th>
                    <th>Nội dung</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.dong}>
                      <td className="mono">{r.dong}</td>
                      <td><span className={`tag ${STATUS[r.trang_thai]?.cls}`}>{STATUS[r.trang_thai]?.label}</span></td>
                      <td>
                        {r.thong_bao && (
                          <p style={{ fontSize: 12.5, fontWeight: 600,
                                      color: r.trang_thai === "loi" ? RED_DARK : "#4B4749" }}>
                            {r.thong_bao}
                          </p>
                        )}
                        <p className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>
                          {Object.entries(r.du_lieu || {})
                            .filter(([, v]) => v)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join("  ·  ")}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rows.length >= 300 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Chỉ hiện 300 dòng đầu. Toàn bộ dữ liệu vẫn được xử lý đầy đủ.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
