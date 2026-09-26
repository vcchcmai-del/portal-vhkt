import React, { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Download, MapPin, RefreshCw, Upload } from "lucide-react";
import { api, coQuyen } from "./api";
import { Card, Empty, Field, RED } from "./ui";

/*
 * Trạm thực hiện: từng mã trạm các cụm đã khai trong bản đăng ký ngày.
 *
 * Trả lời đúng câu "có làm đúng trạm không". Muốn trả lời được thì phải có
 * danh mục trạm (mã trạm thuộc cụm nào) — nên màn hình này kèm luôn chỗ nhập
 * danh mục. Danh mục trống thì bảng vẫn thống kê bình thường và nói rõ là
 * chưa đối chiếu được, chứ không im lặng tỏ ra mọi thứ đều đúng.
 */

const MAU = { do: "#C8102E", vang: "#C97A07", xanh: "#0A7A50", lam: "#0E6CD6", xam: "#6B7A90" };
const ngayISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const homNay = () => ngayISO(new Date());
const luiNgay = (n) => ngayISO(new Date(Date.now() - n * 86400000));
const so = (n) => Number(n || 0).toLocaleString("vi-VN");

function OSo({ nhan, giaTri, mau, goiY }) {
  return (
    <div className="card" style={{ padding: 12 }} title={goiY || ""}>
      <div className="muted" style={{ fontSize: 12 }}>{nhan}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: mau || MAU.lam, lineHeight: 1.25 }}>{giaTri}</div>
    </div>
  );
}

function Co({ chu, mau, title }) {
  return (
    <span title={title} style={{
      display: "inline-block", padding: "1px 7px", borderRadius: 99, fontSize: 11,
      fontWeight: 700, color: "#fff", background: mau, whiteSpace: "nowrap", marginRight: 4,
    }}>{chu}</span>
  );
}

export function TramThucHienTab() {
  const [tu, setTu] = useState(() => luiNgay(6));
  const [den, setDen] = useState(homNay);
  const [center, setCenter] = useState("");
  const [q, setQ] = useState("");
  const [chiBatThuong, setChiBatThuong] = useState(false);
  const [cums, setCums] = useState([]);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [moDanhMuc, setMoDanhMuc] = useState(false);
  const [dm, setDm] = useState(null);
  const [noiDung, setNoiDung] = useState("");
  const [kqNhap, setKqNhap] = useState(null);

  const duocSua = coQuyen("daily_plan", "update");

  const load = () => {
    const p = new URLSearchParams({ tu, den });
    if (center) p.set("center", center);
    if (q.trim()) p.set("q", q.trim());
    if (chiBatThuong) p.set("chi_bat_thuong", "true");
    api.get(`/api/admin/ke-hoach-ngay/theo-tram?${p}`)
      .then((x) => { setData(x); setErr(""); }).catch((e) => setErr(e.message));
  };
  const loadDm = () => api.get("/api/admin/ke-hoach-ngay/danh-muc-tram").then(setDm).catch(() => {});
  useEffect(() => { load(); }, [tu, den, center, q, chiBatThuong]);
  useEffect(() => {
    api.get("/api/admin/ke-hoach-ngay/nhan-su").then(setCums).catch(() => {});
    loadDm();
  }, []);

  const nhapDanhMuc = () => {
    setKqNhap(null);
    api.post("/api/admin/ke-hoach-ngay/danh-muc-tram/nhap", { noi_dung: noiDung, ghi_de: true })
      .then((kq) => { setKqNhap(kq); setNoiDung(""); loadDm(); load(); })
      .catch((e) => setErr(e.message));
  };

  const xuatCsv = () => {
    if (!data) return;
    const d = [["Mã trạm", "Tên trạm", "Cụm quản lý", "Cụm thực hiện", "Lượt", "Lượt xong",
                "Số ngày", "Từ ngày", "Đến ngày", "Mảng", "Hạng mục", "Cảnh báo"]];
    for (const x of data.danh_sach) {
      d.push([x.ma_tram, x.ten, x.cum_quan_ly, x.cum_thuc_hien.join(" + "), x.luot, x.luot_xong,
              x.so_ngay, x.ngay_dau, x.ngay_cuoi, x.ten_mang.join("; "), x.hang_muc.join("; "),
              [x.sai_cum && "Sai cụm", x.ngoai_danh_muc && "Ngoài danh mục",
               x.nhieu_cum && "Nhiều cụm", x.lap_lai && "Lặp chưa xong"].filter(Boolean).join("; ")]);
    }
    const csv = "﻿" + d.map((h) => h.map((o) => `"${String(o ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `tram-thuc-hien-${data.tu}_${data.den}.csv`;
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
          <b>Trạm thực hiện theo trung tâm</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Từng mã trạm các cụm đã khai trong bản đăng ký ngày — ai làm, mấy lượt, ngày nào, xong chưa.
            Đối chiếu với danh mục trạm để biết có làm đúng trạm của cụm mình không.
          </p>
        </div>
        <label className="flex items-center gap-1" style={{ fontSize: 13 }}>Từ
          <input className="inp" type="date" value={tu} onChange={(e) => setTu(e.target.value)} style={{ width: 150 }} />
        </label>
        <label className="flex items-center gap-1" style={{ fontSize: 13 }}>đến
          <input className="inp" type="date" value={den} onChange={(e) => setDen(e.target.value)} style={{ width: 150 }} />
        </label>
        <select className="inp" style={{ width: 155 }} value={center} onChange={(e) => setCenter(e.target.value)}>
          <option value="">Mọi cụm</option>
          {cums.map((c) => <option key={c.center} value={c.center}>{c.center} — {c.ten}</option>)}
        </select>
        <input className="inp" style={{ width: 150 }} placeholder="🔎 Tìm mã trạm…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`btn btn-sm ${chiBatThuong ? "btn-red" : ""}`}
          onClick={() => setChiBatThuong((v) => !v)}>
          <AlertTriangle size={14} />Chỉ trạm bất thường
        </button>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
        <button className="btn btn-sm" onClick={xuatCsv}><Download size={14} />Xuất CSV</button>
      </div>

      {!data.co_danh_muc && (
        <p className="card" style={{ color: MAU.vang, fontWeight: 600, fontSize: 13 }}>
          <AlertTriangle size={14} /> Chưa có danh mục trạm nên chưa đối chiếu được “đúng trạm của cụm nào”.
          Bảng dưới vẫn thống kê đủ số lượt và phát hiện trạm bị nhiều cụm cùng khai. Mở mục
          “Danh mục trạm” bên dưới để nhập.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <OSo nhan="Số trạm đã làm" giaTri={so(t.so_tram)} mau={MAU.lam} />
        <OSo nhan="Tổng lượt" giaTri={so(t.luot)} mau={MAU.lam}
          goiY="Một trạm làm nhiều ngày thì tính nhiều lượt" />
        <OSo nhan="Lượt đã xong" giaTri={so(t.xong)} mau={t.xong ? MAU.xanh : MAU.xam} />
        <OSo nhan="Sai cụm" giaTri={so(t.sai_cum)} mau={t.sai_cum ? MAU.do : MAU.xanh}
          goiY="Trạm thuộc cụm khác theo danh mục" />
        <OSo nhan="Ngoài danh mục" giaTri={data.co_danh_muc ? so(t.ngoai_danh_muc) : "—"}
          mau={t.ngoai_danh_muc ? MAU.vang : MAU.xanh} goiY="Mã trạm không có trong danh mục" />
        <OSo nhan="Lặp chưa xong" giaTri={so(t.lap_lai)} mau={t.lap_lai ? MAU.vang : MAU.xanh}
          goiY="Khai từ 3 lượt trở lên mà chưa lần nào xong" />
      </div>

      {!t.so_tram ? (
        <Card><Empty title="Chưa có trạm nào được khai trong khoảng này"
          hint="Các cụm ghi mã trạm ở ô “Trạm thực hiện” khi đăng ký kế hoạch ngày." /></Card>
      ) : (
        <>
          <Card pad={false} icon={MapPin} title="Theo trung tâm">
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr><th>Cụm</th><th>Số trạm</th><th>Lượt</th><th>Lượt xong</th>
                    <th>Sai cụm</th><th>Ngoài danh mục</th><th>Lặp chưa xong</th></tr>
                </thead>
                <tbody>
                  {data.theo_cum.map((x) => (
                    <tr key={x.center}>
                      <td><b>{x.center}</b> <span className="muted">{x.ten}</span></td>
                      <td className="mono">{so(x.so_tram)}</td>
                      <td className="mono">{so(x.luot)}</td>
                      <td className="mono" style={{ color: x.xong ? MAU.xanh : undefined }}>{so(x.xong)}</td>
                      <td className="mono" style={{ color: x.sai_cum ? MAU.do : undefined }}>{x.sai_cum || "—"}</td>
                      <td className="mono" style={{ color: x.ngoai_danh_muc ? MAU.vang : undefined }}>
                        {data.co_danh_muc ? (x.ngoai_danh_muc || "—") : "—"}
                      </td>
                      <td className="mono" style={{ color: x.lap_lai ? MAU.vang : undefined }}>{x.lap_lai || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card pad={false} title={`Chi tiết từng trạm (${data.danh_sach.length})`}>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr><th>Mã trạm</th><th>Cụm thực hiện</th><th>Cụm quản lý</th>
                    <th>Lượt</th><th title="Quy ước: tính cho các trạm đứng đầu ô “Trạm thực hiện”, vì ô “số trạm xong” chỉ là một con số">
                      Lượt xong</th>
                    <th>Ngày</th><th>Mảng</th><th>Hạng mục</th><th>Cảnh báo</th></tr>
                </thead>
                <tbody>
                  {data.danh_sach.map((x) => {
                    const canh = x.sai_cum || x.nhieu_cum || x.lap_lai;
                    return (
                      <tr key={x.ma_tram} style={x.sai_cum ? { background: "#FFF3F5" } : undefined}>
                        <td>
                          <b>{x.ma_tram}</b>
                          {x.ten && <div className="muted" style={{ fontSize: 12 }}>{x.ten}</div>}
                        </td>
                        <td>
                          {x.cum_thuc_hien.map((c) => (
                            <span key={c} style={{ color: x.cum_sai?.includes(c) ? MAU.do : undefined,
                                                   fontWeight: x.cum_sai?.includes(c) ? 700 : undefined }}>
                              {c}{" "}
                            </span>
                          ))}
                        </td>
                        <td className={x.cum_quan_ly ? "" : "muted"}>{x.cum_quan_ly || "—"}</td>
                        <td className="mono">{x.luot}</td>
                        <td className="mono" style={{ color: x.luot_xong ? MAU.xanh : MAU.xam }}>{x.luot_xong}</td>
                        <td style={{ fontSize: 12 }}>
                          {x.so_ngay === 1 ? x.ngay_dau : `${x.ngay_dau} → ${x.ngay_cuoi} (${x.so_ngay} ngày)`}
                        </td>
                        <td style={{ fontSize: 12 }}>{x.ten_mang.join(", ")}</td>
                        <td style={{ fontSize: 12 }}>{x.hang_muc.join(", ") || "—"}</td>
                        <td>
                          {x.sai_cum && <Co chu={`Sai cụm: ${x.cum_sai.join(", ")}`} mau={MAU.do}
                            title={`Danh mục ghi trạm này thuộc cụm ${x.cum_quan_ly}`} />}
                          {x.nhieu_cum && <Co chu="Nhiều cụm" mau={MAU.vang}
                            title="Từ hai cụm trở lên cùng khai trạm này" />}
                          {x.lap_lai && <Co chu="Lặp chưa xong" mau={MAU.vang}
                            title="Khai từ 3 lượt trở lên mà chưa lần nào xong" />}
                          {x.ngoai_danh_muc && <Co chu="Ngoài danh mục" mau={MAU.xam}
                            title="Mã trạm không có trong danh mục" />}
                          {!canh && !x.ngoai_danh_muc && <span className="muted" style={{ fontSize: 12 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: 12, padding: "8px 12px" }}>
              “Lượt xong” là quy ước: ô cập nhật cuối ngày chỉ ghi <i>số</i> trạm đã xong chứ không ghi
              trạm nào, nên hệ thống tính cho các trạm đứng đầu ô “Trạm thực hiện”. Cần biết chính xác
              từng trạm thì tách mỗi trạm một dòng mảng khi đăng ký.
            </p>
          </Card>
        </>
      )}

      {/* Danh mục trạm — nguồn để đối chiếu đúng/sai cụm */}
      <Card pad={false} icon={MapPin}
        title={`Danh mục trạm${dm ? ` (${so(dm.tong)} trạm)` : ""}`}
        action={<button className="btn btn-sm" onClick={() => setMoDanhMuc((v) => !v)}>
          {moDanhMuc ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{moDanhMuc ? "Thu gọn" : "Mở"}
        </button>}>
        {moDanhMuc && (
          <div style={{ padding: 12 }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Mã trạm thuộc cụm nào. Có danh mục thì hệ thống mới nói được cụm có làm đúng trạm của mình
              hay không. Dán thẳng từ Excel, mỗi dòng một trạm:
              <b> mã trạm, mã cụm, tên trạm, loại</b> — chỉ cột đầu bắt buộc.
            </p>
            {!!dm?.theo_cum?.length && (
              <p style={{ fontSize: 12.5, marginBottom: 8 }}>
                {dm.theo_cum.map((c) => `${c.center}: ${c.so_tram}`).join(" · ")}
              </p>
            )}
            {duocSua && (
              <>
                <Field label="Dán danh mục trạm">
                  <textarea className="inp" rows={5} value={noiDung} spellCheck={false}
                    placeholder={"HCM0123, THA, Trạm Thới Hòa 1, BTS\nHCM0456, CHP, Trạm Chánh Hiệp 2, BTS"}
                    onChange={(e) => setNoiDung(e.target.value)} />
                </Field>
                <button className="btn btn-sm btn-red" style={{ marginTop: 8 }}
                  disabled={!noiDung.trim()} onClick={nhapDanhMuc}>
                  <Upload size={14} />Nhập danh mục
                </button>
              </>
            )}
            {kqNhap && (
              <div style={{ marginTop: 10, fontSize: 12.5 }}>
                <b style={{ color: MAU.xanh }}>
                  Đã thêm {kqNhap.them}, cập nhật {kqNhap.sua}. Danh mục hiện có {kqNhap.tong} trạm.
                </b>
                {!!kqNhap.loi?.length && (
                  <ul style={{ color: MAU.do, marginTop: 6, paddingLeft: 18 }}>
                    {kqNhap.loi.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
