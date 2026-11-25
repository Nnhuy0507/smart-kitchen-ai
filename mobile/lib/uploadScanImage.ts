// Browser implementation; Metro selects .native.ts on iOS and Android.
export async function uploadScanImage(url: string, uri: string, options: Pick<RequestInit, 'headers' | 'signal'>) {
  const imageResponse = await fetch(uri, { signal: options.signal });
  const blob = await imageResponse.blob();
  const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const body = new FormData();
  body.append('file', blob, `scan.${extension}`);
  return fetch(url, { method: 'POST', body, ...options });
}
