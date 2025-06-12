import express from "express";
const router = express.Router();
import { GoogleGenAI, Type } from "@google/genai";
import { configDotenv } from "dotenv";

configDotenv();

router.get("/", async (req, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_KEY,
  });

  const prompt = `
  List 10 important React topics and their explanations.
  Each item must include a unique "id", a "topic" string, and a "description".
  Keep the description a one liner.
  Only return a JSON array of objects — no extra text.
  `;

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.0-flash",
    contents: prompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            topic: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          propertyOrdering: ["id", "topic", "description"],
        },
      },
    },
  });

  let buffer = "";
  const seenObjects = new Set();

  try {
    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
      buffer += text;

      let start = buffer.indexOf("{");
      while (start !== -1) {
        let objEnd = -1;
        let depth = 0;

        for (let i = start; i < buffer.length; i++) {
          if (buffer[i] === "{") depth++;
          else if (buffer[i] === "}") depth--;

          if (depth === 0) {
            objEnd = i;
            break;
          }
        }

        if (objEnd !== -1) {
          const objStr = buffer.substring(start, objEnd + 1);
          buffer = buffer.substring(objEnd + 1);

          try {
            const obj = JSON.parse(objStr);
            const objKey = JSON.stringify(obj);

            if (!seenObjects.has(objKey)) {
              seenObjects.add(objKey);
              res.write(`data: ${JSON.stringify(obj)}\n\n`);
            }
          } catch (err) {
            // Incomplete or malformed JSON — skip
          }

          start = buffer.indexOf("{");
        } else {
          break;
        }
      }
    }

    // Stream ended — close connection
    res.write("event: end\ndata: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Streaming error:", err);
    res.write("event: error\ndata: Internal server error\n\n");
    res.end();
  }
});

export default router;
