import {doc,setDoc} from 'firebase/firestore';
import {createHash} from 'node:crypto';
export const seedAdminPassword=env=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'settings/admin'),{
  passwordMd5:createHash('md5').update('test-only-password').digest('hex')
}));
