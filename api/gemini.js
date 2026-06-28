const GEMINI_MODEL = "gemini-2.5-flash";

function extractJsonFromText(text) {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return valid JSON");
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: "Missing GEMINI_API_KEY on deployment server" });
  }

  try {
    const { prompt, image } = request.body || {};
    if (!prompt || !image?.base64 || !image?.mimeType) {
      return response.status(400).json({ error: "Missing prompt or image data" });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: image.mimeType, data: image.base64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text();
      return response.status(geminiResponse.status).json({
        error: "Gemini request failed",
        detail: detail.slice(0, 500)
      });
    }

    const data = await geminiResponse.json();
    const text = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
    return response.status(200).json({ result: extractJsonFromText(text) });
  } catch (error) {
    return response.status(500).json({ error: error.message || "AI recognition failed" });
  }
}
