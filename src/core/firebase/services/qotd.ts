import { commitWrites, getDocument, serverNow, serverTimestamp, setWrite } from '@/src/core/firebase/firestoreRest';

export type QotdDifficulty = 'easy' | 'medium' | 'hard';
export interface QotdOption { id: string; content: string }
export interface QotdCategory { id: string; name: string; color: string }
export interface QotdQuestion {
  id: string; dateKey: string; showingDate?: string; courseId: string; courseName: string; subcourseId: string; subcourseName: string;
  content: string; options: QotdOption[]; correctOptionId: string; explanation: string;
  correctGreeting?: string; wrongGreeting?: string; difficulty: QotdDifficulty; categories: QotdCategory[];
  version: number; isPublished: boolean;
}
export interface QotdSnapshot extends Omit<QotdQuestion, 'isPublished'> {}
export interface QotdResult { dateKey: string; courseId: string; subcourseId: string; selectedOptionId: string; isCorrect: boolean; answeredAt?: unknown; snapshot: QotdSnapshot }
export interface QotdSummary { totalAttempts: number; correct: number; averagePercent: number }
export interface QotdDay { dateKey: string; courseId: string; subcourseId: string; question: QotdQuestion | null; result: QotdResult | null; summary: QotdSummary }

const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' });
export function getKathmanduDateKey(date = serverNow()): string { const p=Object.fromEntries(formatter.formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`; }
export function getKathmanduMidnightDelay(): number { const now=serverNow();let probe=new Date(now.getTime()+20*60*60*1000);while(getKathmanduDateKey(probe)===getKathmanduDateKey(now))probe=new Date(probe.getTime()+60_000);while(getKathmanduDateKey(new Date(probe.getTime()-60_000))!==getKathmanduDateKey(now))probe=new Date(probe.getTime()-60_000);return Math.max(1_000,probe.getTime()-now.getTime()+1_500); }
const resultPath=(uid:string,key:string)=>`users/${uid}/questionofdata/${key}`;
const summaryPath=(uid:string)=>`users/${uid}/questionofdata/summary`;
export const qotdDocumentId=(key:string,courseId:string,subcourseId:string)=>`${key}__${courseId}__${subcourseId}`;
function normalizeQuestion(raw:Record<string,unknown>,fallbackId:string,greetings:Record<string,unknown>|null):QotdQuestion{
 const opts=Array.isArray(raw.options)?raw.options:[];const snapshots=Array.isArray(raw.categorySnapshots)?raw.categorySnapshots:[];const names=Array.isArray(raw.categoryNames)?raw.categoryNames.map(String):[];const ids=Array.isArray(raw.categoryIds)?raw.categoryIds.map(String):[];
 const categories:QotdCategory[]=(snapshots.length?snapshots:names.map((name,i)=>({id:ids[i]??name,name,color:'#2563EB'}))).map((c:any,i)=>({id:String(c?.id??ids[i]??`category-${i}`),name:String(c?.name??names[i]??''),color:String(c?.color??'#2563EB')}));
 return {id:String(raw.id??fallbackId),dateKey:String(raw.dateKey??getKathmanduDateKey()),showingDate:String(raw.showingDate??''),courseId:String(raw.courseId??''),courseName:String(raw.courseName??raw.courseId??''),subcourseId:String(raw.subcourseId??''),subcourseName:String(raw.subcourseName??raw.subcourseId??''),content:String(raw.content??''),options:opts.map((o:any,i)=>({id:String(o?.id??'ABCD'[i]),content:String(o?.content??o??'')})).slice(0,4),correctOptionId:String(raw.correctOptionId??'A'),explanation:String(raw.explanation??''),correctGreeting:String(greetings?.correctGreeting??raw.correctGreeting??''),wrongGreeting:String(greetings?.wrongGreeting??raw.wrongGreeting??''),difficulty:(['easy','medium','hard'].includes(String(raw.difficulty))?raw.difficulty:'medium') as QotdDifficulty,categories,version:Number(raw.version??1),isPublished:raw.isPublished!==false};
}
const normalizeSummary=(raw:Record<string,unknown>|null):QotdSummary=>({totalAttempts:Number(raw?.totalAttempts??0),correct:Number(raw?.correct??0),averagePercent:Number(raw?.averagePercent??0)});
const contentFingerprint=(question:QotdQuestion)=>{const source=`${question.content}|${question.options.map(o=>`${o.id}:${o.content}`).join('|')}|${question.correctOptionId}`;let hash=2166136261;for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)};
export const qotdAttemptId=(question:QotdQuestion)=>`${question.dateKey}__${question.courseId}__${question.subcourseId}__v${question.version}__${contentFingerprint(question)}`;
export async function fetchQotdDay(uid:string,courseId:string,subcourseId:string,key=getKathmanduDateKey()):Promise<QotdDay>{
 if(!courseId||!subcourseId)return{dateKey:key,courseId,subcourseId,question:null,result:null,summary:{totalAttempts:0,correct:0,averagePercent:0}};
 const docId=qotdDocumentId(key,courseId,subcourseId);const [q,s,g]=await Promise.all([getDocument(`app_qotd_daily/${docId}`).catch(()=>null),getDocument(summaryPath(uid)),getDocument('meta/qotd_greetings').catch(()=>null)]);const summary=normalizeSummary(s);
 if(!q||q.isPublished===false)return{dateKey:key,courseId,subcourseId,question:null,result:null,summary};
 const question=normalizeQuestion(q,docId,g);let r=await getDocument(resultPath(uid,qotdAttemptId(question))).catch(()=>null);
 if(!r){const legacy=await getDocument(resultPath(uid,key)).catch(()=>null);const snapshot=legacy?.snapshot as Record<string,unknown>|undefined;if(legacy&&String(snapshot?.id??'')===question.id&&Number(snapshot?.version??0)===question.version)r=legacy;}
 const resultRaw=r as unknown as QotdResult|null;const result=resultRaw?.snapshot?{...resultRaw,snapshot:{...resultRaw.snapshot,correctGreeting:String(g?.correctGreeting??resultRaw.snapshot.correctGreeting??''),wrongGreeting:String(g?.wrongGreeting??resultRaw.snapshot.wrongGreeting??'')}}:null;
 return{dateKey:key,courseId,subcourseId,question,result,summary};
}
export async function hasAnsweredQotdToday(uid:string):Promise<boolean>{return!!(await getDocument(resultPath(uid,getKathmanduDateKey())))}
export async function submitQotdAnswer(uid:string,question:QotdQuestion,selectedOptionId:string,prior:QotdSummary):Promise<{result:QotdResult;summary:QotdSummary}>{
 const key=getKathmanduDateKey();if(question.dateKey!==key)throw new Error('This daily question has expired. Please load today’s question.');const path=resultPath(uid,qotdAttemptId(question));const existing=await getDocument(path);if(existing)return{result:existing as unknown as QotdResult,summary:prior};const isCorrect=selectedOptionId===question.correctOptionId;const{isPublished:_omit,...snapshot}=question;const result:QotdResult={dateKey:key,courseId:question.courseId,subcourseId:question.subcourseId,selectedOptionId,isCorrect,answeredAt:serverTimestamp(),snapshot};const totalAttempts=prior.totalAttempts+1,correct=prior.correct+(isCorrect?1:0);const summary={totalAttempts,correct,averagePercent:Math.round(correct*10000/totalAttempts)/100};await commitWrites([setWrite(path,result as unknown as Record<string,unknown>),setWrite(summaryPath(uid),{...summary,updatedAt:serverTimestamp()},{merge:true})]);return{result,summary};
}
