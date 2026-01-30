'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: Date | null;
  metric: string;
  metricLabel: string;
  checking: boolean;
}

const STATUS_COLORS = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

const STATUS_LABELS = {
  healthy: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

function StatusBadge({ status }: { status: ServiceHealth['status'] }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]} animate-pulse`} />
      <span className="text-sm font-medium text-zinc-300">{STATUS_LABELS[status]}</span>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{service.name}</h3>
        {service.checking ? (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-500 animate-pulse" />
            <span className="text-sm text-zinc-500">Checking...</span>
          </div>
        ) : (
          <StatusBadge status={service.status} />
        )}
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{service.metricLabel}</p>
          <p className="text-2xl font-bold text-white">{service.metric}</p>
        </div>
        
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-500">
            Last checked: <span className="text-zinc-400">{formatTime(service.lastChecked)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'RLM Service', status: 'healthy', lastChecked: null, metric: '--', metricLabel: 'Response Time', checking: true },
    { name: 'Perplexity API', status: 'healthy', lastChecked: null, metric: '--', metricLabel: 'API Status', checking: true },
    { name: 'Supabase DB', status: 'healthy', lastChecked: null, metric: '--', metricLabel: 'Connections', checking: true },
    { name: 'Chat API', status: 'healthy', lastChecked: null, metric: '--', metricLabel: 'Avg Latency', checking: true },
  ]);
  
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [nextRefresh, setNextRefresh] = useState(30);

  const checkHealth = useCallback(async () => {
    // Mark all as checking
    setServices(prev => prev.map(s => ({ ...s, checking: true })));
    
    // Check RLM Service
    try {
      const start = performance.now();
      const rlmRes = await fetch('/api/rlm/health', { method: 'GET' });
      const latency = Math.round(performance.now() - start);
      setServices(prev => prev.map(s => 
        s.name === 'RLM Service' 
          ? { ...s, status: rlmRes.ok ? 'healthy' : 'down', lastChecked: new Date(), metric: `${latency}ms`, checking: false }
          : s
      ));
    } catch {
      setServices(prev => prev.map(s => 
        s.name === 'RLM Service' 
          ? { ...s, status: 'down', lastChecked: new Date(), metric: 'Error', checking: false }
          : s
      ));
    }

    // Check Perplexity API
    try {
      const pplxRes = await fetch('/api/chat/perplexity-health');
      const pplxData = await pplxRes.json();
      setServices(prev => prev.map(s => 
        s.name === 'Perplexity API' 
          ? { ...s, status: pplxData.healthy ? 'healthy' : 'down', lastChecked: new Date(), metric: pplxData.healthy ? 'Connected' : 'Disconnected', checking: false }
          : s
      ));
    } catch {
      setServices(prev => prev.map(s => 
        s.name === 'Perplexity API' 
          ? { ...s, status: 'down', lastChecked: new Date(), metric: 'Error', checking: false }
          : s
      ));
    }

    // Check Supabase
    try {
      const start = performance.now();
      const supaRes = await fetch('/api/health/supabase');
      const supaData = await supaRes.json();
      const latency = Math.round(performance.now() - start);
      setServices(prev => prev.map(s => 
        s.name === 'Supabase DB' 
          ? { ...s, status: supaData.healthy ? 'healthy' : 'down', lastChecked: new Date(), metric: supaData.healthy ? `${latency}ms` : 'Error', checking: false }
          : s
      ));
    } catch {
      setServices(prev => prev.map(s => 
        s.name === 'Supabase DB' 
          ? { ...s, status: 'down', lastChecked: new Date(), metric: 'Error', checking: false }
          : s
      ));
    }

    // Check Chat API
    try {
      const start = performance.now();
      const chatRes = await fetch('/api/chat/health');
      const latency = Math.round(performance.now() - start);
      setServices(prev => prev.map(s => 
        s.name === 'Chat API' 
          ? { ...s, status: chatRes.ok ? 'healthy' : 'down', lastChecked: new Date(), metric: `${latency}ms`, checking: false }
          : s
      ));
    } catch {
      setServices(prev => prev.map(s => 
        s.name === 'Chat API' 
          ? { ...s, status: 'down', lastChecked: new Date(), metric: 'Error', checking: false }
          : s
      ));
    }

    setLastRefresh(new Date());
    setNextRefresh(30);
  }, []);

  useEffect(() => {
    checkHealth();
    
    const refreshInterval = setInterval(() => {
      checkHealth();
    }, 30000);

    const countdownInterval = setInterval(() => {
      setNextRefresh(prev => (prev > 0 ? prev - 1 : 30));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [checkHealth]);

  const healthyCount = services.filter(s => s.status === 'healthy' && !s.checking).length;
  const totalChecked = services.filter(s => !s.checking).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#EA580C] to-[#DC2626] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SoulPrint Admin</h1>
                <p className="text-xs text-zinc-500">Service Health Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-zinc-500">Auto-refresh in</p>
                <p className="text-sm font-mono text-[#EA580C]">{nextRefresh}s</p>
              </div>
              <button 
                onClick={checkHealth}
                className="px-4 py-2 bg-[#EA580C] hover:bg-[#DC2626] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Status Summary */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-2xl font-bold text-white">System Status</h2>
            {totalChecked > 0 && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                healthyCount === totalChecked 
                  ? 'bg-green-500/20 text-green-400' 
                  : healthyCount > 0 
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              }`}>
                {healthyCount}/{totalChecked} Services Healthy
              </span>
            )}
          </div>
          {lastRefresh && (
            <p className="text-sm text-zinc-500">
              Last updated: {lastRefresh.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </p>
          )}
        </div>

        {/* Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map(service => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 pt-8 border-t border-zinc-800">
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <p>Dashboard refreshes automatically every 30 seconds</p>
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Healthy
              <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2"></span> Degraded
              <span className="w-2 h-2 rounded-full bg-red-500 ml-2"></span> Down
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
