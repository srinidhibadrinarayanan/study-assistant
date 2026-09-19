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

function parseTopic(content) {
  return content
    .replace(/^[^:]+:\s*/, "")
    .replace(/\s\((Beginner|Intermediate|Advanced)\)$/, "");
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [lastRequest, setLastRequest] = useState(null);

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
    const rows = data || [];
    const msgs = rows.map((m) => ({ role: m.role, text: m.content }));
    const last = rows[rows.length - 1];
    if (last && last.role === "user") {
      setLastRequest({
        topic: parseTopic(last.content),
        mode: last.mode,
        level: last.level,
      });
      msgs.push({
        role: "ai",
        error: true,
        text: "This question didn't get an answer. Click Retry to ask it again.",
      });
    } else {
      setLastRequest(null);
    }
    setMessages(msgs);
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setLastRequest(null);
  }

  async function deleteConversation(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this chat?")) return;
    await supabase.from("conversations").delete().eq("id", id);
    if (id === activeId) newChat();
    loadConversations();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function sendRequest(req, isRetry = false) {
    const { topic: t, mode: m, level: l } = req;
    setLoading(true);
    setLastRequest(req);
    const label = MODES.find((x) => x.id === m).label;
    const userText = `${label}: ${t} (${l})`;
    let convId = activeId;

    if (!isRetry) {
      setMessages((prev) => [...prev, { role: "user", text: userText }]);
      if (!convId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ title: t.slice(0, 40) })
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
          mode: m,
          level: l,
          content: userText,
        });
      }
    }

    let replyText = "";
    let ok = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: t, mode: m, level: l }),
      });
      const data = await res.json();
      ok = Boolean(data.reply);
      replyText = data.reply || data.error || "Something went wrong";
    } catch {
      replyText = "Network error";
    }

    setMessages((prev) => [
      ...prev,
      ok ? { role: "ai", text: replyText } : { role: "ai", text: replyText, error: true },
    ]);
    if (ok && convId) {
      await supabase.from("messages").insert({
        conversation_id: convId,
        role: "ai",
        mode: m,
        level: l,
        content: replyText,
      });
    }
    setLoading(false);
    loadConversations();
  }

  function handleSend() {
    if (!topic.trim() || loading) return;
    const req = { topic: topic.trim(), mode, level };
    setTopic("");
    sendRequest(req);
  }

  function retry() {
    if (!lastRequest || loading) return;
    setMessages((prev) =>
      prev.length && prev[prev.length - 1].error ? prev.slice(0, -1) : prev
    );
    sendRequest(lastRequest, true);
  }

  return (
    <div className="flex flex-col md:flex-row h-dvh overflow-hidden">
      <aside className="md:w-64 shrink-0 max-h-[35vh] md:max-h-none overflow-y-auto border-b md:border-b-0 md:border-r border-gray-700 p-4 space-y-2">
        <button
          onClick={newChat}
          className="w-full bg-blue-600 text-white px-3 py-2 rounded"
        >
          + New chat
        </button>
        <div className="space-y-1">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`flex items-center rounded ${
                c.id === activeId ? "bg-gray-700 text-white" : "hover:bg-gray-800"
              }`}
            >
              <button
                onClick={() => openConversation(c.id)}
                className="flex-1 text-left px-3 py-2 truncate"
              >
                {c.title}
              </button>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                title="Delete chat"
                className="px-2 py-2 text-gray-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-400 truncate">{user?.email}</p>
        <button onClick={logout} className="text-sm underline text-gray-300">
          Log out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-8">
          <h1 className="text-3xl font-bold mb-4">AI Study Assistant</h1>

          <div className="space-y-4 mb-4">
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="text-right">
                    <span className="inline-block bg-blue-600 text-white rounded px-3 py-2">
                      {m.text}
                    </span>
                  </div>
                );
              }
              if (m.error) {
                return (
                  <div key={i} className="bg-red-100 text-red-800 rounded p-4">
                    <p>{m.text}</p>
                    {i === messages.length - 1 && lastRequest && (
                      <button
                        onClick={retry}
                        disabled={loading}
                        className="mt-2 bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <div key={i} className="bg-gray-100 text-black rounded p-4">
                  <div className="prose max-w-none">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                  <button
                    onClick={() => downloadText(m.text, "study-notes.md")}
                    className="mt-3 text-sm border border-gray-400 rounded px-3 py-1 hover:bg-gray-200"
                  >
                    Download
                  </button>
                </div>
              );
            })}
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
        </div>
      </main>
    </div>
  );
}