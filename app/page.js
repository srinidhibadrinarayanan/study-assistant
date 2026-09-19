"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

const MODES = [
  { id: "explain", label: "Explain" },
  { id: "notes", label: "Notes" },
  { id: "quiz", label: "Quiz" },
  { id: "plan", label: "Study Plan" },
];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("explain");
  const [level, setLevel] = useState("Beginner");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!topic.trim() || loading) return;
    const currentTopic = topic;
    const label = MODES.find((m) => m.id === mode).label;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: `${label}: ${currentTopic} (${level})` },
    ]);
    setTopic("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: currentTopic, mode, level }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.reply || data.error || "Something went wrong" },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Network error" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">AI Study Assistant</h1>

      <div className="space-y-4 mb-4">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="text-right">
              <span className="inline-block bg-blue-600 text-white rounded px-3 py-2">
                {m.text}
              </span>
            </div>
          ) : (
            <div key={i} className="prose max-w-none bg-gray-100 text-black rounded p-4">
              <ReactMarkdown>{m.text}</ReactMarkdown>
            </div>
          )
        )}
        {loading && <p className="text-gray-500">Thinking...</p>}
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-3 py-1 rounded border ${
              mode === m.id ? "bg-blue-600 text-white" : "bg-white text-black"
            }`}
          >
            {m.label}
          </button>
        ))}
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="border px-2 py-1 rounded bg-white text-black"
        >
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>

      <input
        className="border p-2 w-full mb-2 bg-white text-black"
        placeholder="Enter a topic..."
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />
      <button
        onClick={handleSend}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Send
      </button>
    </main>
  );
}