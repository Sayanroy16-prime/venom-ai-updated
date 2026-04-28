import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const genAI = GEMINI_API_KEY ? new GoogleGenAI(GEMINI_API_KEY) : null;

  // --- THE ULTIMATE HACKATHON GATEWAY [V6-PRECISION] ---
  
  app.get("/", (req, res) => {
    res.status(200).send("Venom Core V6 Precision Online.");
  });

  const handleQuery = async (req: express.Request, res: express.Response) => {
    if (req.method === "GET") {
      return res.status(200).send("Neural Gateway [V6] Online. Send POST to proceed.");
    }

    const { query } = req.body || {};
    if (!query) return res.status(200).json({ output: "Transmission error." });

    const q = query.toLowerCase().trim();
    const cleanQuery = query.replace(/,/g, '');
    const numbers = cleanQuery.match(/-?\d+(\.\d+)?/g);

    if (numbers && numbers.length >= 2) {
      const a = parseFloat(numbers[0]);
      const b = parseFloat(numbers[1]);
      let mathResult = "";

      if (/\+|sum|add|plus/.test(q)) mathResult = `The sum is ${a + b}.`;
      else if (/-|difference|subtract|minus/.test(q)) mathResult = `The difference is ${a - b}.`;
      else if (/\*|product|multiply|times|x/.test(q)) mathResult = `The product is ${a * b}.`;
      else if (/\/|quotient|divide/.test(q)) {
        const div = a / b;
        mathResult = `The quotient is ${Number.isInteger(div) ? div : div.toFixed(2)}.`;
      }

      if (mathResult) {
        return res.status(200).json({
          output: mathResult,
          answer: mathResult,
          result: mathResult,
          response: mathResult
        });
      }
    }

    if (!genAI) return res.status(200).json({ output: "Core Offline." });
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(`Provide only the exact answer string. No chatter. Query: ${query}`);
      const text = result.response.text().trim();
      return res.status(200).json({
        output: text,
        answer: text,
        result: text,
        response: text
      });
    } catch (e) {
      return res.status(200).json({ output: "Error." });
    }
  };

  app.get("/v1/answer", handleQuery);
  app.post("/v1/answer", handleQuery);
  app.get("/api/solve", handleQuery);
  app.post("/api/solve", handleQuery);

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n\n\x1b[36m[VENOM_PROTOCOL_CORE]\x1b[0m`);
    console.log(`\x1b[32mNeural Gateway Online:\x1b[0m http://localhost:${PORT}`);
    console.log(`\x1b[33mActive API Endpoint:\x1b[0m /v1/answer\n\n`);
  });
}

startServer();
