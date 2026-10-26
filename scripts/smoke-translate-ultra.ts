import 'dotenv/config';
import { chatJson } from '../server/llm';
const notes: Record<string, string> = {
  Malayalam: 'ഇന്ന് ഗ്രീൻ സ്പ്രൗട്ട് കഫേയുടെ ഉടമയെ കണ്ടു. ജനുവരിയിൽ രണ്ടാമത്തെ ശാഖ തുറക്കാൻ അവർ പദ്ധതിയിടുന്നു, 2026 ഒക്ടോബർ 30 വെള്ളിയാഴ്ചയ്ക്കകം ഓട്ട് മിൽക്കിന്റെ ക്വട്ടേഷൻ വേണം.',
  Urdu: 'آج گرین سپراؤٹ کیفے کے مالک سے ملاقات ہوئی۔ وہ جنوری میں دوسری شاخ کھول رہے ہیں اور جمعہ 30 اکتوبر 2026 تک اوٹ ملک کا کوٹیشن چاہتے ہیں۔',
};
for (const role of ['super', 'ultra'] as const) for (const [l, t] of Object.entries(notes)) {
  const t0 = Date.now();
  const o = await chatJson<any>({ role, thinking: false, maxTokens: 800, messages: [
    { role: 'system', content: 'Translate the spoken note into English. Spoken notes are transliterated loanwords often (product names, brands, English terms written in the local script): translate them to the English term, do not translate them by sound-alike. Return JSON {"language":"iso code","english":"..."}.' },
    { role: 'user', content: t }] });
  console.log(role, l, `${Date.now() - t0}ms`, '->', o.english);
}
