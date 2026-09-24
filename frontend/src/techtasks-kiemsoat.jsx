import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { api } from "./api";
import { Card, Empty, RED } from "./ui";

/*
 * Tab "Kiểm soát số liệu": nhìn vào chính những con số mà các màn hình báo cáo
 * đang dùng, để phân biệt "đơn vị làm chưa xong" với "chưa ai nhập số".
 *
 * Toàn bộ nội dung lấy từ /api/admin/kiem-soat-so-lieu, tính lại từ dữ liệu
 * đang có — không có bảng tổng hợp riêng nên không bao giờ lệch với màn hình
 * khác.
 */

const MAU = { do: "#C8102E", vang: "#C97A07", xanh: "#0A7A50", lam: "#0E6CD6", xam: "#6B7A90" };
const NEN = { do: "#FFF3F5", vang: "#FFF8EC", xanh: "#F1FAF5" };
const TEN_MUC = { do: "Cần xử lý ngay", vang: "Cần chú ý", xanh: "Bình thường" };
const so = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const pct = (r) => (r == null ? "—" : `${Math.round(r * 1000) / 10}%`);

function OSo({ nhan, giaTri, mau, goiY }) {
  return (
    <div className="card" style={{ padding: 12 }} title={goiY || ""}>
      <div className="muted" style={{ fontSize: 12 }}>{nhan}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: mau || MAU.lam, lineHeight: 1.25 }}>{giaTri}</div>
    </div>
  );
}

function Cham({ muc }) {
  return (
    <span title={TEN_MUC[muc] || muc} style={{
      display: "inline-block", width: 10, height: 10, borderRadius: 99,
      background: MAU[muc] || MAU.xam,
    }} />
  );
}

export function KiemSoatSoLieuTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api.get("/api/admin/kiem-soat-so-lieu")
    .then((x) => { setData(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  if (err) return <p className="card" style={{ color: RED, fontWeight: 600 }}>{err}</p>;
  if (!data) return <p className="muted">Đang tải…</p>;

  const q = data.tong_quan;
  const viec = data.viec_can_lam || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <b>Kiểm soát số liệu — {data.hom_nay}</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Mọi màn hình báo cáo đều vẽ ra biểu đồ kể cả khi chưa ai nhập số, nên nhìn vào không phân biệt được
            “đơn vị làm chưa xong” với “chưa có dữ liệu”. Bảng này soi đúng chỗ đó: nguồn nào đang cũ,
            mảng nào mới có kế hoạch mà chưa có thực hiện, khối lượng nào còn treo ở mức chi nhánh.
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <OSo nhan="Nguồn cần xử lý ngay" giaTri={`${q.nguon_do}/${q.so_nguon}`}
          mau={q.nguon_do ? MAU.do : MAU.xanh} goiY="Nguồn rỗng hoặc trễ từ 2 kỳ / 30 ngày trở lên" />
        <OSo nhan="Nguồn cần chú ý" giaTri={so(q.nguon_vang)} mau={q.nguon_vang ? MAU.vang : MAU.xanh} />
        <OSo nhan="Đã nhập thực hiện" giaTri={pct(q.ty_le_thuc_hien)}
          mau={(q.ty_le_thuc_hien || 0) < 0.1 ? MAU.do : MAU.lam}
          goiY={`Thực hiện ${so(q.tong_thuc_hien)} / kế hoạch ${so(q.tong_ke_hoach)}`} />
        <OSo nhan="Chưa chia về cụm" giaTri={pct(q.ty_le_chua_chia_cum)}
          mau={(q.ty_le_chua_chia_cum || 0) > 0.1 ? MAU.vang : MAU.xanh}
          goiY="Khối lượng còn nằm ở dòng CN — không xếp hạng được trung tâm" />
        <OSo nhan="Đầu việc thiếu chủ trì" giaTri={`${q.thieu_chu_tri}/${q.so_dau_viec}`}
          mau={q.thieu_chu_tri ? MAU.vang : MAU.xanh} />
      </div>

      {/* Việc cần làm để số liệu dùng được — đặt trên cùng vì đây là thứ phải hành động */}
      <Card pad={false} icon={AlertTriangle} title={`Việc cần làm để số liệu dùng được (${viec.length})`}>
        {!viec.length ? (
          <div style={{ padding: 16 }}>
            <Empty title="Số liệu đang ổn" hint="Không phát hiện nguồn rỗng, cũ hay thiếu người chủ trì." />
          </div>
        ) : (
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {viec.map((v, i) => (
              <div key={i} style={{
                background: NEN[v.muc] || "#F7F9FC", borderRadius: 8, padding: "10px 12px",
                borderLeft: `3px solid ${MAU[v.muc] || MAU.xam}`,
              }}>
                <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                  <Cham muc={v.muc} />
                  <b style={{ color: MAU[v.muc] }}>{v.tieu_de}</b>
                  <span className="muted" style={{ fontSize: 12 }}>({v.so_luong})</span>
                </div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>{v.chi_tiet}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>→ {v.lam_gi}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card pad={false} icon={Database} title="Các nguồn số liệu của cổng thông tin">
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th></th><th>Nguồn</th><th>Số dòng</th><th>Mốc mới nhất</th>
                <th>Xem ở màn hình</th>
              </tr>
            </thead>
            <tbody>
              {data.nguon.map((n) => (
                <tr key={n.ten} style={n.muc === "do" ? { background: NEN.do } : undefined}>
                  <td><Cham muc={n.muc} /></td>
                  <td>
                    <b>{n.ten}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{n.mo_ta}</div>
                  </td>
                  <td className="mono">{so(n.so_dong)}</td>
                  <td style={{ fontSize: 12.5, color: n.muc === "do" ? MAU.do : undefined }}>
                    {!n.so_dong ? "Chưa có dữ liệu"
                      : n.ky ? `Kỳ ${n.ky}${n.tre_thang ? ` — trễ ${n.tre_thang} tháng` : " — đúng kỳ"}`
                        : n.im_lang_ngay === 0 ? "Cập nhật hôm nay"
                          : `${n.im_lang_ngay} ngày không cập nhật`}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>{n.man_hinh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card pad={false} title="Tiến độ theo nhóm đầu việc — chỗ nào số liệu còn hổng">
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nhóm</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tỷ lệ</th><th>Tồn</th>
                <th title="Phần khối lượng còn nằm ở dòng CN, chưa chia về trung tâm nào">Chưa chia cụm</th>
                <th title="Đầu việc đang bật nhưng chưa có dòng số liệu nào">Thiếu số liệu</th>
                <th>Thiếu chủ trì</th>
              </tr>
            </thead>
            <tbody>
              {data.theo_nhom.map((x) => (
                <tr key={x.nhom || x.ten}>
                  <td><b>{x.ten}</b> <span className="muted">({x.so_dau_viec} đầu việc)</span></td>
                  <td className="mono">{so(x.kh)}</td>
                  <td className="mono" style={{ color: x.kh > 0 && !x.th ? MAU.do : undefined }}>{so(x.th)}</td>
                  <td className="mono">{pct(x.ty_le)}</td>
                  <td className="mono">{so(x.ton)}</td>
                  <td className="mono" style={{ color: (x.ty_le_chua_chia_cum || 0) >= 0.5 ? MAU.do : undefined }}>
                    {pct(x.ty_le_chua_chia_cum)}
                  </td>
                  <td className="mono" style={{ color: x.thieu_so_lieu ? MAU.vang : MAU.xanh }}>
                    {x.thieu_so_lieu ? `${x.thieu_so_lieu}/${x.so_dau_viec}` : <CheckCircle2 size={14} />}
                  </td>
                  <td className="mono" style={{ color: x.thieu_chu_tri ? MAU.vang : MAU.xanh }}>
                    {x.thieu_chu_tri ? `${x.thieu_chu_tri}/${x.so_dau_viec}` : <CheckCircle2 size={14} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
