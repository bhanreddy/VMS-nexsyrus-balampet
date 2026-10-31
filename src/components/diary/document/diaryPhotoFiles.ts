import { Platform } from 'react-native';

export async function persistDiaryScan(dataUri: string): Promise<string> {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUri)) throw new Error('The edited photo is invalid. Please try again.');
  if (Platform.OS === 'web') return dataUri;
  const fs = await import('expo-file-system/legacy');
  if (!fs.documentDirectory) throw new Error('Photo storage is unavailable. Please try again.');
  // Keep queued scans across restarts and cache eviction until they are uploaded.
  const directory = `${fs.documentDirectory}diary-scans/`;
  await fs.makeDirectoryAsync(directory, { intermediates: true });
  const uri = `${directory}scan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.jpg`;
  await fs.writeAsStringAsync(uri, dataUri.split(',')[1], { encoding: fs.EncodingType.Base64 });
  return uri;
}

export async function diaryPhotoDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:image/')) return uri;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Photo could not be downloaded. Check your connection and retry.');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Photo could not be read.'));
      reader.readAsDataURL(blob);
    });
  }
  const fs = await import('expo-file-system/legacy');
  let local = uri;
  if (/^https?:/.test(uri)) {
    const result = await fs.downloadAsync(uri, `${fs.cacheDirectory}diary-share-${Date.now()}.jpg`);
    if (result.status !== 200) throw new Error('Photo could not be downloaded. Please retry.');
    local = result.uri;
  }
  const data = await fs.readAsStringAsync(local, { encoding: fs.EncodingType.Base64 });
  const mime = /\.png(?:\?|$)/i.test(uri) ? 'image/png' : /\.webp(?:\?|$)/i.test(uri) ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${data}`;
}

export async function shareDiaryPhoto(uri: string) {
  const data = await diaryPhotoDataUri(uri);
  if (Platform.OS === 'web') {
    const anchor = document.createElement('a');
    anchor.href = data;
    anchor.download = `diary-photo-${Date.now()}.${data.startsWith('data:image/png') ? 'png' : data.startsWith('data:image/webp') ? 'webp' : 'jpg'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  const fs = await import('expo-file-system/legacy');
  const sharing = await import('expo-sharing');
  if (!(await sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  const mime = data.slice(5, data.indexOf(';'));
  const path = `${fs.cacheDirectory}diary-photo-${Date.now()}.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`;
  await fs.writeAsStringAsync(path, data.split(',')[1], { encoding: fs.EncodingType.Base64 });
  await sharing.shareAsync(path, { mimeType: mime, dialogTitle: 'Save or share diary photo' });
}

export async function shareDiaryPdf(photos: string[]) {
  // Sequential reads limit peak memory on phones with several high resolution pages.
  const pages: string[] = [];
  for (const photo of photos) pages.push(await diaryPhotoDataUri(photo));
  if (Platform.OS === 'web') {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    pages.forEach((page, index) => {
      if (index) pdf.addPage();
      const image = pdf.getImageProperties(page);
      const scale = Math.min(190 / image.width, 277 / image.height);
      const width = image.width * scale, height = image.height * scale;
      pdf.addImage(page, image.fileType, (210 - width) / 2, (297 - height) / 2, width, height);
    });
    pdf.save('diary-pages.pdf');
    return;
  }
  const print = await import('expo-print');
  const sharing = await import('expo-sharing');
  if (!(await sharing.isAvailableAsync())) throw new Error('Sharing is unavailable on this device.');
  // Only generated data URIs enter this document; no diary text or remote HTML.
  const html = `<html><head><meta charset="utf-8"><style>@page{size:A4;margin:24pt}body{margin:0}.page{page-break-after:always;page-break-inside:avoid;height:250mm;display:flex;align-items:center;justify-content:center}.page:last-child{page-break-after:auto}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body>${pages.map((page) => `<div class="page"><img src="${page.replace(/"/g, '&quot;')}" /></div>`).join('')}</body></html>`;
  const result = await print.printToFileAsync({ html, width: 595, height: 842 });
  await sharing.shareAsync(result.uri, { mimeType: 'application/pdf', dialogTitle: 'Save or share diary pages' });
}
