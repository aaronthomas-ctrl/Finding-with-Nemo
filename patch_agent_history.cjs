const fs = require('fs');
let code = fs.readFileSync('server/agent.ts', 'utf8');

const historyReplacement = `
    const chatConfig = {
      model: "gemini-3.7-flash",
      config: {
        systemInstruction: "You are an AI Prospecting Co-Pilot for a B2B sales application. You help users find and save businesses to their pipeline CRM. You have access to tools for searching Google Places, saving companies, saving search zones. When saving a search zone, make sure to add descriptive tags like 'industrial area' or 'industrial city' if applicable. ALWAYS explicitly tell the user exactly what you saved to the pipeline and what zones you saved, so they know the action was completed.",
        tools: tools,
      }
    };
    
    // Pass history if available
    if (history && history.length > 0) {
      chatConfig.history = history;
    }

    const chat = ai.chats.create(chatConfig);

`;

code = code.replace(/const chat = ai\.chats\.create\(\{[\s\S]*?\}\);[\s\S]*?if \(history[\s\S]*?\}/m, historyReplacement);

fs.writeFileSync('server/agent.ts', code);
console.log("Patched agent.ts history and system instruction");
