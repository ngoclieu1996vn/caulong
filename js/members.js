// Chỉnh thành viên tại đây; Firestore Rules không kiểm tra tên hoặc ID.
export const MEMBERS = [
  {
    id: "member_01",
    name: "Liệu Nguyễn",
    level: "Trung bình",
    gender: "Nam",
    avatar: "./assets/avatars/lieu.jpg",
  },
  {
    id: "member_02",
    name: "Tú Nguyễn",
    level: "Trung bình",
    gender: "Nam",
    avatar: "./assets/avatars/tu.jpg",
  },
  {
    id: "member_03",
    name: "Kim Xuân",
    level: "Trung bình",
    gender: "Nữ",
    avatar: "./assets/avatars/deo.jpg",
  },
  {
    id: "member_04",
    name: "Thái Quang",
    level: "Trung bình",
    gender: "Nam",
    avatar: "./assets/avatars/thai.jpg",
  },
  {
    id: "member_05",
    name: "Huỳnh Tuấn Duy",
    level: "Trung bình",
    gender: "Nam",
    avatar: "./assets/avatars/duy.jpg",
  },
  {
    id: "member_06",
    name: "Ngọc Đang",
    level: "Trung bình",
    gender: "Nam",
    avatar: "./assets/avatars/dang.jpg",
  },
];
export const GUEST_AVATAR = "./assets/avatars/guest.svg";
export const getMember = (id) => MEMBERS.find((member) => member.id === id);
