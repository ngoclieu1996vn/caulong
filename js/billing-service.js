import { watchDayDocument, saveDayDocument } from './day-document-service.js';
export const watchBilling=(date,onData,onError)=>watchDayDocument('billing',date,onData,onError);
export const saveBilling=(date,payload,expectedRevision)=>saveDayDocument('billing',date,payload,expectedRevision);
