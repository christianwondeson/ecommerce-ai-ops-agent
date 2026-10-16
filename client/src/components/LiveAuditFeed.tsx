import React from 'react';
import { AuditLog } from '../types';
import { Activity, AlertTriangle, Mail, Truck, Clock, ShieldCheck } from 'lucide-react';

interface LiveAuditFeedProps {
  logs: AuditLog[];
}

export const LiveAuditFeed: React.FC<LiveAuditFeedProps> = ({ logs }) => {
  const getIcon = (type: AuditLog['actionType']) => {
    switch (type) {
      case 'RESTOCK_FLAG':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'PO_DISPATCHED':
        return <Mail className="w-4 h-4 text-blue-400" />;
      case 'DELIVERY_RECONCILED':
        return <Truck className="w-4 h-4 text-emerald-400" />;
      case 'PROACTIVE_SWEEP':
        return <Clock className="w-4 h-4 text-purple-400" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSourceBadge = (source: AuditLog['source']) => {
    switch (source) {
      case 'AUTONOMOUS_CRON':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            AUTO CRON
          </span>
        );
      case 'COURIER_WEBHOOK':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            CARRIER HOOK
          </span>
        );
      case 'REAL_TIME_INVENTORY':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            STOCK TELEMETRY
          </span>
        );
      case 'HUMAN_OVERRIDE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            DIRECTIVE
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[520px]">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">
            Autonomous Activity & Audit Feed
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {logs.length} logged events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No autonomous actions recorded yet.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-slate-800 border border-slate-700">
                    {getIcon(log.actionType)}
                  </div>
                  <span className="text-xs font-semibold text-slate-200">
                    {log.actionType.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getSourceBadge(log.source)}
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{log.summary}</p>

              {log.details && Object.keys(log.details).length > 0 && (
                <div className="mt-2 text-[11px] text-slate-400 bg-slate-950/60 rounded p-2 font-mono overflow-x-auto">
                  {Object.entries(log.details).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-slate-500">{key}:</span>{' '}
                      <span className="text-slate-300">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
