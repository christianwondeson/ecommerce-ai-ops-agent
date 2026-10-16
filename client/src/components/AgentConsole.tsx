import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Msg = { role: "user" | "model"; text: string; tools?: string[] | undefined };
const PROMPTS = [
  "Which products need restocking right now?",
  "Reconcile all in-transit orders",
  "Send a PO for every critical item",
  "Run a full audit sweep",
];

export function AgentConsole() {
  const qc = useQueryClient();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const history = msgs.map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api.chat(text, history);
      setMsgs((m) => [...m, { role: "model", text: r.reply, tools: r.toolsExecuted?.map((t) => t.name) }]);
      qc.invalidateQueries();
    } catch (e) {
      setMsgs((m) => [...m, { role: "model", text: `⚠ ${(e as Error).message}` }]);
    } finally { setBusy(false); }
  }

  return (
    <section className="panel flex h-[520px] flex-col">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">04</span>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Dispatch Radio</h2>
        </div>
        <span className="label-tag">Gemini operator</span>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Give the operator an order. It can check stock, flag items, email vendors and close out deliveries.</p>
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => send(p)} className="block w-full border border-dashed border-line px-3 py-2 text-left font-mono text-[11px] text-foreground/80 transition-colors hover:border-primary hover:text-primary">
                → {p}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="animate-slidein">
            <p className="label-tag mb-1">{m.role === "user" ? "You" : "Operator"}</p>
            <p className={m.role === "user" ? "font-mono text-xs text-primary" : "whitespace-pre-wrap text-sm leading-relaxed"}>{m.text}</p>
            {m.tools && m.tools.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.tools.map((t, j) => <span key={j} className="bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-ok">⚙ {t}</span>)}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="font-mono text-xs text-muted-foreground">Operator is working<span className="animate-blink">_</span></p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex border-t border-line">
        <span className="px-3 py-3 font-mono text-sm text-primary">&gt;</span>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type an instruction…"
          className="flex-1 bg-transparent py-3 font-mono text-xs outline-none placeholder:text-muted-foreground" />
        <button type="submit" disabled={busy || !input.trim()} className="btn-signal m-1.5 shadow-none">Send</button>
      </form>
    </section>
  );
}
