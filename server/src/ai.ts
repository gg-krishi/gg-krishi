import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

export async function analyzeImage(imagePath: string): Promise<AIVerificationResult> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine mime type from extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType =
        ext === ".png" ? "image/png" :
            ext === ".webp" ? "image/webp" :
                "image/jpeg";

    const imagePart: Part = {
        inlineData: {
            mimeType,
            data: base64Image,
        },
    };

    const result = await model.generateContent([SYSTEM_PROMPT, imagePart]);
    const response = result.response;
    const text = response.text();

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }

    try {
        const parsed = JSON.parse(jsonStr.trim()) as AIVerificationResult;
        return parsed;
    } catch {
        // If parsing fails, return a low-confidence result
        return {
            biochar_visible: false,
            gg_bag_visible: false,
            soil_visible: false,
            outdoor_environment: false,
            human_present: false,
            screen_capture_detected: false,
            confidence: 0,
            flags: ["AI_PARSE_ERROR", `Raw response: ${text.substring(0, 200)}`],
        };
    }
}
