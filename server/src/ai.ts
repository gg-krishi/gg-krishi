import Groq from "groq-sdk";
import * as fs from "fs";
import * as path from "path";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface AIVerificationResult {
    biochar_visible: boolean;
    gg_bag_visible: boolean;
    soil_visible: boolean;
    outdoor_environment: boolean;
    human_present: boolean;
    screen_capture_detected: boolean;
    confidence: number;
    flags: string[];
}

const SYSTEM_PROMPT = `You are a carbon credit field verification auditor for GG Krishi, a biochar carbon removal project.

Analyze the submitted field photo and determine if biochar has been genuinely applied to agricultural soil.

Check for:
1. Is black charcoal-like material (biochar) visible on or mixed into soil?
2. Is a GG-branded bag or any biochar bag visible in the frame?
3. Is this an outdoor agricultural environment (field, farm, open land)?
4. Is a human present in the image?
5. Is this a REAL 3D scene? Check for signs that this might be a photo of a phone/computer screen:
   - Moiré patterns (pixel grid interference)
   - Screen reflections or glare
   - Flat lighting with no depth variation
   - Visible screen bezels or borders

Return ONLY a JSON object with this exact structure, no markdown or extra text:
{
  "biochar_visible": true/false,
  "gg_bag_visible": true/false,
  "soil_visible": true/false,
  "outdoor_environment": true/false,
  "human_present": true/false,
  "screen_capture_detected": true/false,
  "confidence": 0.0 to 1.0,
  "flags": ["list", "of", "any", "concerns"]
}

Be strict. If anything looks suspicious, lower the confidence score and add to flags.`;

export async function analyzeImage({ buffer, mimeType }: { buffer: Buffer; mimeType: string }): Promise<AIVerificationResult> {
    const base64Image = buffer.toString("base64");

    try {
        const completion = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: SYSTEM_PROMPT },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                    ]
                }
            ],
            temperature: 0,
        });

        const text = completion.choices[0]?.message?.content || "";

        let jsonStr = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const parsed = JSON.parse(jsonStr.trim()) as AIVerificationResult;
        return parsed;
    } catch (err: any) {
        return {
            biochar_visible: false,
            gg_bag_visible: false,
            soil_visible: false,
            outdoor_environment: false,
            human_present: false,
            screen_capture_detected: false,
            confidence: 0,
            flags: ["AI_PARSE_ERROR", `Groq error or parsing failed: ${err.message}`],
        };
    }
}
