import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();    
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,   
});
async function main() {
  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: "Explain why fast inference is critical for reasoning models",
      },
    ],
  });
  console.log(completion.choices[0]?.message?.content);
}
main().catch(console.error);