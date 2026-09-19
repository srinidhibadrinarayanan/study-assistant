import { NextResponse } from "next/server";

export const maxDuration = 60;

const INSTRUCTIONS = {
  explain: "Explain the topic clearly with a simple analogy and a short summary.",
  notes: "Write concise study notes with headings, bullet points, and key terms.",
  quiz: "Create 5 multiple-choice questions. Put each question on its own line in bold with its number, then list options A to D as a bullet list, one option per line. After all questions, add a line with --- and an 'Answer Key' heading listing each correct answer with a one-sentence explanation.",
  plan: "Create a personalized 7-day study plan with daily tasks and time estimates.",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isBusy(res, data) {
  const msg = data?.error?.message || "";
  return (
    res.status === 503 ||
    res.status === 429 ||
    data?.error?.status === "UNAVAILABLE" ||
    data?.error?.status === "RESOURCE_EXHAUSTED" ||
    /high demand|overloaded|quota/i.test(msg)
  );
}

async function callModel(model, prompt) {
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
  return { res, data };
}

async function callGemini(prompt) {
  const models = [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean);
  let firstFail = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await callModel(model, prompt);
      if (r.res.ok) return r;
      if (!firstFail) firstFail = r;
      if (!isBusy(r.res, r.data)) break;
      await sleep(2000 * (attempt + 1));
    }
  }
  return firstFail;
}

export async function POST(request) {
  const { topic, mode, level } = await request.json();

  const prompt = `You are a friendly study assistant. Difficulty level: ${level}. ${
    INSTRUCTIONS[mode] || INSTRUCTIONS.explain
  } Topic: ${topic}. Use markdown only. Write formulas like CO2 or H2O in plain text, with no LaTeX and no dollar signs.`;

  const { res, data } = await callGemini(prompt);

  if (!res.ok) {
    const busy = isBusy(res, data);
    return NextResponse.json(
      {
        error: busy
          ? "The AI is busy right now. Please wait a few seconds and try again."
          : data?.error?.message || "AI request failed",
      },
      { status: busy ? 503 : 500 }
    );
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No answer";
  return NextResponse.json({ reply });
}