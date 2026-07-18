import { db } from './firebaseClient';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import LZString from 'lz-string';

export const shareReport = async (htmlContent: string): Promise<string> => {
  const compressedHtml = LZString.compressToBase64(htmlContent);
  const reportsCollection = collection(db, 'shared_reports');
  const docRef = await addDoc(reportsCollection, {
    content: compressedHtml,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};

export const getSharedReport = async (id: string): Promise<string | null> => {
  const docRef = doc(db, 'shared_reports', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    if (data.content) {
      return LZString.decompressFromBase64(data.content);
    }
  }
  return null;
};
