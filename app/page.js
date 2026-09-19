"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";

const MODES = [
  { id: "explain", label: "Explain" },
  { id: "notes", label: "Notes" },
  { id: "quiz", label: "Quiz" },
  { id: "plan", label: "Study Plan" },
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("explain");
  const [level, setLevel] = useState("Beginner");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push("/login");
        return;
      }
      setUser(data.session.user);
      loadConversations();
    });
  }, []);

  async function loadConversations() {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });
    setConversations(data || []);
  }

  async function openConversation(id) {
    setActiveId(id);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data || []).map((m) => ({ role: m.role, text: m.content })));
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSend() {
    if (!topic.trim() || loading) return;
    const currentTopic = topic;
    const label = MODES.find((m) => m.id === mode).label;
    const userText = `${label}: ${currentTopic} (${level})`;

    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setTopic("");
    setLoading(true);

    let convId = activeId;
    if (!convId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ title: currentTopic.slice(0, 40) })
        .select()
        .single();
      if (!error) {
        convId = data.id;
        setActiveId(convId);
      }
    }
    if (convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "user",
        mode,
        level,
        content: userText,
      });
    }

    let replyText = "";
    let ok = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: currentTopic, mode, level }),
      });
      const data = await res.json();
      ok = Boolean(data.reply);
      replyText = data.reply || data.error || "Something went wrong";
    } catch {
      replyText = "Network error";
    }

    setMessages((prev) => [...prev, { role: "ai", text: replyText }]);
    if (ok && convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "ai",
        mode,
        level,
        content: replyText,
      });
    }
    setLoading(false);
    loadConversations();
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="md:w-64 border-b md:border-b-0 md:border-r border-gray-700 p-4 space-y-2">
        <button
          onClick={newChat}
          className="w-full bg-blue-600 text-white px-3 py-2 rounded"
        >
          + New chat
        </button>
        <div className="space-y-1 max-h-48 md:max-h-[70vh] overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c.id)}
              className={`w-full text-left px-3 py-2 rounded truncate ${
                c.id === activeId ? "bg-gray-700 text-white" : "hover:bg-gray-800"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 truncate">{user?.email}</p>
        <button onClick={logout} className="text-sm underline text-gray-300">
          Log out
        </button>
      </aside>

      <main className="flex-1 max-w-2xl mx-auto w-full p-8">
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
    </div>
  );
}