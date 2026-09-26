import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CalendarDays, Check, ChevronDown, ChevronRight, ClipboardCheck,
  Flame, Plus, RefreshCw, Save, Trash2, Users, X,
} from "lucide-react";
import { api, coQuyen, cumCuaToi } from "./api";
import { Card, Empty, Field, RED, useCuonToi } from "./ui";
import { THU_TU_UU_TIEN, TheUuTienDV, UU_TIEN_DV, UU_TIEN_DV_MAU } from "./techtasks-list";

/*
 * Đăng ký kế hoạch ngày của các cụm kỹ thuật và bảng đánh giá các trung tâm.
 *
 * Danh mục mảng công việc, loại công việc, trạng thái và ngưỡng phê bình đều
 * lấy từ /api/admin/ke-hoach-ngay/meta — cố ý KHÔNG chép lại ở đây. Danh sách
 * đầu việc từng bị khai báo hai nơi và lệch nhau lúc nào không biết.
 */

const homNay = () => new Date().toISOString().slice(0, 10);
const luiNgay = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const so = (n) => Number(n || 0).toLocaleString("vi-VN");
const pct = (r) => (r == null ? "—" : `${Math.round(r * 1000) / 10}%`);
/** Đếm phần tử trong ô nhiều giá trị (mã user, mã trạm) — cùng cách tách với máy chủ. */
const demTach = (v) => (v || "").split(/[;,]/).filter((x) => x.trim()).length;

const MAU = { do: "#C8102E", vang: "#C97A07", xanh: "#0A7A50", lam: "#0E6CD6", xam: "#6B7A90" };

const MAU_CANH_BAO = { phe_binh: MAU.do, nhac_nho: MAU.vang, ok: MAU.xanh };
const TEN_CANH_BAO = { phe_binh: "Phê bình", nhac_nho: "Nhắc nhở", ok: "Đúng hạn" };
const TEN_XEP_LOAI = { tot: "Tốt", kha: "Khá", trung_binh: "Trung bình", can_chan_chinh: "Cần chấn chỉnh" };
const MAU_XEP_LOAI = { tot: MAU.xanh, kha: MAU.lam, trung_binh: MAU.vang, can_chan_chinh: MAU.do };
const MAU_MUC_DO = { nong: MAU.do, canh_bao: MAU.vang, binh_thuong: MAU.xam };
const TEN_MUC_DO = { nong: "Nóng", canh_bao: "Cần chú ý", binh_thuong: "Bình thường" };

function OSo({ nhan, so: giaTri, mau, goi_y }) {
  return (
    <div className="card" style={{ padding: 12 }} title={goi_y || ""}>
      <div className="muted" style={{ fontSize: 12 }}>{nhan}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: mau || MAU.lam, lineHeight: 1.25 }}>{giaTri}</div>
    </div>
  );
}

function The({ chu, mau }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 12,
      fontWeight: 700, color: "#fff", background: mau || MAU.xam, whiteSpace: "nowrap",
    }}>{chu}</span>
  );
}

// ---------------------------------------------------------------- Kế hoạch ngày

export function KeHoachNgayTab() {
  const [ngay, setNgay] = useState(homNay);
  const [meta, setMeta] = useState(null);
  const [data, setData] = useState(null);
  const [deXuat, setDeXuat] = useState(null);
  const [nhanSu, setNhanSu] = useState([]);
  const [form, setForm] = useState(null);        // bản đăng ký đang mở để nhập
  const [moNhanSu, setMoNhanSu] = useState(false);
  const [moKetQua, setMoKetQua] = useState(false);   // cột trạng thái + trạm xong, chỉ cần cuối ngày
  const [mangMo, setMangMo] = useState([]);          // mảng phụ người dùng bấm thêm
  const [hangMuc, setHangMuc] = useState({});        // hạng mục để đẩy số lên báo cáo tháng
  const [moDeXuat, setMoDeXuat] = useState(true);
  const [fUuTien, setFUuTien] = useState("");     // lọc khuyến nghị theo mức ưu tiên đầu việc
  const [err, setErr] = useState("");
  const [tin, setTin] = useState("");
  const oNhap = useCuonToi(!!form);

  // Tài khoản gắn với một cụm thì mở sẵn đúng cụm đó, khỏi tìm trong 13 cụm
  // và khỏi đăng ký nhầm sang cụm khác.
  const cumToi = cumCuaToi();
  // Máy chủ nói rõ tài khoản này được ghi cho cụm nào ("" = mọi cụm), để nút
  // chỉ mở đúng chỗ thay vì để người dùng bấm rồi mới nhận báo lỗi.
  const chiCum = meta?.cum_duoc_ghi || "";
  const ghiDuocCho = (ma) => !chiCum || ma === chiCum;
  const duocGhi = coQuyen("daily_plan", "create");
  const duocSua = coQuyen("daily_plan", "update");
  const duocXoa = coQuyen("daily_plan", "delete");

  const load = () => {
    api.get(`/api/admin/ke-hoach-ngay?ngay=${ngay}`).then(setData).catch((e) => setErr(e.message));
    api.get(`/api/admin/ke-hoach-ngay/de-xuat?ngay=${ngay}`).then(setDeXuat).catch(() => setDeXuat(null));
  };
  useEffect(() => { load(); }, [ngay]);
  useEffect(() => {
    api.get("/api/admin/ke-hoach-ngay/meta").then(setMeta).catch((e) => setErr(e.message));
    api.get("/api/admin/ke-hoach-ngay/nhan-su").then(setNhanSu).catch(() => {});
    api.get("/api/admin/ke-hoach-ngay/hang-muc").then(setHangMuc).catch(() => {});
  }, []);

  const quanSo = useMemo(
    () => Object.fromEntries(nhanSu.map((r) => [r.center, r.so_nhan_su])), [nhanSu]);

  const moForm = (center) => {
    setErr(""); setTin("");
    // Gợi ý hạng mục theo khuyến nghị của chính cụm này: ô Hạng mục điền sẵn
    // hạng mục đang tồn nhiều nhất của từng mảng, người nhập sửa lại được.
    const goiY = (deXuat?.trung_tam || []).find((t) => t.center === center)?.goi_y_hang_muc || {};
    api.get(`/api/admin/ke-hoach-ngay/chi-tiet?center=${encodeURIComponent(center)}&ngay=${ngay}`)
      .then((x) => {
        setForm({
          ...x,
          dong: x.dong.map((d) => (d.hang_muc ? d : { ...d, hang_muc: goiY[d.mang] || "" })),
        });
        // Mảng phụ chỉ mở sẵn nếu bản đăng ký đã có dữ liệu ở đó, để sửa lại
        // không bị mất phần đã nhập.
        setMangMo(x.dong.filter((d) => !mangChinh.includes(d.mang)
          && (d.ft_user || d.tram || d.cong_viec || d.ghi_chu || d.so_ns)).map((d) => d.mang));
        setMoKetQua(x.dong.some((d) => d.trang_thai !== "chua_lam" || d.so_tram_xong));
      })
      .catch((e) => setErr(e.message));
  };

  const luu = () => {
    setErr(""); setTin("");
    api.put("/api/admin/ke-hoach-ngay", {
      ngay: form.ngay, center: form.center, ghi_chu: form.ghi_chu,
      ft_truc: form.ft_truc === "" || form.ft_truc == null ? null : Number(form.ft_truc),
      ft_nghi_phep: Number(form.ft_nghi_phep) || 0,
      ft_nghi_ca: Number(form.ft_nghi_ca) || 0,
      ghi_chu_nghi: form.ghi_chu_nghi || "",
      // Chỉ gửi mảng đang mở: mảng phụ chưa bấm mở thì coi như không đăng ký.
      dong: form.dong.filter((d) => mangChinh.includes(d.mang) || mangMo.includes(d.mang)).map((d) => ({
        mang: d.mang, hang_muc: d.hang_muc, ft_user: d.ft_user,
        so_ns: d.so_ns === "" || d.so_ns == null ? null : Number(d.so_ns),
        tram: d.tram,
        so_tram: d.so_tram === "" || d.so_tram == null ? null : Number(d.so_tram),
        cong_viec: d.cong_viec, ghi_chu: d.ghi_chu,
        trang_thai: d.trang_thai, so_tram_xong: Number(d.so_tram_xong) || 0,
      })),
    }).then((kq) => {
      setForm(null);
      const day = kq?.day_len_bao_cao_thang || [];
      setTin(`Đã lưu kế hoạch ngày ${form.ngay} của cụm ${form.center}.`
        + (day.length ? ` Đã cập nhật số Thực hiện tháng cho ${day.length} hạng mục.` : ""));
      load();
    })
      .catch((e) => setErr(e.message));
  };

  const xoa = (r) => {
    if (!window.confirm(`Xoá bản đăng ký ngày ${r.ngay} của cụm ${r.center}?`)) return;
    api.del(`/api/admin/ke-hoach-ngay/${r.id}`).then(() => { setTin("Đã xoá bản đăng ký."); load(); })
      .catch((e) => setErr(e.message));
  };

  const suaDong = (i, khoa, giaTri) => setForm((f) => ({
    ...f, dong: f.dong.map((d, j) => (j === i ? { ...d, [khoa]: giaTri } : d)),
  }));

  const ds = data?.danh_sach || [];
  const tongNs = ds.reduce((a, r) => a + (r.tong_ns || 0), 0);
  const tongTram = ds.reduce((a, r) => a + (r.tong_tram || 0), 0);
  const tongXong = ds.reduce((a, r) => a + (r.tram_xong || 0), 0);
  const quanSoForm = form ? (quanSo[form.center] ?? form.so_nhan_su ?? 0) : 0;
  const mangChinh = meta?.mang_chinh || ["co_dien", "truyen_dan", "kiem_soat"];
  // Mảng chính luôn hiện; mảng phụ chỉ hiện sau khi bấm thêm.
  const dongHien = form
    ? form.dong.map((d, i) => ({ d, i }))
        .filter(({ d }) => mangChinh.includes(d.mang) || mangMo.includes(d.mang))
    : [];
  const mangThem = (meta?.mang || []).filter((m) => !m.chinh && !mangMo.includes(m.ma));
  // Khuyến nghị đã lọc theo mức ưu tiên: lọc theo mức của từng ĐẦU VIỆC còn tồn,
  // không lọc theo mức chung của trung tâm — nếu không, chọn "Khẩn cấp" sẽ giấu
  // mất trung tâm có một việc khẩn cấp lẫn trong nhiều việc thường.
  const dsDeXuat = useMemo(() => {
    const ds = deXuat?.trung_tam || [];
    if (!fUuTien) return ds;
    return ds
      .map((x) => ({ ...x, dau_viec: (x.dau_viec || []).filter((d) => (d.uu_tien || "") === fUuTien) }))
      .filter((x) => x.dau_viec.length)
      .sort((a, b) => (THU_TU_UU_TIEN[a.uu_tien || ""] - THU_TU_UU_TIEN[b.uu_tien || ""]) || b.ton - a.ton);
  }, [deXuat, fUuTien]);
  const soNghiForm = form ? (Number(form.ft_nghi_phep) || 0) + (Number(form.ft_nghi_ca) || 0) : 0;
  const lechQuanSo = !!(form && quanSoForm && (Number(form.ft_truc) || 0) + soNghiForm > quanSoForm);

  /** Đổi số nghỉ thì số trực tự bớt đi, khỏi phải sửa hai ô cho khớp. */
  const doiSoNghi = (khoa, giaTri) => setForm((f) => {
    const moi = { ...f, [khoa]: giaTri };
    const nghi = (Number(moi.ft_nghi_phep) || 0) + (Number(moi.ft_nghi_ca) || 0);
    const qs = quanSo[f.center] ?? f.so_nhan_su ?? 0;
    return qs ? { ...moi, ft_truc: Math.max(qs - nghi, 0) } : moi;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b>Đăng ký kế hoạch ngày của cụm kỹ thuật</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Mỗi cụm mỗi ngày một bản đăng ký, chia theo mảng công việc: số nhân sự thực hiện, trạm thực hiện,
            công việc thực hiện và ghi chú. Cuối ngày cập nhật trạng thái và số trạm đã xong để bảng đánh giá
            có kết quả thật. Đăng ký lại cùng ngày là sửa bản cũ, không tạo thêm bản mới.
          </p>
        </div>
        <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
          <CalendarDays size={15} style={{ color: RED }} />
          <input className="inp" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)}
            style={{ width: 160 }} />
        </label>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>

      {!!chiCum && (
        <p className="card" style={{ fontSize: 12.5, padding: "8px 12px" }}>
          Tài khoản của bạn đăng ký được cho <b>cụm {chiCum}</b>. Cần đăng ký hộ cụm khác thì nhờ
          quản trị viên cấp quyền sửa mục “Kế hoạch ngày của cụm”.
        </p>
      )}

      {!!cumToi && (
        <div className="card flex items-center gap-2" style={{ flexWrap: "wrap", padding: "8px 12px" }}>
          <b style={{ fontSize: 13 }}>Cụm của bạn: {cumToi}</b>
          {(() => {
            const daCo = ds.find((r) => r.center === cumToi);
            return daCo
              ? <span style={{ fontSize: 12.5, color: MAU.xanh, fontWeight: 700 }}>
                  <Check size={13} /> Đã đăng ký hôm nay — {daCo.tong_ns} NS, {daCo.tong_tram} trạm
                </span>
              : <span style={{ fontSize: 12.5, color: MAU.do, fontWeight: 700 }}>Chưa đăng ký ngày {ngay}</span>;
          })()}
          {duocGhi && (
            <button className="btn btn-sm btn-red" onClick={() => moForm(cumToi)}>
              {ds.some((r) => r.center === cumToi) ? "Sửa / cập nhật kết quả" : "Đăng ký ngay"}
            </button>
          )}
        </div>
      )}

      {err && <p className="card" style={{ color: RED, fontWeight: 600 }}>{err}</p>}
      {tin && <p className="card" style={{ color: MAU.xanh, fontWeight: 600 }}>{tin}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <OSo nhan="Cụm đã đăng ký" so={`${data?.da_dang_ky ?? 0}/${data?.tong_cum ?? 0}`}
          mau={data && data.da_dang_ky >= data.tong_cum ? MAU.xanh : MAU.lam} />
        <OSo nhan="Cụm chưa đăng ký" so={so(data?.chua_dang_ky?.length)}
          mau={data?.chua_dang_ky?.length ? MAU.do : MAU.xanh} />
        <OSo nhan="Nhân sự huy động" so={so(tongNs)} mau={MAU.lam} goi_y="Cộng số nhân sự các mảng đã đăng ký" />
        <OSo nhan="Trạm đăng ký" so={so(tongTram)} mau={MAU.lam} />
        <OSo nhan="Trạm đã xong" so={so(tongXong)} mau={tongXong ? MAU.xanh : MAU.xam}
          goi_y="Theo cập nhật cuối ngày của từng mảng" />
      </div>

      {/* ---- Đề xuất việc nóng ---- */}
      <Card pad={false} icon={Flame}
        title={`Đề xuất việc nóng / quá hạn theo trung tâm${dsDeXuat.length ? ` (${dsDeXuat.length})` : ""}`}
        action={<button className="btn btn-sm" onClick={() => setMoDeXuat((v) => !v)}>
          {moDeXuat ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{moDeXuat ? "Thu gọn" : "Mở"}
        </button>}>
        {moDeXuat && (
          <div style={{ padding: 12 }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Căn cứ khối lượng còn tồn của kỳ gần nhất (Kế hoạch − BKK − Thực hiện) và các nhiệm vụ đã quá hạn
              trong module Công việc. Trung tâm còn việc quá hạn xếp trước, sau đó tới nơi tồn nhiều nhất.
            </p>
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 8 }}>
              <b style={{ fontSize: 12.5 }}>Mức ưu tiên:</b>
              <button className={`btn btn-sm ${!fUuTien ? "btn-red" : ""}`} onClick={() => setFUuTien("")}>
                Tất cả
              </button>
              {Object.entries(UU_TIEN_DV).map(([ma, ten]) => (
                <button key={ma} className={`btn btn-sm ${fUuTien === ma ? "btn-red" : ""}`}
                  onClick={() => setFUuTien(fUuTien === ma ? "" : ma)}
                  style={fUuTien === ma ? undefined : { borderLeft: `3px solid ${UU_TIEN_DV_MAU[ma]}` }}>
                  {ten}
                </button>
              ))}
            </div>
            {!dsDeXuat.length ? (
              <Empty title="Chưa có đề xuất" hint="Chưa có số liệu tồn hoặc việc quá hạn nào theo trung tâm." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Trung tâm</th><th>Ưu tiên</th><th>Mức độ</th><th>Tồn</th><th>Việc quá hạn</th>
                      <th>Nên ưu tiên</th><th>Đăng ký</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsDeXuat.map((x) => (
                      <tr key={x.center}>
                        <td><b>{x.center}</b> <span className="muted">{x.ten}</span></td>
                        <td><TheUuTienDV muc={x.uu_tien || ""} nho /></td>
                        <td><The chu={TEN_MUC_DO[x.muc_do] || x.muc_do} mau={MAU_MUC_DO[x.muc_do]} /></td>
                        <td className="mono">{so(x.ton)}</td>
                        <td className="mono" style={{ color: x.so_viec_qua_han ? MAU.do : undefined }}>
                          {x.so_viec_qua_han ? `${x.so_viec_qua_han} (trễ nhất ${x.tre_nhat} ngày)` : "—"}
                        </td>
                        <td style={{ maxWidth: 420, fontSize: 12.5 }}>
                          {x.de_xuat || "—"}
                          {!!x.dau_viec?.length && (
                            <div className="flex gap-1" style={{ flexWrap: "wrap", marginTop: 4 }}>
                              {x.dau_viec.slice(0, 3).map((dv) => (
                                <span key={dv.category} style={{ fontSize: 11.5 }}>
                                  <TheUuTienDV muc={dv.uu_tien || ""} nho /> {dv.label} ({so(dv.ton)})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>{x.da_dang_ky
                          ? <span style={{ color: MAU.xanh, fontWeight: 700 }}><Check size={13} /> Đã đăng ký</span>
                          : <span className="muted">Chưa</span>}</td>
                        <td>{duocGhi && ghiDuocCho(x.center) && (
                          <button className="btn btn-sm" onClick={() => moForm(x.center)}>Đăng ký</button>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!!deXuat?.ngoai_cum?.length && (
              <p style={{ fontSize: 12.5, marginTop: 10 }}>
                <AlertTriangle size={13} style={{ color: MAU.vang }} />{" "}
                <b>Còn {so(deXuat.ngoai_cum.reduce((a, x) => a + x.ton, 0))} khối lượng chưa chia về cụm nào</b>{" "}
                ({deXuat.ngoai_cum.flatMap((x) => (x.theo_mang || [])).map((m) => `${m.ten_mang} ${so(m.ton)}`).join(", ")})
                {" "}— phần này chưa vào được khuyến nghị của cụm nào; chia về cụm ở màn hình đầu việc thì mới tính được.
              </p>
            )}
            {!!deXuat?.chua_chia_don_vi?.length && (
              <p style={{ fontSize: 12.5, marginTop: 10 }}>
                <AlertTriangle size={13} style={{ color: MAU.vang }} />{" "}
                <b>{deXuat.chua_chia_don_vi.length} việc quá hạn chưa chia về trung tâm nào:</b>{" "}
                {deXuat.chua_chia_don_vi.slice(0, 3).map((v) => `${v.title} (trễ ${v.tre_ngay} ngày)`).join("; ")}
                {deXuat.chua_chia_don_vi.length > 3 ? "…" : ""}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ---- Khung nhập ---- */}
      {form && (
        <div ref={oNhap} className="card o-nhap">
          <div className="flex items-center gap-2" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            <b style={{ flex: 1, minWidth: 200 }}>
              Kế hoạch ngày {form.ngay} — cụm {form.center} <span className="muted">{form.ten}</span>
            </b>
            <button className={`btn btn-sm ${moKetQua ? "btn-red" : ""}`} onClick={() => setMoKetQua((v) => !v)}
              title="Bật khi cập nhật kết quả cuối ngày">
              <ClipboardCheck size={14} />Kết quả cuối ngày
            </button>
            <button className="btn btn-sm" onClick={() => setForm(null)}><X size={14} />Đóng</button>
            {(duocGhi || duocSua) && (
              <button className="btn btn-sm btn-red" onClick={luu}><Save size={14} />Lưu đăng ký</button>
            )}
          </div>

          {/* Quân số trong ngày */}
          <div className="flex items-end gap-3" style={{ flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>FT hiện tại của cụm</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: MAU.lam }}>{quanSoForm || "—"}</div>
            </div>
            <Field label="FT trực"><input className="inp" type="number" min="0" style={{ width: 80 }}
              value={form.ft_truc ?? 0} onChange={(e) => setForm({ ...form, ft_truc: e.target.value })} /></Field>
            <Field label="Nghỉ phép"><input className="inp" type="number" min="0" style={{ width: 80 }}
              value={form.ft_nghi_phep ?? 0}
              onChange={(e) => doiSoNghi("ft_nghi_phep", e.target.value)} /></Field>
            <Field label="Nghỉ ca"><input className="inp" type="number" min="0" style={{ width: 80 }}
              value={form.ft_nghi_ca ?? 0}
              onChange={(e) => doiSoNghi("ft_nghi_ca", e.target.value)} /></Field>
            <div style={{ flex: 1, minWidth: 260 }}>
              <Field label="Mã user nghỉ phép / nghỉ ca">
                <input className="inp" value={form.ghi_chu_nghi || ""} placeholder="vd: nvA (phép); nvB (nghỉ ca)"
                  onChange={(e) => setForm({ ...form, ghi_chu_nghi: e.target.value })} />
              </Field>
            </div>
            <span style={{ fontSize: 12.5, color: lechQuanSo ? MAU.do : MAU.xam, paddingBottom: 6 }}>
              <Users size={13} /> Trực {Number(form.ft_truc) || 0} + nghỉ {soNghiForm} / {quanSoForm || "?"} FT
              {lechQuanSo ? " — vượt quân số cụm, kiểm tra lại" : ""}
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 120 }}>Mảng</th>
                  <th style={{ minWidth: 180 }}
                    title="Chọn hạng mục thì số trạm làm xong tự cộng lên số Thực hiện của tháng — khỏi phải chốt số tháng bằng tay">
                    Hạng mục (đẩy lên số tháng)
                  </th>
                  <th style={{ minWidth: 200 }} title="Mã user các FT làm mảng này, ngăn nhau bởi dấu chấm phẩy">
                    FT thực hiện (mã user)
                  </th>
                  <th style={{ minWidth: 62 }} title="Tự đếm theo ô mã user, sửa tay được">Số NS</th>
                  <th style={{ minWidth: 200 }} title="Nhiều trạm ngăn nhau bởi dấu chấm phẩy">Trạm thực hiện</th>
                  <th style={{ minWidth: 62 }} title="Tự đếm theo ô trạm, sửa tay được">Số trạm</th>
                  <th style={{ minWidth: 170 }}>Công việc thực hiện</th>
                  <th style={{ minWidth: 170 }}>Ghi chú</th>
                  {moKetQua && <th style={{ minWidth: 115 }}>Trạng thái</th>}
                  {moKetQua && <th style={{ minWidth: 62 }}>Trạm xong</th>}
                </tr>
              </thead>
              <tbody>
                {dongHien.map(({ d, i }) => (
                  <tr key={d.mang}>
                    <td><b>{d.ten_mang}</b></td>
                    <td>
                      <select className="inp" value={d.hang_muc || ""}
                        onChange={(e) => suaDong(i, "hang_muc", e.target.value)}>
                        <option value="">— không đẩy lên số tháng —</option>
                        {(hangMuc[d.mang] || []).map((h) => (
                          <option key={h.ma} value={h.ma}>{h.ten}</option>
                        ))}
                        {(hangMuc.khac || []).length > 0 && (
                          <optgroup label="Hạng mục mảng khác">
                            {(hangMuc.khac || []).map((h) => (
                              <option key={h.ma} value={h.ma}>{h.ten}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </td>
                    <td><input className="inp" value={d.ft_user || ""} placeholder="vd: luongdv; sonld"
                      onChange={(e) => suaDong(i, "ft_user", e.target.value)} /></td>
                    <td><input className="inp" type="number" min="0" style={{ width: 58 }}
                      value={d.so_ns ?? ""} placeholder={String(demTach(d.ft_user) || "")}
                      onChange={(e) => suaDong(i, "so_ns", e.target.value)} /></td>
                    <td><input className="inp" value={d.tram || ""} placeholder="HCM0123; HCM0456"
                      onChange={(e) => suaDong(i, "tram", e.target.value)} /></td>
                    <td><input className="inp" type="number" min="0" style={{ width: 58 }}
                      value={d.so_tram ?? ""} placeholder={String(demTach(d.tram) || "")}
                      onChange={(e) => suaDong(i, "so_tram", e.target.value)} /></td>
                    <td><input className="inp" list="dsLoaiCongViec" value={d.cong_viec || ""}
                      placeholder="Bảo dưỡng; Lắp đặt"
                      onChange={(e) => suaDong(i, "cong_viec", e.target.value)} /></td>
                    <td><input className="inp" value={d.ghi_chu || ""}
                      onChange={(e) => suaDong(i, "ghi_chu", e.target.value)} /></td>
                    {moKetQua && (
                      <td>
                        <select className="inp" value={d.trang_thai || "chua_lam"}
                          onChange={(e) => suaDong(i, "trang_thai", e.target.value)}>
                          {(meta?.trang_thai || []).map((t) => <option key={t.ma} value={t.ma}>{t.ten}</option>)}
                        </select>
                      </td>
                    )}
                    {moKetQua && (
                      <td><input className="inp" type="number" min="0" style={{ width: 58 }}
                        value={d.so_tram_xong ?? 0}
                        onChange={(e) => suaDong(i, "so_tram_xong", e.target.value)} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="dsLoaiCongViec">
              {(meta?.loai_cong_viec || []).map((lv) => <option key={lv} value={lv} />)}
            </datalist>
          </div>

          {/* Bốn mảng ít dùng: chỉ hiện khi cần, để màn hình thường ngày gọn lại */}
          {!!mangThem.length && (
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>Thêm mảng:</span>
              {mangThem.map((m) => (
                <button key={m.ma} className="btn btn-sm" onClick={() => setMangMo((v) => [...v, m.ma])}>
                  <Plus size={13} />{m.ten}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10, maxWidth: 640 }}>
            <Field label="Ghi chú chung của cụm (chỉ huy trực, việc phát sinh nóng…)">
              <textarea className="inp" rows={2} value={form.ghi_chu || ""}
                onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} />
            </Field>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Mảng nào không có việc thì để trống cả dòng — dòng trống không được lưu.
            Số NS và Số trạm bỏ trống thì tự đếm theo ô mã user và ô trạm.
            Chọn Hạng mục thì số trạm làm xong (ô “Kết quả cuối ngày”) tự cộng lên số Thực hiện của tháng —
            không phải ngồi chốt số tháng bằng tay nữa, và sửa lại bản đăng ký bao nhiêu lần cũng không cộng trùng.
          </p>
        </div>
      )}

      {/* ---- Danh sách đăng ký trong ngày ---- */}
      <Card pad={false} title={`Đã đăng ký ngày ${data?.ngay || ngay}`}>
        {!ds.length ? (
          <Empty title="Chưa cụm nào đăng ký" hint="Chọn cụm ở danh sách bên dưới để đăng ký kế hoạch ngày." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cụm</th><th title="FT hiện tại của cụm">FT</th><th>Trực</th><th>Nghỉ</th>
                  <th title="Tổng nhân sự các mảng huy động">NS huy động</th><th>Trạm</th><th>Đã xong</th>
                  <th>Mảng đăng ký</th><th>Cập nhật</th><th></th>
                </tr>
              </thead>
              <tbody>
                {ds.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.center}</b> <span className="muted">{r.ten}</span></td>
                    <td className="mono">{so(r.so_nhan_su)}</td>
                    <td className="mono" style={{ color: r.lech_quan_so ? MAU.do : undefined }}>{so(r.ft_truc)}</td>
                    <td className="mono" title={r.ghi_chu_nghi || ""}>
                      {r.ft_nghi ? `${r.ft_nghi}${r.ghi_chu_nghi ? " ⓘ" : ""}` : "—"}
                    </td>
                    <td className="mono" style={{ color: r.vuot_quan_so ? MAU.do : undefined }}
                      title={r.vuot_quan_so ? "Huy động vượt quân số cụm" : ""}>
                      {so(r.tong_ns)}{r.vuot_quan_so ? " ⚠" : ""}
                    </td>
                    <td className="mono">{so(r.tong_tram)}</td>
                    <td className="mono" style={{ color: r.tram_xong ? MAU.xanh : undefined }}>{so(r.tram_xong)}</td>
                    <td style={{ fontSize: 12.5 }}>
                      {r.dong.map((d) => `${d.ten_mang} (${d.so_ns} NS/${d.so_tram} trạm${d.ft_user ? `: ${d.ft_user}` : ""})`).join(", ")}
                      {r.ghi_chu ? <div className="muted" style={{ marginTop: 2 }}>Ghi chú: {r.ghi_chu}</div> : null}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.updated_by || "—"}</td>
                    <td className="flex gap-1">
                      {(duocGhi || duocSua) && ghiDuocCho(r.center) && (
                        <button className="btn btn-sm" onClick={() => moForm(r.center)}>Sửa</button>
                      )}
                      {duocXoa && (
                        <button className="btn btn-sm" onClick={() => xoa(r)} title="Xoá bản đăng ký">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!!data?.chua_dang_ky?.length && (
        <Card title={`Cụm chưa đăng ký ngày ${data.ngay} (${data.chua_dang_ky.length})`}>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {data.chua_dang_ky.map((c) => (
              <button key={c.center} className="btn btn-sm"
                disabled={!duocGhi || !ghiDuocCho(c.center)}
                onClick={() => moForm(c.center)}
                title={!duocGhi ? "Không có quyền đăng ký"
                  : ghiDuocCho(c.center) ? "Đăng ký cho cụm này"
                    : `Tài khoản của bạn chỉ đăng ký được cho cụm ${chiCum}`}>
                <b>{c.center}</b>&nbsp;<span className="muted">{c.ten}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ---- Quân số cụm ---- */}
      <Card pad={false} icon={Users} title="Quân số các cụm (dữ liệu cứng)"
        action={<button className="btn btn-sm" onClick={() => setMoNhanSu((v) => !v)}>
          {moNhanSu ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{moNhanSu ? "Thu gọn" : "Mở"}
        </button>}>
        {moNhanSu && (
          <div style={{ padding: 12 }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              Số nhân sự hiện có của từng cụm. Đây là mốc để đối chiếu số người huy động trong ngày;
              sửa ở đây áp dụng cho các bản đăng ký từ lúc sửa trở đi, bản cũ giữ nguyên số đã chốt.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead><tr><th>Cụm</th><th title="Định biên tối thiểu của nhà trạm">FT tối thiểu</th>
                  <th>FT hiện tại</th><th>Thiếu</th><th>Ghi chú</th><th>Cập nhật</th><th></th></tr></thead>
                <tbody>
                  {nhanSu.map((r, i) => (
                    <tr key={r.center}>
                      <td><b>{r.center}</b> <span className="muted">{r.ten}</span></td>
                      <td><input className="inp" type="number" min="0" style={{ width: 76 }} value={r.ft_toi_thieu ?? 0}
                        disabled={!duocSua}
                        onChange={(e) => setNhanSu((ds_) => ds_.map((x, j) =>
                          (j === i ? { ...x, ft_toi_thieu: e.target.value, ban: true } : x)))} /></td>
                      <td><input className="inp" type="number" min="0" style={{ width: 76 }} value={r.so_nhan_su}
                        disabled={!duocSua}
                        onChange={(e) => setNhanSu((ds_) => ds_.map((x, j) =>
                          (j === i ? { ...x, so_nhan_su: e.target.value, ban: true } : x)))} /></td>
                      <td className="mono" style={{ color: (Number(r.ft_toi_thieu) || 0) > (Number(r.so_nhan_su) || 0) ? MAU.do : MAU.xanh }}>
                        {Math.max((Number(r.ft_toi_thieu) || 0) - (Number(r.so_nhan_su) || 0), 0) || "—"}
                      </td>
                      <td><input className="inp" value={r.ghi_chu || ""} disabled={!duocSua}
                        onChange={(e) => setNhanSu((ds_) => ds_.map((x, j) =>
                          (j === i ? { ...x, ghi_chu: e.target.value, ban: true } : x)))} /></td>
                      <td style={{ fontSize: 12 }}>{r.updated_by || "—"}</td>
                      <td>{duocSua && r.ban && (
                        <button className="btn btn-sm btn-red" onClick={() => {
                          api.put(`/api/admin/ke-hoach-ngay/nhan-su/${r.center}`,
                            { so_nhan_su: Number(r.so_nhan_su) || 0,
                              ft_toi_thieu: Number(r.ft_toi_thieu) || 0,
                              ghi_chu: r.ghi_chu || "" })
                            .then(() => api.get("/api/admin/ke-hoach-ngay/nhan-su"))
                            .then((x) => { setNhanSu(x); setTin(`Đã lưu quân số cụm ${r.center}.`); })
                            .catch((e) => setErr(e.message));
                        }}><Save size={14} />Lưu</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------- Đánh giá trung tâm

export function DanhGiaTrungTamTab() {
  const [tu, setTu] = useState(() => luiNgay(6));
  const [den, setDen] = useState(homNay);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = () => api.get(`/api/admin/ke-hoach-ngay/danh-gia?tu=${tu}&den=${den}`)
    .then((x) => { setData(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [tu, den]);

  const ds = data?.trung_tam || [];
  const pheBinh = ds.filter((x) => x.canh_bao === "phe_binh");

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b>Đánh giá kết quả đăng ký kế hoạch ngày của các trung tâm</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Trung tâm chưa đăng ký ngày gần nhất thì bị nhắc nhở; quá {data?.ngay_phe_binh ?? 3} ngày liên tiếp
            không đăng ký thì bị phê bình. Số ngày không đăng ký đếm lùi từ ngày cuối khoảng, kể cả khi lần đăng ký
            gần nhất nằm trước khoảng đang xem.
          </p>
        </div>
        <label className="flex items-center gap-1" style={{ fontSize: 13 }}>Từ
          <input className="inp" type="date" value={tu} onChange={(e) => setTu(e.target.value)} style={{ width: 150 }} />
        </label>
        <label className="flex items-center gap-1" style={{ fontSize: 13 }}>đến
          <input className="inp" type="date" value={den} onChange={(e) => setDen(e.target.value)} style={{ width: 150 }} />
        </label>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>

      {err && <p className="card" style={{ color: RED, fontWeight: 600 }}>{err}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <OSo nhan="Số cụm theo dõi" so={so(data?.tong_hop?.so_cum)} mau={MAU.lam} />
        <OSo nhan={`Đăng ký đủ ${data?.so_ngay || 0} ngày`} so={so(data?.tong_hop?.du_ngay)} mau={MAU.xanh} />
        <OSo nhan="Đang bị nhắc nhở" so={so(data?.tong_hop?.nhac_nho)}
          mau={data?.tong_hop?.nhac_nho ? MAU.vang : MAU.xanh} />
        <OSo nhan="Đề nghị phê bình" so={so(data?.tong_hop?.phe_binh)}
          mau={data?.tong_hop?.phe_binh ? MAU.do : MAU.xanh} />
      </div>

      {!!pheBinh.length && (
        <p className="card" style={{ color: MAU.do, fontWeight: 600 }}>
          <AlertTriangle size={14} />{" "}
          Đề nghị phê bình {pheBinh.length} trung tâm quá {data.ngay_phe_binh} ngày không đăng ký kế hoạch:{" "}
          {pheBinh.map((x) => `${x.center} (${x.khong_dang_ky_ngay == null ? "chưa đăng ký lần nào"
            : `${x.khong_dang_ky_ngay} ngày`})`).join(", ")}.
        </p>
      )}

      <Card pad={false} title={`Bảng đánh giá ${data?.tu || tu} → ${data?.den || den}`}>
        {!ds.length ? <Empty title="Chưa có dữ liệu" hint="Chưa có danh mục mã cụm hoặc chưa có bản đăng ký nào." /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Trung tâm</th>
                  <th title="Số ngày có đăng ký trên tổng số ngày trong khoảng">Ngày đăng ký</th>
                  <th>Tỷ lệ đăng ký</th>
                  <th title="Số ngày liên tiếp không đăng ký, tính tới ngày cuối khoảng">Không đăng ký</th>
                  <th>Lần cuối</th>
                  <th title="Tổng lượt nhân sự huy động trong khoảng">NS huy động</th>
                  <th>Trạm</th><th>Trạm xong</th><th>Tỷ lệ hoàn thành</th>
                  <th>Cảnh báo</th><th>Xếp loại</th>
                </tr>
              </thead>
              <tbody>
                {ds.map((x) => (
                  <tr key={x.center} style={x.canh_bao === "phe_binh" ? { background: "#FFF3F5" } : undefined}>
                    <td><b>{x.center}</b> <span className="muted">{x.ten}</span></td>
                    <td className="mono">{x.so_ngay_dang_ky}/{x.so_ngay}</td>
                    <td className="mono">{pct(x.ty_le_dang_ky)}</td>
                    <td className="mono" style={{ color: x.canh_bao === "phe_binh" ? MAU.do : undefined }}>
                      {x.khong_dang_ky_ngay == null ? "chưa lần nào" : `${x.khong_dang_ky_ngay} ngày`}
                    </td>
                    <td style={{ fontSize: 12 }}>{x.lan_cuoi || "—"}</td>
                    <td className="mono">{so(x.tong_ns)}</td>
                    <td className="mono">{so(x.tong_tram)}</td>
                    <td className="mono">{so(x.tram_xong)}</td>
                    <td className="mono">{pct(x.ty_le_hoan_thanh)}</td>
                    <td><The chu={TEN_CANH_BAO[x.canh_bao] || x.canh_bao} mau={MAU_CANH_BAO[x.canh_bao]} /></td>
                    <td><The chu={TEN_XEP_LOAI[x.xep_loai] || x.xep_loai} mau={MAU_XEP_LOAI[x.xep_loai]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
