import {doc,getDocFromServer} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {db} from './firebase.js';
import {passwordMd5} from './password-hash.js';

export async function verifyAdminPassword(password){
  if(typeof password!=='string'||!password.length)return false;
  if(!navigator.onLine)throw new Error('Bạn đang ngoại tuyến. Không thể xác nhận mật khẩu.');
  const snapshot=await getDocFromServer(doc(db,'settings','admin'));
  const hash=snapshot.data()?.passwordMd5;
  if(typeof hash!=='string'||!/^[a-f0-9]{32}$/i.test(hash))throw new Error('Chưa cấu hình mật khẩu quản trị hợp lệ trên Firebase.');
  return passwordMd5(password)===hash.toLowerCase();
}
