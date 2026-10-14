import { doc, onSnapshot, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { db } from './firebase.js';
import { isValidDateKey } from './utils.js';

function reference(collectionName,date) {
  if (!['billing','teamGames'].includes(collectionName) || !isValidDateKey(date)) throw new Error('Dữ liệu ngày không hợp lệ.');
  return doc(db,collectionName,date);
}
export function watchDayDocument(collectionName,date,onData,onError) {
  return onSnapshot(reference(collectionName,date),{includeMetadataChanges:true},snapshot=>{
    if (snapshot.metadata.hasPendingWrites) return;
    onData({data:snapshot.exists()?snapshot.data():null,fromCache:snapshot.metadata.fromCache,hasPendingWrites:false});
  },onError);
}
export async function saveDayDocument(collectionName,date,payload,expectedRevision) {
  const ref=reference(collectionName,date);
  return runTransaction(db,async transaction=>{
    const snapshot=await transaction.get(ref);
    const revision=snapshot.exists() ? snapshot.data().revision ?? 0 : 0;
    if (revision!==expectedRevision) {
      const error=new Error('Dữ liệu đã được sửa từ thiết bị khác. Hãy tải bản mới trước khi lưu.');
      error.code='revision-conflict'; throw error;
    }
    transaction.set(ref,{...payload,revision:revision+1,updatedAt:serverTimestamp()});
    return revision+1;
  });
}
