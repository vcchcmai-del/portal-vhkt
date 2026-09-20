import React, { useEffect, useState } from "react";
import { Check, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, coQuyen } from "./api";
import { Card, Field, RED } from "./ui";

/*
 * Bảng dự án của một đầu việc.
 *
 * Mỗi dòng là một đơn vị triển khai (PTO, SGN, Thủ Dầu Một...) gom trong khối
 * ACT / BDG / VTU. Với mỗi đơn vị: tổng số điểm triển khai và số điểm đã qua
 * từng bước — khảo sát, phân bổ hàng, lắp đặt, nghiệm thu, bản vẽ hoàn công,
 * ký BBBG, ký BB xác nhận hoàn thành. Tỉ lệ hoàn thành do máy tính chia ra nên
 * không bao giờ lệch với khối lượng.
 */

const so = (n) => (n ? Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "—");
const pct = (r) => (r == null ? "—"
  : `${(Math.round(r * 1000) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`);
const mauTyLe = (r) => (r == null ? undefined : r >= 1 ? "#16A34A" : r >= 0.8 ? "#8A6D00" : RED);

const DONG_TRONG = {
  don_vi: "", khoi: "", tong_trien_khai: "", khao_sat: "", phan_bo: "", lap_dat: "",
  nghiem_thu: "", ban_ve: "", ky_bbbg: "", ky_bb_xn: "", note: "",
};

export function BangDuAn({ category, label }) {
  const [dl, setDl] = useState(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");
  // Mặc định bảng sạch để đọc và in; bật chế độ cập nhật thì cột thao tác mới hiện.
  const [cheDoSua, setCheDoSua] = useState(false);
  const mo = (duocSua || duocXoa) && cheDoSua;

  const tai = () => api.get(`/api/admin/du-an/${category}?period=${encodeURIComponent(period)}`)
    .then((x) => { setDl(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { tai(); }, [category, period]);

  const luu = async () => {
    try {
      if (!form.don_vi.trim()) throw new Error("Chưa nhập tên đơn vị.");
      const body = { period, don_vi: form.don_vi.trim(), khoi: form.khoi || "", note: form.note || "" };
      for (const k of ["tong_trien_khai", ...dl.buoc.map((b) => b.ma)]) body[k] = Number(form[k]) || 0;
      await api.put(`/api/admin/du-an/${category}`, body);
      setForm(null); tai();
    } catch (e) { setErr(e.message); }
  };

  const xoa = async (d) => {
    if (!window.confirm(`Xóa dòng “${d.don_vi}” của kỳ ${period}?`)) return;
    try { await api.del(`/api/admin/du-an/${category}/${d.id}`); tai(); } catch (e) { setErr(e.message); }
  };

  if (!dl) return <Card title={`Dự án — ${label}`}><p className="muted">Đang tải…</p></Card>;

  const buoc = dl.buoc;
  // Các đơn vị cùng khối đứng liền nhau, ô khối chỉ ghi ở dòng đầu cho dễ đọc.
  const khoiTruoc = [];
  dl.dong.forEach((d, i) => { khoiTruoc[i] = i > 0 && dl.dong[i - 1].khoi === d.khoi; });

  return (
    <Card title={`Dự án — ${label}`}
      action={(
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 120 }} value={period} list="ky-da"
            onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" />
          <datalist id="ky-da">{(dl.ky_co_so_lieu || []).map((k) => <option key={k} value={k} />)}</datalist>
          <button className="btn btn-sm" onClick={tai}><RefreshCw size={13} />Tải lại</button>
          {mo && duocSua && (
            <button className="btn btn-sm" onClick={() => setForm({ ...DONG_TRONG })}>
              <Plus size={13} />Thêm đơn vị
            </button>
          )}
          {(duocSua || duocXoa) && (
            <button className={`btn btn-sm${mo ? " btn-red" : ""}`}
              title={mo ? "Ẩn các nút sửa, chỉ xem bảng" : "Hiện các nút sửa để nhập số"}
              onClick={() => { setCheDoSua(!cheDoSua); setForm(null); }}>
              {mo ? <><Check size={13} />Xong</> : <><Pencil size={13} />Cập nhật số liệu</>}
            </button>
          )}
        </div>
      )}>
      <div className="card" style={{ padding: 10, marginBottom: 10, background: "#FCFBFB" }}>
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap", fontSize: 13 }}>
          <b>Toàn dự án:</b>
          <span>Tổng triển khai <b>{so(dl.cong.tong_trien_khai)}</b></span>
          {buoc.map((b) => (
            <span key={b.ma} className="muted">
              {b.nhan}: <b style={{ color: mauTyLe(dl.cong.ty_le[b.ma]) }}>{pct(dl.cong.ty_le[b.ma])}</b>
            </span>
          ))}
        </div>
      </div>

      {form && (
        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Đơn vị">
              <input className="inp" autoFocus value={form.don_vi} placeholder="vd: PTO, Thủ Dầu Một"
                onChange={(e) => setForm({ ...form, don_vi: e.target.value })} />
            </Field>
            <Field label="Khối">
              <input className="inp" value={form.khoi} placeholder="ACT / BDG / VTU"
                onChange={(e) => setForm({ ...form, khoi: e.target.value })} />
            </Field>
            <Field label="Tổng triển khai">
              <input className="inp" type="number" value={form.tong_trien_khai}
                onChange={(e) => setForm({ ...form, tong_trien_khai: e.target.value })} />
            </Field>
            <div />
            {buoc.map((b) => (
              <Field key={b.ma} label={b.nhan}>
                <input className="inp" type="number" value={form[b.ma]}
                  onChange={(e) => setForm({ ...form, [b.ma]: e.target.value })} />
              </Field>
            ))}
            <Field label="Ghi chú — vướng mắc của điểm này">
              <textarea className="inp" rows="2" value={form.note || ""}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-red btn-sm" onClick={luu}>Lưu</button>
            <button className="btn btn-sm" onClick={() => setForm(null)}>Hủy</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ verticalAlign: "bottom" }}>Khối</th>
              <th style={{ verticalAlign: "bottom" }}>Đơn vị</th>
              <th style={{ verticalAlign: "bottom" }}>Tổng triển khai</th>
              {buoc.map((b) => (
                <th key={b.ma} title={`${b.nhan} — khối lượng và tỉ lệ hoàn thành`}>{b.nhan}</th>
              ))}
              <th style={{ verticalAlign: "bottom" }}>Ghi chú (vướng mắc)</th>
              {mo && <th style={{ textAlign: "right", verticalAlign: "bottom" }}>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {dl.dong.map((d, i) => (
              <tr key={d.id}>
                <td className="muted" style={{ fontSize: 12.5 }}>{khoiTruoc[i] ? "" : d.khoi}</td>
                <td><b>{d.don_vi}</b></td>
                <td><b>{so(d.tong_trien_khai)}</b></td>
                {buoc.map((b) => (
                  <td key={b.ma} style={{ whiteSpace: "nowrap" }}>
                    {so(d[b.ma])}{" "}
                    <span style={{ color: mauTyLe(d.ty_le[b.ma]), fontWeight: 600, fontSize: 12 }}>
                      {pct(d.ty_le[b.ma])}
                    </span>
                  </td>
                ))}
                <td className="muted" style={{ fontSize: 12.5, maxWidth: 260, whiteSpace: "normal" }}>{d.note || "—"}</td>
                {mo && (
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {duocSua && (
                      <button className="tt-btn" title="Sửa dòng này"
                        onClick={() => setForm({ ...d, note: d.note || "" })}>✎</button>
                    )}
                    {duocXoa && (
                      <button className="tt-btn tt-xoa" title="Xóa dòng này" onClick={() => xoa(d)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!dl.dong.length && (
              <tr><td colSpan={4 + buoc.length + (mo ? 1 : 0)} className="muted" style={{ fontSize: 12.5 }}>
                Kỳ {period} chưa có đơn vị nào — bấm “Thêm đơn vị” để nhập.
              </td></tr>
            )}
            {!!dl.dong.length && (
              <tr style={{ background: "#FCFBFB" }}>
                <td /><td><b>Cộng</b></td>
                <td><b>{so(dl.cong.tong_trien_khai)}</b></td>
                {buoc.map((b) => (
                  <td key={b.ma} style={{ whiteSpace: "nowrap" }}>
                    <b>{so(dl.cong[b.ma])}</b>{" "}
                    <span style={{ color: mauTyLe(dl.cong.ty_le[b.ma]), fontWeight: 700, fontSize: 12 }}>
                      {pct(dl.cong.ty_le[b.ma])}
                    </span>
                  </td>
                ))}
                <td />{mo && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Tỉ lệ hoàn thành của mỗi bước = khối lượng bước đó chia tổng triển khai, máy tự tính.
      </p>
      {err && <p style={{ color: RED, fontSize: 12.5, marginTop: 8 }}>{err}</p>}
    </Card>
  );
}
