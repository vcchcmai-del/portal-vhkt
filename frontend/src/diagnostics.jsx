/**
 * KIỂM TRA HỆ THỐNG
 *
 * Khi một màn hình quản trị báo lỗi mà không rõ vì sao, vào đây bấm kiểm tra.
 * Màn hình chạy thử từng phần và chỉ thẳng ra chỗ hỏng kèm lý do, thay vì để
 * người dùng đoán.
 */
import React, { useEffect, useState } from "react";
import {
  AlertTriangle, Check, Database, Loader2, RefreshCw, Wrench,
} from "lucide-react";

import { api } from "./api";
import { Card, Empty, RED, RED_DARK } from "./ui";

export function AdminDiagnostics() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fixing, setFixing] = useState(false);

  const run = () => {
    setBusy(true); setErr("");
    api.get("/api/admin/diagnostics")
      .then(setData)
      .catch((e) => { setErr(e.message); setData(null); })
      .finally(() => setBusy(false));
  };

  useEffect(run, []);

  const repair = async () => {
    setFixing(true);
    try {
      const r = await api.post("/api/admin/diagnostics/repair-schema");
      window.alert(r.thong_bao);
      run();
    } catch (e) { window.alert(e.message); }
    setFixing(false);
  };

  const tq = data?.tong_quan;
  const canFix = tq && tq.so_bang_thieu_cot > 0;
  const allOk = tq && tq.so_muc_loi === 0 && tq.so_bang_thieu_cot === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center justify-between gap-3" style={{ padding: 16, flexWrap: "wrap", borderLeft: `3px solid ${RED}` }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Kiểm tra hệ thống</p>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
            Chạy thử từng phần và chỉ ra chỗ hỏng kèm lý do. Dùng khi một màn hình báo lỗi
            mà chưa rõ nguyên nhân.
          </p>
        </div>
        <button className="btn btn-red" onClick={run} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          {busy ? "Đang kiểm tra…" : "Kiểm tra lại"}
        </button>
      </div>

      {err && (
        <Card><p style={{ color: RED_DARK, fontSize: 13.5 }}>{err}</p></Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Mục đã kiểm tra", tq.so_muc_kiem_tra, "#4B4749"],
              ["Mục gặp lỗi", tq.so_muc_loi, tq.so_muc_loi ? RED : "#0A7A50"],
              ["Bảng thiếu cột", tq.so_bang_thieu_cot, tq.so_bang_thieu_cot ? RED : "#0A7A50"],
            ].map(([l, v, c]) => (
              <div key={l} className="card" style={{ padding: 14 }}>
                <p className="muted" style={{ fontSize: 11.5 }}>{l}</p>
                <p className="mono" style={{ fontSize: 24, fontWeight: 800, color: c, marginTop: 4 }}>{v}</p>
              </div>
            ))}
          </div>

          {allOk && (
            <p style={{ background: "#EEF8F1", color: "#0A7A50", padding: "12px 14px",
                        borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>
              Hệ thống bình thường. Không phát hiện lỗi nào.
            </p>
          )}

          {canFix && (
            <div style={{ background: "#FFF8E8", border: "1px solid #F0DFB4", borderRadius: 12, padding: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#8A5A08" }}>
                Cơ sở dữ liệu thiếu cột so với mã nguồn
              </p>
              <p style={{ fontSize: 13, color: "#6B5426", marginTop: 6, lineHeight: 1.6 }}>
                Đây là nguyên nhân thường gặp của lỗi 502 ở một vài màn hình quản trị.
                Bấm nút bên dưới để bổ sung. Thao tác chỉ thêm cột, không xoá và không
                làm mất dữ liệu đang có.
              </p>
              <button className="btn btn-red" style={{ marginTop: 12 }} onClick={repair} disabled={fixing}>
                {fixing ? <Loader2 size={15} className="spin" /> : <Wrench size={15} />}
                {fixing ? "Đang sửa…" : "Bổ sung cột còn thiếu"}
              </button>
            </div>
          )}

          <Card title="Kết quả từng phần" icon={Check} pad={false}>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th style={{ width: 110 }}>Trạng thái</th><th style={{ width: 220 }}>Phần</th><th>Chi tiết</th></tr></thead>
                <tbody>
                  {data.kiem_tra.map((k) => (
                    <tr key={k.ten}>
                      <td>
                        <span className={`tag ${k.trang_thai === "ok" ? "tag-green" : "tag-red"}`}>
                          {k.trang_thai === "ok" ? "Bình thường" : "Lỗi"}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{k.ten}</td>
                      <td className="mono" style={{ fontSize: 12,
                          color: k.trang_thai === "ok" ? "#807A7C" : RED_DARK }}>
                        {k.ghi_chu}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Cấu trúc cơ sở dữ liệu" icon={Database} pad={false}>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th>Bảng</th><th style={{ width: 90 }}>Số cột</th><th style={{ width: 130 }}>Trạng thái</th><th>Cột còn thiếu</th></tr></thead>
                <tbody>
                  {data.cau_truc.map((t) => (
                    <tr key={t.bang}>
                      <td className="mono" style={{ fontWeight: 600 }}>{t.bang}</td>
                      <td className="mono muted">{t.so_cot ?? "—"}</td>
                      <td>
                        <span className={`tag ${t.trang_thai === "ok" ? "tag-green" : "tag-red"}`}>
                          {t.trang_thai === "ok" ? "Đủ" : t.trang_thai === "thieu_bang" ? "Thiếu bảng" : "Thiếu cột"}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: RED_DARK }}>
                        {(t.thieu_cot || []).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Thông tin máy chủ" icon={AlertTriangle}>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                ["Phiên bản API", data.he_thong.api_version ?? "không rõ"],
                ["Phiên bản Python", data.he_thong.python],
                ["Cơ sở dữ liệu", data.he_thong.csdl],
                ["Thư mục dữ liệu", data.he_thong.thu_muc_du_lieu],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: 12, background: "#F8F6F6", borderRadius: 10 }}>
                  <p className="eyebrow-grey" style={{ fontSize: 10 }}>{l}</p>
                  <p className="mono" style={{ fontSize: 12.5, marginTop: 4, wordBreak: "break-all" }}>{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!data && !err && !busy && <Empty title="Chưa có kết quả." />}
    </div>
  );
}
