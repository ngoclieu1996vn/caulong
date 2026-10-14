import { collection, query, where, onSnapshot, doc, setDoc, getDocFromServer, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { db } from './firebase.js';
import { getMember } from './members.js';
import { isValidDateKey, normalizeGuestName } from './utils.js';

function assertDate(date) {
  if (!isValidDateKey(date)) throw new Error('Ngày check-in không hợp lệ.');
}
export function watchCheckins(filter, onData, onError) {
  const source = collection(db, 'checkins');
  let constraints;
  if (filter.date) {
    assertDate(filter.date);
    constraints = [where('date', '==', filter.date)];
  } else {
    assertDate(filter.start);
    if (typeof filter.end !== 'string' || filter.end <= filter.start) throw new Error('Khoảng ngày không hợp lệ.');
    constraints = [where('date', '>=', filter.start), where('date', '<', filter.end)];
  }
  // Keep a previously confirmed document visible while a duplicate write is pending.
  const confirmed = new Map();
  return onSnapshot(query(source, ...constraints), { includeMetadataChanges: true }, snapshot => {
    const present = new Set(snapshot.docs.map(item => item.id));
    for (const id of confirmed.keys()) if (!present.has(id)) confirmed.delete(id);
    for (const item of snapshot.docs) {
      const value = item.data();
      if (!item.metadata.hasPendingWrites && typeof value.checkedInAt?.toMillis === 'function') {
        confirmed.set(item.id, { ...value, id: item.id });
      }
    }
    const records = [...confirmed.values()].sort((a, b) => a.checkedInAt.toMillis() - b.checkedInAt.toMillis() || a.id.localeCompare(b.id));
    onData({ records, fromCache: snapshot.metadata.fromCache, hasPendingWrites: snapshot.metadata.hasPendingWrites });
  }, onError);
}
export async function checkInMember(date, memberId) {
  assertDate(date);
  const member = getMember(memberId);
  if (!member) throw new Error('Thành viên không hợp lệ.');
  const ref = doc(db, 'checkins', `${date}_${memberId}`);
  try {
    await setDoc(ref, { date, memberId, name: member.name, type: 'member', checkedInAt: serverTimestamp() });
    return { alreadyExists: false };
  } catch (error) {
    if (error.code === 'permission-denied') {
      // A failed write alone does not prove a duplicate: Rules might not be installed.
      try {
        const existing = await getDocFromServer(ref);
        if (existing.exists() && existing.data().type === 'member' && existing.data().memberId === memberId && existing.data().date === date) {
          return { alreadyExists: true };
        }
      } catch { /* Preserve the original write error. */ }
    }
    throw error;
  }
}
export async function checkInGuest(date, input) {
  assertDate(date);
  const name = normalizeGuestName(input);
  const ref = doc(collection(db, 'checkins'));
  await setDoc(ref, { date, memberId: null, name, type: 'guest', checkedInAt: serverTimestamp() });
}
export function checkinErrorMessage(error) {
  if (error?.code === 'permission-denied') return 'Firebase chưa cho phép thao tác này. Vui lòng kiểm tra Firestore Rules.';
  if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') return 'Chưa kết nối được Firebase. Kiểm tra mạng rồi thử lại.';
  if (error?.code === 'failed-precondition') return 'Firestore chưa sẵn sàng. Vui lòng kiểm tra cấu hình trong Firebase Console.';
  return error?.code ? 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.' : (error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
}
