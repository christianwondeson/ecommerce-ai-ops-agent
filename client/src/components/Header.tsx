import React from 'react';
import { Bot, Clock, Play, Sparkles, CheckCircle2 } from 'lucide-react';
import { SchedulerState } from '../types';

interface HeaderProps {
  schedulerState: SchedulerState | null;
  onTriggerSweep: () => void;
  isSweeping: boolean;
}

export const Header: React.FC<HeaderProps> = ({ schedulerState, onTriggerSweep, isSweeping }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Brand & Mission */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                AI E-Commerce Operations Specialist
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Autopilot Active
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous Stockout Guard & 3PL Courier Delivery Reconciliation Agent
            </p>
          </div>
        </div>

        {/* Action Controls & Scheduler Status */}
        <div className="flex items-center space-x-3">
          {schedulerState && (
            <div className="hidden sm:flex items-center space-x-2 text-xs bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-2 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Cron Schedule: <strong className="text-slate-200">{schedulerState.cronExpression}</strong>
              </span>
              <span className="text-slate-500">|</span>
              <span>Sweeps: <strong className="text-slate-200">{schedulerState.totalRuns}</strong></span>
            </div>
          )}

          <button
            onClick={onTriggerSweep}
            disabled={isSweeping}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            {isSweeping ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing Store...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Proactive Audit</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
