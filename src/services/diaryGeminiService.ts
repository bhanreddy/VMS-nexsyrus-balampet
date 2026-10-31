import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { DiaryGeminiShare } from '../../modules/diary-gemini-share';

export const GEMINI_WEBSITE = 'https://gemini.google.com/app';
export const GEMINI_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard';
export const DIARY_TELUGU_PROMPT = `ఈ డైరీ ఫోటోలో స్పష్టంగా కనిపిస్తున్న పాఠాలు, హోంవర్క్ మరియు ఉపాధ్యాయుల సూచనలను చదివి, తల్లిదండ్రులు తమ పిల్లలకు సహాయం చేయగలిగేలా సులభమైన తెలుగులో వివరించండి.

1. ముందుగా ఫోటోలో ఉన్న విషయాలను విషయాల వారీగా సంక్షిప్తంగా చెప్పండి.
2. ప్రతి హోంవర్క్‌లో ఏమి చేయాలి, ఎలా చేయాలి అనేది దశలవారీగా వివరించండి. అవసరమైతే చిన్న ఉదాహరణ ఇవ్వండి.
3. ఫోటోలో ఉన్న పేజీ నంబర్లు, ప్రశ్నల నంబర్లు, తేదీలు మరియు గడువులను ఉన్నట్లుగానే చెప్పండి.
4. ముఖ్యమైన ఆంగ్ల పదాలకు తెలుగు అర్థం చెప్పండి.
5. స్పష్టంగా చదవలేని పదాలు లేదా కనిపించని పాఠ్యపుస్తక ప్రశ్నలను ఊహించవద్దు. ఏ భాగానికి మరింత స్పష్టమైన ఫోటో లేదా పాఠ్యపుస్తక పేజీ కావాలో చెప్పండి.

జవాబును స్పష్టమైన శీర్షికలు, చిన్న వాక్యాలు మరియు పిల్లలకు అర్థమయ్యే భాషలో ఇవ్వండి.`;

export async function copyDiaryGeminiQuestion(prompt: string) {
  if (!prompt.trim()) throw new Error('Please enter a question for Gemini.');
  const copied = await Clipboard.setStringAsync(prompt.trim());
  if (!copied) throw new Error('Could not copy the question. Select and copy the question below.');
}

export function openGeminiWebsite() {
  // There is no documented attachment URL. Keep the photo and question out of URLs.
  return Linking.openURL(GEMINI_WEBSITE);
}

export async function askGeminiWithDiaryPhoto(uri: string, prompt: string, signal?: AbortSignal): Promise<'opened' | 'share-menu' | 'manual'> {
  const checkCancelled = () => { if (signal?.aborted) throw new Error('Opening Gemini was cancelled.'); };
  checkCancelled();
  await copyDiaryGeminiQuestion(prompt);
  checkCancelled();
  if (Platform.OS === 'web') return 'manual';
  // A real JPEG file works with Android's content provider and iOS share extensions.
  const image = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: .94 });
  checkCancelled();
  if (Platform.OS === 'android' && DiaryGeminiShare.isSupported) {
    const contentUri = await FileSystem.getContentUriAsync(image.uri);
    checkCancelled();
    if (await DiaryGeminiShare.shareImage(contentUri, prompt.trim()) === 'opened') return 'opened';
  }
  if (!(await Sharing.isAvailableAsync())) return 'manual';
  checkCancelled();
  await Sharing.shareAsync(image.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Choose Gemini, then paste the copied Telugu question' });
  return 'share-menu';
}
