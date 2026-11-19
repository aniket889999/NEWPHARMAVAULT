import { create } from 'zustand';

/**
 * Lightweight i18n: the English text is the key, so untranslated strings fall back to English.
 * Hindi strings are a first draft and need review by a native speaker before launch.
 */
export type Language = 'en' | 'hi';

const STORAGE_KEY = 'pv_language';
const readStored = (): Language => {
  try { return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
};

interface LanguageState { language: Language; setLanguage: (language: Language) => void }

export const useLanguageStore = create<LanguageState>((set) => ({
  language: readStored(),
  setLanguage: (language) => {
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* storage may be unavailable */ }
    if (typeof document !== 'undefined') document.documentElement.lang = language;
    set({ language });
  }
}));

const HI: Record<string, string> = {
  // Shared
  'Cancel': 'रद्द करें',
  'Confirm': 'पुष्टि करें',
  'Language': 'भाषा',
  // Claims (claimant)
  'Insurance Claims': 'बीमा दावे',
  'Submit Claim': 'दावा जमा करें',
  'Submit Insurance Claim': 'बीमा दावा जमा करें',
  'Total Claims': 'कुल दावे',
  'Needs Your Answer': 'आपके जवाब की ज़रूरत',
  'My Claims': 'मेरे दावे',
  'No claims yet.': 'अभी कोई दावा नहीं है।',
  'Insurer Questions': 'बीमा कंपनी के प्रश्न',
  'No questions from the insurer.': 'बीमा कंपनी की ओर से कोई प्रश्न नहीं।',
  'Type your answer': 'अपना जवाब लिखें',
  'Send Answer': 'जवाब भेजें',
  'Timeline': 'समय-रेखा',
  'Withdraw Claim': 'दावा वापस लें',
  'Withdraw this claim?': 'क्या यह दावा वापस लेना है?',
  'Appeal Decision': 'निर्णय के विरुद्ध अपील',
  "Appeal the insurer's decision": 'बीमा कंपनी के निर्णय के विरुद्ध अपील करें',
  'You can appeal once. A different reviewer at the insurer will look at the claim again.': 'आप एक बार अपील कर सकते हैं। बीमा कंपनी का कोई दूसरा समीक्षक दावे को फिर से देखेगा।',
  'Send Appeal': 'अपील भेजें',
  'Verified Case *': 'सत्यापित केस *',
  'Insurer *': 'बीमा कंपनी *',
  'Claimed Amount (₹) *': 'दावा राशि (₹) *',
  'Policy Number *': 'पॉलिसी नंबर *',
  'The selected insurer will be able to view, for 90 days and only for this claim:': 'चुनी गई बीमा कंपनी 90 दिनों तक और केवल इस दावे के लिए यह देख सकेगी:',
  'You can withdraw the claim and revoke access before a decision is made.': 'निर्णय होने से पहले आप दावा वापस लेकर अनुमति हटा सकते हैं।',
  'I agree to share this case with the selected insurer.': 'मैं यह केस चुनी गई बीमा कंपनी के साथ साझा करने के लिए सहमत हूँ।',
  'Verified pharmacy bill': 'सत्यापित फ़ार्मेसी बिल',
  'you can claim up to this amount': 'आप इतनी राशि तक दावा कर सकते हैं',
  'you can claim up to': 'आप इतने तक दावा कर सकते हैं',
  'already approved': 'पहले से स्वीकृत',
  'already claimed': 'पहले ही दावा किया गया',
  'claim open': 'दावा खुला है',
  'All your verified cases are already claimed or have an open claim.': 'आपके सभी सत्यापित केस पर पहले ही दावा हो चुका है या दावा खुला है।',
  'Accept Decision': 'निर्णय स्वीकार करें',
  'Accept the partial approval?': 'आंशिक स्वीकृति स्वीकार करें?',
  'Decision accepted. The insurer can now settle the claim.': 'निर्णय स्वीकार किया गया। बीमाकर्ता अब दावे का निपटान कर सकता है।',
  'You can appeal until': 'आप इस तारीख तक अपील कर सकते हैं:',
  'The insurer settles the approved amount after you accept or this date passes.': 'आपके स्वीकार करने या यह तारीख बीतने के बाद बीमाकर्ता स्वीकृत राशि का निपटान करता है।',
  'You accepted this decision on': 'आपने यह निर्णय स्वीकार किया:',
  'Prescription, invoice and claim-form documents of this case': 'इस केस के पर्चे, बिल और दावा-फ़ॉर्म दस्तावेज़',
  'Extracted medicine fields, consistency checks and risk signals': 'निकाली गई दवा जानकारी, मिलान जाँच और जोखिम संकेत',
  'Pharmacist review decisions on this case': 'इस केस पर फ़ार्मासिस्ट के निर्णय',
  'Submitted': 'जमा किया गया',
  'Under insurer review': 'बीमा कंपनी समीक्षा कर रही है',
  'Query raised': 'प्रश्न पूछा गया',
  'Approved': 'स्वीकृत',
  'Partially approved': 'आंशिक रूप से स्वीकृत',
  'Not approved': 'स्वीकृत नहीं',
  'Settled (demo)': 'भुगतान हुआ (डेमो)',
  'Withdrawn': 'वापस लिया गया',
  'Appealed': 'अपील की गई',
  'Please accept the data-sharing consent.': 'कृपया डेटा साझा करने की सहमति स्वीकार करें।',
  'Answer sent to the insurer': 'जवाब बीमा कंपनी को भेजा गया',
  'Claim withdrawn and consent revoked': 'दावा वापस लिया गया और सहमति हटा दी गई',
  'Appeal sent. A different insurer reviewer will decide it.': 'अपील भेजी गई। बीमा कंपनी का दूसरा समीक्षक इसका निर्णय करेगा।',
  // Security & data
  'Account Security': 'खाता सुरक्षा',
  'Set Up Authenticator App': 'ऑथेंटिकेटर ऐप सेट करें',
  'Turn On': 'चालू करें',
  'Turn Off': 'बंद करें',
  'Your Data': 'आपका डेटा',
  'Download My Data (readable)': 'मेरा डेटा डाउनलोड करें (पढ़ने योग्य)',
  'Full copy (JSON)': 'पूरी कॉपी (JSON)',
  'Request Deletion': 'डेटा हटाने का अनुरोध',
  'Cancel Request': 'अनुरोध रद्द करें',
  'Send Deletion Request': 'हटाने का अनुरोध भेजें',
  'Save your recovery codes': 'अपने रिकवरी कोड सहेजें',
  'I have saved them': 'मैंने सहेज लिए हैं',
  'Text alerts': 'SMS / WhatsApp सूचना',
  'Get an SMS or WhatsApp message when your insurer asks a question or decides your claim. The message only says that something changed — no medicine or claim details.': 'जब बीमा कंपनी कोई प्रश्न पूछे या आपके दावे पर निर्णय करे, तो SMS या WhatsApp संदेश पाएँ। संदेश में केवल यह बताया जाता है कि कुछ बदला है — दवा या दावे का विवरण नहीं।',
  'Mobile number': 'मोबाइल नंबर',
  'Send by': 'कैसे भेजें'
};

const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, hi: HI };

/** Returns t(text): the translation for the current language, or the English text. */
export function useT() {
  const language = useLanguageStore((s) => s.language);
  return (text: string) => DICTIONARIES[language][text] ?? text;
}
