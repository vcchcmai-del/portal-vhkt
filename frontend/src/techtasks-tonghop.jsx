import React, { useEffect, useState } from "react";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { api } from "./api";
import { Card, Empty, RED } from "./ui";
import { TramThucHienTab } from "./techtasks-tram";

/*
 * Tổng hợp khối lượng các cụm đăng ký trong ngày.
 *
 * Bốn cách nhìn cùng một số liệu, tất cả lấy từ /ke-hoach-ngay/tong-hop —
 * không tự cộng lại ở phía web, để bảng này không bao giờ lệch với tab Kế
 * hoạch ngày và bảng Đánh giá trung tâm.
 */

const MAU = { do: "#C8102E", vang: "#C97A07", xanh: "#0A7A50", lam: "#0E6CD6", xam: "#6B7A90" };
const homNay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const luiNgay = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const so = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const pct = (r) => (r == null ? "—" : `${Math.round(r * 1000) / 10}%`);
const mauTyLe = (r) => (r == null ? undefined : r >= 1 ? MAU.xanh : r >= 0.5 ? MAU.lam : MAU.vang);

function OSo({ nhan, giaTri, mau, goiY }) {
  return (
    <div className="card" style={{ padding: 12 }} title={goiY || ""}>
      <div className="muted" style={{ fontSize: 12 }}>{nhan}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: mau || MAU.lam, lineHeight: 1.25 }}>{giaTri}</div>
    </div>
  );
}

/** Thanh ngang so trạm đã xong trên trạm đăng ký. */
function Thanh({ xong, tram }) {
  const r = tram > 0 ? Math.min(xong / tram, 1) : 0;
  return (
    <span style={{ display: "inline-block", width: 78, height: 7, background: "#EAF1FB",
                   borderRadius: 99, overflow: "hidden", verticalAlign: "middle" }}>
      <span style={{ display: "block", width: `${r * 100}%`, height: "100%",
                     background: mauTyLe(tram ? xong / tram : null) || "#C9D6E8" }} />
    </span>
  );
}

/** Hai cách nhìn cùng một nguồn: khối lượng cộng lại, và từng trạm cụ thể. */
export function TongHopKhoiLuongTab() {
  const [oCon, setOCon] = useState("khoi_luong");
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex gap-2" style={{ padding: 8, flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${oCon === "khoi_luong" ? "btn-red" : ""}`}
          onClick={() => setOCon("khoi_luong")}>Khối lượng</button>
        <button className={`btn btn-sm ${oCon === "tram" ? "btn-red" : ""}`}
          onClick={() => setOCon("tram")}>Trạm thực hiện</button>
      </div>
      {oCon === "khoi_luong" ? <BangKhoiLuong /> : <TramThucHienTab />}
    </div>
  );
}

function BangKhoiLuong() {
  const [tu, setTu] = useState(() => luiNgay(6));
  const [den, setDen] = useState(homNay);
  const [center, setCenter] = useState("");
  const [mang, setMang] = useState("");
  const [meta, setMeta] = useState(null);
  const [cums, setCums] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    const p = new URLSearchParams({ tu, den });
    if (center) p.set("center", center);
    if (mang) p.set("mang", mang);
    api.get(`/api/admin/ke-hoach-ngay/tong-hop?${p}`)
      .then((x) => { setData(x); setErr(""); }).catch((e) => setErr(e.message));
  };
  useEffect(() => { load(); }, [tu, den, center, mang]);
  useEffect(() => {
    api.get("/api/admin/ke-hoach-ngay/meta").then(setMeta).catch(() => {});
    api.get("/api/admin/ke-hoach-ngay/nhan-su").then(setCums).catch(() => {});
  }, []);

  /** Xuất đúng những gì đang nhìn thấy, kèm bộ lọc, để gửi kèm báo cáo. */
  const xuatCsv = () => {
    if (!data) return;
    const d = [];
    d.push([`Tổng hợp khối lượng kế hoạch ngày ${data.tu} đến ${data.den}`]);
    if (center || mang) d.push([`Lọc: ${center || "mọi cụm"} / ${mang ? (meta?.mang || []).find((m) => m.ma === mang)?.ten : "mọi mảng"}`]);
    d.push([]);
    d.push(["Theo cụm", "Ngày có đăng ký", "Nhân sự (lượt)", "Trạm đăng ký", "Trạm xong", "Tỷ lệ", "FT cụm", "Trạm/FT/ngày"]);
    for (const x of data.theo_cum) {
      d.push([`${x.center} ${x.ten}`, x.so_ngay_dang_ky, x.ns, x.tram, x.xong,
              pct(x.ty_le), x.ft || "", x.nang_suat ?? ""]);
    }
    d.push([]);
    d.push(["Theo hạng mục", "Đầu việc", "Số cụm", "Trạm đăng ký", "Trạm xong", "Đã đẩy lên tháng", "Kế hoạch tháng"]);
    for (const x of data.theo_hang_muc) {
      d.push([x.ten, x.ten_dau_viec, x.so_cum, x.tram, x.xong, x.da_day_len_thang, x.ke_hoach_thang]);
    }
    const csv = "﻿" + d.map((h) => h.map((o) => `"${String(o ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `tong-hop-khoi-luong-${data.tu}_${data.den}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  if (err) return <p className="card" style={{ color: RED, fontWeight: 600 }}>{err}</p>;
  if (!data) return <p className="muted">Đang tải…</p>;

  const t = data.tong;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 250 }}>
          <b>Tổng hợp khối lượng kế hoạch ngày</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Cộng khối lượng các cụm đã đăng ký trong khoảng ngày. “Nhân sự” là số lượt người theo từng mảng
            (một người làm hai mảng trong ngày tính hai lượt), “Trạm xong” lấy theo cập nhật cuối ngày.
          </p>
        </div>
        <label className="flex items-center gap-1" style={{ fontSize: 13 }}>Từ
          <input className="inp" type="date" value={tu} onChange={(e) => setTu(e.target.value)} style={{ width: 150 }} />
        </label>
        <label className="flex items-center gap-1" style={{ fontSize: 13 }}>đến
          <input className="inp" type="date" value={den} onChange={(e) => setDen(e.target.value)} style={{ width: 150 }} />
        </label>
        <select className="inp" style={{ width: 160 }} value={center} onChange={(e) => setCenter(e.target.value)}>
          <option value="">Mọi cụm</option>
          {cums.map((c) => <option key={c.center} value={c.center}>{c.center} — {c.ten}</option>)}
        </select>
        <select className="inp" style={{ width: 170 }} value={mang} onChange={(e) => setMang(e.target.value)}>
          <option value="">Mọi mảng</option>
          {(meta?.mang || []).map((m) => <option key={m.ma} value={m.ma}>{m.ten}</option>)}
        </select>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
        <button className="btn btn-sm" onClick={xuatCsv}><Download size={14} />Xuất CSV</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <OSo nhan="Bản đăng ký" giaTri={so(t.so_ban)} mau={MAU.lam}
          goiY={`${t.so_cum} cụm, ${t.so_ngay_co_dang_ky}/${data.so_ngay} ngày có đăng ký`} />
        <OSo nhan="Nhân sự huy động" giaTri={so(t.ns)} mau={MAU.lam} goiY="Tổng lượt người theo từng mảng" />
        <OSo nhan="Trạm đăng ký" giaTri={so(t.tram)} mau={MAU.lam} />
        <OSo nhan="Trạm đã xong" giaTri={so(t.xong)} mau={t.xong ? MAU.xanh : MAU.xam} />
        <OSo nhan="Tỷ lệ hoàn thành" giaTri={pct(t.ty_le)} mau={mauTyLe(t.ty_le)} />
        <OSo nhan="FT trực / nghỉ" giaTri={`${so(t.ft_truc)} / ${so(t.ft_nghi)}`} mau={MAU.lam}
          goiY={data.loc.mang ? "Đang lọc theo mảng nên không cộng quân số trực/nghỉ (ghi ở mức cụm)" : ""} />
      </div>

      {!t.so_ban && (
        <Card><Empty title="Chưa có bản đăng ký nào trong khoảng này"
          hint="Chọn khoảng ngày khác, hoặc để các cụm đăng ký ở tab Kế hoạch ngày." /></Card>
      )}

      {!!t.so_ban && (
        <>
          <Card pad={false} icon={BarChart3} title="Theo mảng công việc">
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr><th>Mảng</th><th>Lượt đăng ký</th><th>Nhân sự</th><th>Trạm</th>
                    <th>Trạm xong</th><th>Tỷ lệ</th></tr>
                </thead>
                <tbody>
                  {data.theo_mang.map((x) => (
                    <tr key={x.mang}>
                      <td><b>{x.ten_mang}</b></td>
                      <td className="mono">{so(x.so_dong)}</td>
                      <td className="mono">{so(x.ns)}</td>
                      <td className="mono">{so(x.tram)}</td>
                      <td className="mono">{so(x.xong)}</td>
                      <td className="mono" style={{ color: mauTyLe(x.ty_le) }}>
                        <Thanh xong={x.xong} tram={x.tram} /> {pct(x.ty_le)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card pad={false} title="Theo cụm — kèm năng suất trên đầu FT">
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr><th>Cụm</th><th>Ngày có đăng ký</th><th>Nhân sự</th><th>Trạm</th>
                    <th>Trạm xong</th><th>Tỷ lệ</th><th>FT cụm</th>
                    <th title="Trạm làm xong trên mỗi FT, mỗi ngày có đăng ký — so được giữa cụm đông và cụm ít người">
                      Trạm/FT/ngày</th></tr>
                </thead>
                <tbody>
                  {data.theo_cum.map((x) => (
                    <tr key={x.center}>
                      <td><b>{x.center}</b> <span className="muted">{x.ten}</span></td>
                      <td className="mono">{x.so_ngay_dang_ky}/{data.so_ngay}</td>
                      <td className="mono">{so(x.ns)}</td>
                      <td className="mono">{so(x.tram)}</td>
                      <td className="mono">{so(x.xong)}</td>
                      <td className="mono" style={{ color: mauTyLe(x.ty_le) }}>
                        <Thanh xong={x.xong} tram={x.tram} /> {pct(x.ty_le)}
                      </td>
                      <td className="mono">{x.ft || "—"}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{x.nang_suat ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card pad={false} title="Theo hạng mục — đối chiếu ngược lên kế hoạch tháng">
            {!data.theo_hang_muc.length ? (
              <div style={{ padding: 16 }}>
                <Empty title="Chưa bản đăng ký nào gắn hạng mục"
                  hint="Chọn Hạng mục ở từng dòng mảng khi đăng ký thì số trạm làm xong mới đẩy được lên số Thực hiện của tháng." />
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Hạng mục</th><th>Đầu việc</th><th>Số cụm</th><th>Trạm đăng ký</th>
                      <th>Trạm xong</th>
                      <th title="Phần đã cộng vào số Thực hiện của tháng — phải bằng Trạm xong nếu cùng một tháng">
                        Đã đẩy lên tháng</th>
                      <th>Kế hoạch tháng</th></tr>
                  </thead>
                  <tbody>
                    {data.theo_hang_muc.map((x) => {
                      // Lệch giữa "trạm xong" và "đã đẩy lên" là dấu hiệu khoảng
                      // ngày đang vắt qua hai tháng, hoặc số tháng bị sửa tay.
                      const lech = Math.abs((x.xong || 0) - (x.da_day_len_thang || 0)) > 0.01;
                      return (
                        <tr key={x.hang_muc}>
                          <td><b>{x.ten}</b></td>
                          <td className="muted" style={{ fontSize: 12.5 }}>{x.ten_dau_viec || "—"}</td>
                          <td className="mono">{x.so_cum}</td>
                          <td className="mono">{so(x.tram)}</td>
                          <td className="mono">{so(x.xong)}</td>
                          <td className="mono" style={{ color: lech ? MAU.vang : MAU.xanh }}
                            title={lech ? "Lệch với số trạm xong — kiểm tra khoảng ngày có vắt qua hai tháng, hoặc số tháng đã bị sửa tay" : ""}>
                            {so(x.da_day_len_thang)}{lech ? " ⚠" : ""}
                          </td>
                          <td className="mono">{x.ke_hoach_thang ? so(x.ke_hoach_thang) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card pad={false} title="Theo ngày">
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr><th>Ngày</th><th>Cụm đăng ký</th><th>Nhân sự</th><th>Trạm</th>
                    <th>Trạm xong</th><th>Tỷ lệ</th></tr>
                </thead>
                <tbody>
                  {data.theo_ngay.map((x) => (
                    <tr key={x.ngay}>
                      <td>{x.ngay}</td>
                      <td className="mono">{x.so_cum}</td>
                      <td className="mono">{so(x.ns)}</td>
                      <td className="mono">{so(x.tram)}</td>
                      <td className="mono">{so(x.xong)}</td>
                      <td className="mono" style={{ color: mauTyLe(x.ty_le) }}>{pct(x.ty_le)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
