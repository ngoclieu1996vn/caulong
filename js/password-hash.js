import md5 from './vendor/md5.js';

// Legacy MD5 format requested for the UI gate; this is not server authorization.
export function passwordMd5(value){
  return md5(new TextEncoder().encode(value)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
