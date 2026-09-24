import React, { useState } from "react";
import { TaskListTab } from "./techtasks-list";
import { TheoNhanVienTab } from "./techtasks-person";
import { BaoCaoCongViec } from "./techtasks-report";
import { DanhGiaTrungTamTab, KeHoachNgayTab } from "./techtasks-kehoach";
import { KiemSoatSoLieuTab } from "./techtasks-kiemsoat";

// Đầu việc KHÔNG còn khai báo cứng ở đây nữa: danh sách lấy từ
// /api/admin/tech-tasks/categories (bảng tech_categories). Trước đây cùng một
// danh sách bị chép ở cả hai phía nên thêm đầu việc phải sửa code hai nơi và
// rất dễ lệch với phần Tiến độ.

const pct = (rate) => (rate == null ? "—" : `${Math.round(rate * 100)}%`);

export function AdminTechTasks() {
  const [tab, setTab] = useState("list");
  const [locDauViec, setLocDauViec] = useState(undefined);
  // Từ tab "Theo nhân viên" bấm "Xem việc" -> danh sách lọc sẵn theo người đó.
  // Kèm mốc thời gian để bấm lại cùng một người vẫn áp lại bộ lọc.
  const [locNguoi, setLocNguoi] = useState(undefined);
  const nutTab = (ma, nhan, khiBam) => (
    <button className={`btn btn-sm ${tab === ma ? "btn-red" : ""}`} onClick={() => { khiBam?.(); setTab(ma); }}>{nhan}</button>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex gap-2" style={{ padding: 8, flexWrap: "wrap" }}>
        {nutTab("list", "Danh sách công việc")}
        {nutTab("person", "Theo nhân viên")}
        {nutTab("kehoach", "Kế hoạch ngày")}
        {nutTab("danhgia", "Đánh giá trung tâm")}
        {nutTab("report", "Báo cáo")}
        {nutTab("kiemsoat", "Kiểm soát số liệu")}
      </div>
      {/* Không còn tab Tiến độ riêng: số liệu Kế hoạch/Thực hiện theo cụm và FT
          nằm ngay trong màn hình từng đầu việc, xem ở đó là đủ. */}
      {tab === "list" && (
        <TaskListTab locDauViec={locDauViec} locNguoi={locNguoi}
          onMoTienDo={(t) => { setLocDauViec(t.category); setLocNguoi({ ten: "", luc: Date.now() }); }} />
      )}
      {tab === "person" && (
        <TheoNhanVienTab onXemViec={(ten) => { setLocDauViec(""); setLocNguoi({ ten, luc: Date.now() }); setTab("list"); }} />
      )}
      {tab === "kehoach" && <KeHoachNgayTab />}
      {tab === "danhgia" && <DanhGiaTrungTamTab />}
      {tab === "kiemsoat" && <KiemSoatSoLieuTab />}
      {tab === "report" && (
        <BaoCaoCongViec onXemViec={(ten) => { setLocDauViec(""); setLocNguoi({ ten, luc: Date.now() }); setTab("list"); }}
          onXemDauViec={(category) => { setLocDauViec(category); setLocNguoi({ ten: "", luc: Date.now() }); setTab("list"); }} />
      )}
    </div>
  );
}
