const fs = require('fs');
let code = fs.readFileSync('server/agent.ts', 'utf8');

code = code.replace(
  `} catch (error: any) {`,
  `} catch (error: any) {\n    const isQuotaError = error?.status === 429 || error?.message?.includes("depleted") || error?.status === "RESOURCE_EXHAUSTED" || error?.message?.includes("quota");\n    if (isQuotaError) {\n      console.warn("Agent quota exceeded.");\n      return res.status(500).json({ error: "AI Assistant is currently unavailable (API quota exceeded). Please try again later." });\n    }`
);

fs.writeFileSync('server/agent.ts', code);
console.log("Patched agent.ts");
