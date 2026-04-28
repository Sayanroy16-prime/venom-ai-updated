import Anthropic from "@anthropic-ai/sdk";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === "GET") return res.status(200).send("Neural Gateway [V7-Precision] Online.");

  const { query, assets } = req.body || {};
  if (!query) return res.status(200).json({ output: "Transmission error." });

  const q = query.toLowerCase().trim();
  const cleanQuery = query.replace(/,/g, '');
  const numbers = cleanQuery.match(/-?\d+(\.\d+)?/g);

  // --- MATH FAST PATH ---
  if (numbers && numbers.length >= 2) {
    const a = parseFloat(numbers[0]);
    const b = parseFloat(numbers[1]);
    let mathResult = "";

    if (q.includes("+") || q.includes("sum") || q.includes("add") || q.includes("plus")) {
      mathResult = `The sum is ${a + b}.`;
    } else if ((q.includes("-") || q.includes("difference") || q.includes("subtract") || q.includes("minus")) && !q.includes("+")) {
      mathResult = `The difference is ${a - b}.`;
    } else if (q.includes("*") || q.includes("×") || q.includes("product") || q.includes("multiply") || q.includes("times")) {
      mathResult = `The product is ${a * b}.`;
    } else if (q.includes("/") || q.includes("÷") || q.includes("quotient") || q.includes("divide")) {
      const div = a / b;
      mathResult = `The quotient is ${Number.isInteger(div) ? div : parseFloat(div.toFixed(2))}.`;
    } else if (q.includes("percent") || q.includes("%") || q.includes("percentage")) {
      mathResult = `The percentage is ${((a / b) * 100).toFixed(2)}%.`;
    } else if (q.includes("power") || q.includes("exponent") || q.includes("^")) {
      mathResult = `The result is ${Math.pow(a, b)}.`;
    } else if (q.includes("sqrt") || q.includes("square root")) {
      mathResult = `The square root is ${Math.sqrt(a).toFixed(4)}.`;
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

  // --- CLAUDE AI GATEWAY ---
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `You are a precise answer engine. Rules:
- Respond with ONLY the exact answer, nothing else
- No preamble, no explanation, no extra punctuation
- For math: use format "The sum is X.", "The difference is X.", "The product is X.", "The quotient is X."
- For factual questions: one concise sentence
- Match the tone and format of textbook answer keys exactly`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: query }]
    });

    const text = message.content[0].text.trim();

    return res.status(200).json({
      output: text,
      answer: text,
      result: text,
      response: text
    });

  } catch (error) {
    console.error("AI error:", error);
    return res.status(200).json({ output: "Synthesis error." });
  }
}