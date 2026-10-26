import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Hello"
    });
    console.log("Success 3.6:", res.text);
  } catch (err) {
    console.error("Error 3.6:", err);
  }
}
run();
