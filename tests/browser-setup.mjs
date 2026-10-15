import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {seedAdminPassword} from './admin-fixture.mjs';
export default async function(){
  if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')return;
  const env=await initializeTestEnvironment({projectId:'demo-calendar-checkin',firestore:{host:'127.0.0.1',port:8080}});
  try{await seedAdminPassword(env);}finally{await env.cleanup();}
}
