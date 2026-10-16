import React, { useState } from 'react';
import { Send, Bot, User, Sparkles, Wrench, CheckCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'model';
  content: string;
  toolsExecuted?: Array<{
    name: string;
    args: any;
    result: any;
  }>;
}

interface AgentChatConsoleProps {
  onRefreshData: () => Promise<void>;
}

export const AgentChatConsole: React.FC<AgentChatConsoleProps> = ({ onRefreshData }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content:
        'Hello! I am your Autonomous E-Commerce Operations Specialist. I am continuously monitoring inventory thresholds, drafting supplier purchase orders, and reconciling courier delivery tracking manifests. How can I assist you with store operations today?',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sampleDirectives = [
    'Audit stock and flag critical low-inventory items',
    'Reconcile Order #ORD-2026-1001 with courier tracking',
    'Run a proactive store-wide audit sweep',
    'Dispatch purchase order for SKU AUDIO-ANC-001',
  ];

  const handleSend = async (textToSend?: string) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        const modelMsg: Message = {
          role: 'model',
          content: data.reply,
          toolsExecuted: data.toolsExecuted,
        };
        setMessages((prev) => [...prev, modelMsg]);
        // Trigger live refresh of tables
        await onRefreshData();
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'model', content: `Error: ${data.message || 'Failed to process request.'}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: `Network error: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[520px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="text-base font-semibold text-white">
            AI Operations Command Console
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            (Gemini 2.5 Flash Tool-Calling Engine)
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* Tool Execution Cards */}
              {msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-400" />
                    <span>Autonomous Tools Executed ({msg.toolsExecuted.length})</span>
                  </div>
                  {msg.toolsExecuted.map((tool, tIdx) => (
                    <div
                      key={tIdx}
                      className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between text-blue-300 font-bold mb-1">
                        <span>{tool.name}()</span>
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-sans">
                          <CheckCircle className="w-3 h-3" />
                          Executed
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Args: {JSON.stringify(tool.args)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-200" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl rounded-tl-none p-4 text-sm text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
              <span>AI Agent reasoning & executing operational tools...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider whitespace-nowrap font-semibold">
          Suggested:
        </span>
        {sampleDirectives.map((directive, dIdx) => (
          <button
            key={dIdx}
            onClick={() => handleSend(directive)}
            disabled={isLoading}
            className="text-xs px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {directive}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2"
      >
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Direct the AI Operations Agent (e.g. 'Reconcile order ORD-2026-1002' or 'Audit inventory')..."
          className="flex-1 bg-slate-800/80 text-white placeholder-slate-500 text-sm px-4 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !inputPrompt.trim()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
