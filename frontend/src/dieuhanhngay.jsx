import React from "react";
import { PenLine } from "lucide-react";
import { getUser } from "./api";

/*
 * Nút "Đăng ký kế hoạch ngày" ở góc phải đầu trang chủ, ngay trên dòng ngày
 * tháng.
 *
 * Trước đây tệp này còn một bảng điều hành liệt kê 13 cụm ngay giữa trang chủ,
 * nhưng nội dung đó trùng với tab Kế hoạch ngày — vốn đã có ô đếm cụm đã/chưa
 * đăng ký và danh sách cụm còn thiếu — lại chiếm gần nửa màn hình. Đã bỏ bảng,
 * chỉ giữ lối vào.
 */

export function NutDangKyNgay({ onGo }) {
  // Khách chưa đăng nhập không đăng ký được; hiện nút chỉ tổ dẫn họ tới màn
  // hình đòi đăng nhập.
  if (!getUser()) return null;
  return (
    <button className="btn btn-sm btn-red" onClick={() => onGo?.("tech-tasks", "kehoach")}
      title="Mở màn hình đăng ký, rồi chọn trung tâm cần đăng ký">
      <PenLine size={13} />Đăng ký kế hoạch ngày
    </button>
  );
}
