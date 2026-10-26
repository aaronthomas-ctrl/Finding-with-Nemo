const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Hello",
    });
    console.log("Success with gemini-1.5-flash", res.text);
  } catch (e) {
    console.error("Error with gemini-1.5-flash", e.message);
  }
}
run();
