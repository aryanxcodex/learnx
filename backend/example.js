import { GoogleGenAI, Type } from "@google/genai";
import { configDotenv } from "dotenv";

configDotenv();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_KEY,
});

async function main() {
  const prompt = `
List 10 important React topics and their explanations.
Each item must include a unique "id", a "topic" string, and a "description".
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

  //   for await (const chunk of stream) {
  //     console.log(chunk.text);
  //   }

  let buffer = "";
  const seenObjects = new Set(); // Track entire objects to prevent duplicates

  for await (const chunk of stream) {
    const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
    buffer += text;

    // Process all complete objects in the buffer
    let start = buffer.indexOf("{");
    while (start !== -1) {
      let objEnd = -1;
      let depth = 0;

      // Find matching closing brace for current object
      for (let i = start; i < buffer.length; i++) {
        if (buffer[i] === "{") depth++;
        else if (buffer[i] === "}") depth--;

        if (depth === 0) {
          objEnd = i;
          break;
        }
      }

      // If complete object found
      if (objEnd !== -1) {
        const objStr = buffer.substring(start, objEnd + 1);
        buffer = buffer.substring(objEnd + 1); // Remove processed part

        try {
          const obj = JSON.parse(objStr);
          const objKey = JSON.stringify(obj); // Create unique string representation

          // Prevent duplicates using entire object content
          if (!seenObjects.has(objKey)) {
            seenObjects.add(objKey);
            console.log(obj);
          }
        } catch (error) {
          console.error("Error parsing object:", error);
        }

        // Check for next object
        start = buffer.indexOf("{");
      } else {
        // No complete object found, wait for more data
        break;
      }
    }
  }

  // Process any remaining complete objects after stream ends
  try {
    // Clean up the buffer by removing any leading/trailing whitespace or commas
    let cleanBuffer = buffer.trim();
    if (cleanBuffer.startsWith("[")) {
      cleanBuffer = cleanBuffer.slice(1);
    }
    if (cleanBuffer.endsWith("]")) {
      cleanBuffer = cleanBuffer.slice(0, -1);
    }
    cleanBuffer = cleanBuffer.trim();

    // Only proceed if we have actual content
    if (cleanBuffer.length > 0) {
      // Handle potential trailing comma
      if (cleanBuffer.endsWith(",")) {
        cleanBuffer = cleanBuffer.slice(0, -1);
      }

      // Split by complete objects (looking for },{ pattern)
      const objectStrings = cleanBuffer
        .split("},{")
        .map((str, index) => {
          // Add back the curly braces we lost in splitting
          if (index === 0) str = str + "}";
          else if (index === objectStrings.length - 1) str = "{" + str;
          else str = "{" + str + "}";
          return str.trim();
        })
        .filter((str) => str.length > 0);

      for (const objStr of objectStrings) {
        try {
          // Handle edge cases where we might have partial objects
          if (objStr.startsWith("{") && objStr.endsWith("}")) {
            const obj = JSON.parse(objStr);
            const objKey = JSON.stringify(obj);
            if (!seenObjects.has(objKey)) {
              seenObjects.add(objKey);
              console.log(obj);
            }
          }
        } catch (error) {
          console.error("Error parsing partial object:", error);
        }
      }
    }
  } catch (error) {
    console.error("Error processing remaining buffer:", error);
  }
}

main();
