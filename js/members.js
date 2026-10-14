// Khi đổi ID hoặc tên, cập nhật danh sách tương ứng trong firestore.rules.
export const MEMBERS = [
  {
    id: "member_01",
    name: "Bảo Long",
    level: "Khá",
    gender: "Nam",
    avatar: "./assets/avatars/member_01.svg",
  },
  {
    id: "member_02",
    name: "Anh Nam",
    level: "Giỏi",
    gender: "Nam",
    avatar: "./assets/avatars/member_02.svg",
  },
  {
    id: "member_03",
    name: "Lan Anh",
    level: "Trung bình",
    gender: "Nữ",
    avatar: "./assets/avatars/member_03.svg",
  },
  {
    id: "member_04",
    name: "Minh Đức",
    level: "Khá",
    gender: "Nam",
    avatar: "./assets/avatars/member_04.svg",
  },
  {
    id: "member_05",
    name: "Hoàng",
    level: "Mới chơi",
    gender: "Nam",
    avatar: "./assets/avatars/member_05.svg",
  },
];
export const GUEST_AVATAR = "./assets/avatars/guest.svg";
export const getMember = (id) => MEMBERS.find((member) => member.id === id);
