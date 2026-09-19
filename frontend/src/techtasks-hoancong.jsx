import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, coQuyen } from "./api";
import { Card, RED } from "./ui";

/*
 * Bảng hoàn công của một đầu việc.
 *
 * Hoàn công không chia theo 13 trung tâm như các đầu việc khác mà chia theo
 * nhóm MCT (1, 2, 3) và trạng thái hồ sơ; mỗi ô hai con số: số lượng MCT và
 * công nợ. Kế hoạch từng nhóm là TỔNG các trạng thái — tự cộng, không nhập tay,
 * nên bảng không bao giờ tự mâu thuẫn.
 */

const so = (n, le = 0) => (n ? Number(n).toLocaleString("vi-VN", { maximumFractionDigits: le, minimumFractionDigits: le }) : "—");
const TEN_DON_VI = { ty: "tỷ đồng", trieu: "triệu đồng" };

export function BangHoanCong({ category, label }) {
  const [dl, setDl] = useState(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [sua, setSua] = useState(null);     // {nhom, trang_thai, sl_mct, cong_no, note}
  const [err, setErr] = useState("");
  const donVi = dl?.don_vi || "ty";
  const tenDonVi = TEN_DON_VI[donVi] || TEN_DON_VI.ty;
  const duocSua = coQuyen("tech_tasks", "update");

  const tai = (ky = period) => api.get(`/api/admin/hoan-cong/${category}?period=${encodeURIComponent(ky)}`)
    .then((x) => { setDl(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { tai(); }, [category, period]);

  const luu = async () => {
    try {
      await api.put(`/api/admin/hoan-cong/${category}`, {
        period, nhom: sua.nhom, trang_thai: sua.trang_thai,
        sl_mct: Number(sua.sl_mct) || 0, cong_no: Number(sua.cong_no) || 0, note: sua.note || "",
      });
      setSua(null); tai();
    } catch (e) { setErr(e.message); }
  };

  /** Đổi đơn vị chỉ đổi cách đọc con số, không nhân chia lại số đã nhập. */
  const doiDonVi = async (v) => {
    try {
      await api.put(`/api/admin/tech-tasks/categories/${category}`, { hc_don_vi: v });
      tai();
    } catch (e) { setErr(e.message); }
  };

  if (!dl) return <Card title={`Hoàn công — ${label}`}><p className="muted">Đang tải…</p></Card>;

  const cot = dl.nhom[0]?.trang_thai || [];

  return (
    <Card title={`Hoàn công — ${label}`}
      action={(
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 120 }} value={period} list="ky-hc"
            onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" />
          <datalist id="ky-hc">{(dl.ky_co_so_lieu || []).map((k) => <option key={k} value={k} />)}</datalist>
          {duocSua && (
            <select className="inp" style={{ maxWidth: 150 }} value={donVi}
              title="Đơn vị của cột Công nợ" onChange={(e) => doiDonVi(e.target.value)}>
              <option value="ty">Công nợ: tỷ đồng</option>
              <option value="trieu">Công nợ: triệu đồng</option>
            </select>
          )}
          <button className="btn btn-sm" onClick={() => tai()}><RefreshCw size={13} />Tải lại</button>
        </div>
      )}>
      <div className="card" style={{ padding: 10, marginBottom: 10, background: "#FCFBFB" }}>
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap", fontSize: 13 }}>
          <b>Tổng kế hoạch:</b>
          <span>MCT <b>{so(dl.tong_ke_hoach.sl_mct)}</b></span>
          <span>Công nợ <b>{so(dl.tong_ke_hoach.cong_no, 2)}</b> <span className="muted">{tenDonVi}</span></span>
          {dl.nhom.map((g) => (
            <span key={g.nhom} className="muted">
              {g.nhan}: {so(g.ke_hoach.sl_mct)} MCT / {so(g.ke_hoach.cong_no, 2)}
            </span>
          ))}
        </div>
      </div>

      {sua && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {dl.nhom.find((g) => g.nhom === sua.nhom)?.nhan} · {cot.find((c) => c.trang_thai === sua.trang_thai)?.nhan}
          </p>
          <div className="grid md:grid-cols-4 gap-3">
            <label style={{ fontSize: 12.5 }}>Số lượng MCT
              <input className="inp" type="number" value={sua.sl_mct}
                onChange={(e) => setSua({ ...sua, sl_mct: e.target.value })} />
            </label>
            <label style={{ fontSize: 12.5 }}>Công nợ ({tenDonVi})
              <input className="inp" type="number" step="0.01" value={sua.cong_no}
                onChange={(e) => setSua({ ...sua, cong_no: e.target.value })} />
            </label>
            <label style={{ fontSize: 12.5, gridColumn: "span 2" }}>Ghi chú — vướng mắc, đầu mục cụ thể
              <textarea className="inp" rows="2" value={sua.note || ""}
                onChange={(e) => setSua({ ...sua, note: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-red btn-sm" onClick={luu}>Lưu</button>
            <button className="btn btn-sm" onClick={() => setSua(null)}>Hủy</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Trạng thái hồ sơ</th>
              {dl.nhom.map((g) => <th key={g.nhom} colSpan={2} style={{ textAlign: "center" }}>{g.nhan}</th>)}
              <th colSpan={2} style={{ textAlign: "center" }}>Cộng</th>
              <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Ghi chú (vướng mắc, đầu mục cụ thể)</th>
            </tr>
            <tr>
              {dl.nhom.map((g) => (
                <React.Fragment key={g.nhom}>
                  <th>SL MCT</th><th title={`Đơn vị: ${tenDonVi}`}>Công nợ ({donVi === "ty" ? "tỷ" : "triệu"})</th>
                </React.Fragment>
              ))}
              <th>SL MCT</th><th>Công nợ ({donVi === "ty" ? "tỷ" : "triệu"})</th>
            </tr>
          </thead>
          <tbody>
            {cot.map((c) => {
              const o = dl.nhom.map((g) => g.trang_thai.find((x) => x.trang_thai === c.trang_thai) || {});
              const cong = o.reduce((a, x) => ({ sl: a.sl + (x.sl_mct || 0), cn: a.cn + (x.cong_no || 0) }), { sl: 0, cn: 0 });
              return (
                <tr key={c.trang_thai}>
                  <td><b>{c.nhan}</b></td>
                  {dl.nhom.map((g, i) => (
                    <React.Fragment key={g.nhom}>
                      <td style={{ cursor: duocSua ? "pointer" : undefined }}
                        title={duocSua ? "Bấm để sửa ô này" : undefined}
                        onClick={() => duocSua && setSua({ nhom: g.nhom, trang_thai: c.trang_thai,
                                                           sl_mct: o[i].sl_mct ?? "", cong_no: o[i].cong_no ?? "",
                                                           note: o[i].note || "" })}>
                        {so(o[i].sl_mct)}
                      </td>
                      <td style={{ cursor: duocSua ? "pointer" : undefined }}
                        onClick={() => duocSua && setSua({ nhom: g.nhom, trang_thai: c.trang_thai,
                                                           sl_mct: o[i].sl_mct ?? "", cong_no: o[i].cong_no ?? "",
                                                           note: o[i].note || "" })}>
                        {so(o[i].cong_no, 2)}
                      </td>
                    </React.Fragment>
                  ))}
                  <td style={{ fontWeight: 700 }}>{so(cong.sl)}</td>
                  <td style={{ fontWeight: 700 }}>{so(cong.cn, 2)}</td>
                  <td className="muted" style={{ fontSize: 12.5, maxWidth: 320, whiteSpace: "normal" }}>
                    {o.map((x, i) => (x.note ? (
                      <div key={i}><b>N{dl.nhom[i].nhom}:</b> {x.note}</div>
                    ) : null))}
                    {!o.some((x) => x.note) && "—"}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: "#FCFBFB" }}>
              <td><b>Kế hoạch (cộng các trạng thái)</b></td>
              {dl.nhom.map((g) => (
                <React.Fragment key={g.nhom}>
                  <td><b>{so(g.ke_hoach.sl_mct)}</b></td>
                  <td><b>{so(g.ke_hoach.cong_no, 2)}</b></td>
                </React.Fragment>
              ))}
              <td><b>{so(dl.tong_ke_hoach.sl_mct)}</b></td>
              <td><b>{so(dl.tong_ke_hoach.cong_no, 2)}</b></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {duocSua ? "Bấm vào một ô để sửa số MCT và công nợ của nhóm đó." : "Chỉ người có quyền sửa mới nhập được số."}
        {" "}Kế hoạch từng nhóm là tổng các trạng thái nên luôn khớp với các ô bên trên.
        {" "}Công nợ tính bằng <b>{tenDonVi}</b>.
      </p>
      {err && <p style={{ color: RED, fontSize: 12.5, marginTop: 8 }}>{err}</p>}
    </Card>
  );
}
