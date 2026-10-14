import {watchDayDocument,saveDayDocument} from './day-document-service.js';
export const watchTeamGame=(date,onData,onError)=>watchDayDocument('teamGames',date,onData,onError);
export const saveTeamGame=(date,payload,expectedRevision)=>saveDayDocument('teamGames',date,payload,expectedRevision);
