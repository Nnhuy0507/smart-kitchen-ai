import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';

export async function uploadScanImage(url: string, uri: string, options: Pick<RequestInit, 'headers' | 'signal'>) {
  const file = new File(uri);
  const body = new FormData();
  body.append('file', file, file.name);
  return fetch(url, { method: 'POST', body, ...options });
}
