// Upload to the application backend, which starts the local ConvNeXt service.
import { uploadScanImage } from './uploadScanImage';
import {getApiBaseUrl} from './api';
import {getAuthUser} from './auth';
export type Detection={name:string;count:number;confidence:number|null};
export function normalizeDetections(value:unknown):Detection[]{
 if(!Array.isArray(value))return [];
 return value.filter((item):item is Record<string,unknown>=>!!item&&typeof item==='object'&&typeof item.name==='string'&&!!item.name.trim()).map(item=>({name:(item.name as string).trim(),count:typeof item.count==='number'&&Number.isInteger(item.count)&&item.count>0?item.count:1,confidence:typeof item.confidence==='number'&&Number.isFinite(item.confidence)&&item.confidence>=0&&item.confidence<=1?item.confidence:null}));
}
export async function analyzePhoto(uri: string, signal: AbortSignal) {
  const user = await getAuthUser();
  const token = user?.token || user?.sessionToken;
  if (!token) throw new Error('Vui lòng đăng nhập lại để quét thực phẩm.');
  const response = await uploadScanImage(getApiBaseUrl() + "/api/scan", uri, {
    signal,
    headers: { Authorization: "Bearer " + token },
  });
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.success||!Array.isArray(result.detections))throw new Error(typeof result?.detail==='string'?result.detail:result?.message||'Model chưa trả về kết quả hợp lệ.');
 return normalizeDetections(result.detections);
}
