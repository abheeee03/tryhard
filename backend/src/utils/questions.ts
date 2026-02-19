import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite"
});

export async function generateQuestions(topic: string, count = 5, difficulty: string = "easy") {
    const prompt = `
  Generate ${count} quiz questions along with the options and correct answer about "${topic}" with difficulty level "${difficulty}"
  IMPORTANT: the answer should be in STRICT given JSON format and DIRECTLY return the json without any other text.
  example: 
    {
        questions: [ {
            question: "Questions Number 1",
            options: [
            {index: 0, option: "Option Number 1"},
            {index: 1, option: "Option Number 2"},
            {index: 2, option: "Option Number 3"},
            {index: 3, option: "Option Number 4"}
            ],
            answer: 0 } ,{....}
        ]
    }
  `;

    const res = await model.generateContent(prompt);
    const text = res.response.text() || "";
    console.log("ques: ", text);

    try {
        // Try to extract JSON between markdown markers if they exist
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const cleanedText = jsonMatch ? jsonMatch[1].trim() : text.trim();

        // If it still fails, try finding the first '{' and last '}'
        try {
            return JSON.parse(cleanedText);
        } catch (e) {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                return JSON.parse(text.substring(firstBrace, lastBrace + 1));
            }
            throw e;
        }
    } catch (error) {
        console.error("Failed to parse questions JSON:", error);
        throw new Error("Failed to generate valid quiz questions. Please try again.");
    }
}