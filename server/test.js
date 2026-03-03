import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();    
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,   
});
async function main() {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
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