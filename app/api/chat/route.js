import { NextResponse } from "next/server";

const INSTRUCTIONS = {
  explain: "Explain the topic clearly with a simple analogy and a short summary.",
  notes: "Write concise study notes with headings, bullet points, and key terms.",
  quiz: "Create 5 multiple-choice questions (options A to D). Put the correct answers with short explanations at the end.",
  plan: "Create a personalized 7-day study plan with daily tasks and time estimates.",
};

export async function POST(request) {
  const { topic, mode, level } = await request.json();
  const model = process.env.GEMINI_MODEL;

  const prompt = `You are a friendly study assistant. Difficulty level: ${level}. ${
    INSTRUCTIONS[mode] || INSTRUCTIONS.explain
  } Topic: ${topic}. Use markdown only. Write formulas like CO2 or H2O in plain text, with no LaTeX and no dollar signs.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error?.message || "AI request failed" },
      { status: 500 }
    );
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No answer";
  return NextResponse.json({ reply });
}