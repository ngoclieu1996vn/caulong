import { getMember, GUEST_AVATAR } from './members.js';

export function buildParticipants(records) {
  return records.map(record => {
    const member = record.type === 'member' ? getMember(record.memberId) : null;
    const stamp = record.checkedInAt;
    const version = Number.isInteger(stamp?.seconds) && Number.isInteger(stamp?.nanoseconds)
      ? `${stamp.seconds}:${stamp.nanoseconds}` : `ms:${stamp?.toMillis?.() ?? 'unknown'}`;
    const gender = member?.gender ?? record.gender;
    return { id: record.id, version, name: record.name, memberId: record.memberId ?? null,
      type: record.type, gender: ['Nam', 'Nữ'].includes(gender) ? gender : null,
      avatar: member?.avatar || GUEST_AVATAR };
  });
}

export function rosterFingerprint(participants, { includeGender = false } = {}) {
  return JSON.stringify(participants.map(p => includeGender ? [p.id, p.version, p.gender] : [p.id, p.version])
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
