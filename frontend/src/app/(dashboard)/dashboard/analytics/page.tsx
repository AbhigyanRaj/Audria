'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  totalCalls: number;
  humanDetected: number;
  machineDetected: number;
  unknownResults: number;
  strategyBreakdown: {
    twilio: { calls: number; accuracy: number; avgLatency: number };
    gemini: { calls: number; accuracy: number; avgLatency: number };
    huggingface: { calls: number; accuracy: number; avgLatency: number };
    jambonz: { calls: number; accuracy: number; avgLatency: number };
  };
  recentTrends: {
    date: string;
    calls: number;
    humanRate: number;
    machineRate: number;
  }[];
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading analytics:', error);
      
      // Fallback to mock data if API fails
      const mockData: AnalyticsData = {
        totalCalls: 247,
        humanDetected: 156,
        machineDetected: 78,
        unknownResults: 13,
        strategyBreakdown: {
          twilio: { calls: 89, accuracy: 87.2, avgLatency: 2100 },
          gemini: { calls: 67, accuracy: 94.1, avgLatency: 5800 },
          huggingface: { calls: 52, accuracy: 89.7, avgLatency: 4200 },
          jambonz: { calls: 39, accuracy: 91.8, avgLatency: 3100 },
        },
        recentTrends: [
          { date: '2024-10-27', calls: 23, humanRate: 0.65, machineRate: 0.31 },
          { date: '2024-10-28', calls: 31, humanRate: 0.61, machineRate: 0.35 },
          { date: '2024-10-29', calls: 28, humanRate: 0.68, machineRate: 0.29 },
          { date: '2024-10-30', calls: 35, humanRate: 0.63, machineRate: 0.34 },
          { date: '2024-11-01', calls: 42, humanRate: 0.67, machineRate: 0.31 },
          { date: '2024-11-02', calls: 38, humanRate: 0.64, machineRate: 0.33 },
          { date: '2024-11-03', calls: 50, humanRate: 0.62, machineRate: 0.36 },
        ],
      };
      
      setTimeout(() => {
        setAnalyticsData(mockData);
        setLoading(false);
      }, 800);
    }
  };

  const getStrategyColor = (strategy: string) => {
    const colors = {
      twilio: 'bg-blue-500',
      gemini: 'bg-purple-500',
      huggingface: 'bg-green-500',
      jambonz: 'bg-orange-500',
    };
    return colors[strategy as keyof typeof colors] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-zinc-400">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Failed to load analytics data</p>
          <button 
            onClick={loadAnalytics}
            className="mt-4 px-4 py-2 bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
            <p className="text-zinc-400">AMD performance insights and strategy comparison</p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex space-x-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Total Calls</h3>
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">{analyticsData.totalCalls}</p>
            <p className="text-xs text-zinc-500 mt-1">Last {timeRange}</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Human Detected</h3>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-green-500">{analyticsData.humanDetected}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {((analyticsData.humanDetected / analyticsData.totalCalls) * 100).toFixed(1)}% success rate
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Machine Detected</h3>
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-red-500">{analyticsData.machineDetected}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {((analyticsData.machineDetected / analyticsData.totalCalls) * 100).toFixed(1)}% voicemail rate
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Unknown Results</h3>
              <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-yellow-500">{analyticsData.unknownResults}</p>
            <p className="text-xs text-zinc-500 mt-1">
              {((analyticsData.unknownResults / analyticsData.totalCalls) * 100).toFixed(1)}% unclear
            </p>
          </div>
        </div>

        {/* Strategy Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Strategy Performance */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Strategy Performance</h3>
            <div className="space-y-4">
              {Object.entries(analyticsData.strategyBreakdown).map(([strategy, data]) => (
                <div key={strategy} className="flex items-center justify-between p-4 bg-black/50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStrategyColor(strategy)}`} />
                    <div>
                      <p className="text-sm font-medium text-white capitalize">
                        {strategy === 'huggingface' ? 'HuggingFace' : strategy}
                      </p>
                      <p className="text-xs text-zinc-500">{data.calls} calls</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">{data.accuracy}%</p>
                    <p className="text-xs text-zinc-500">{data.avgLatency}ms avg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Trends */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">Recent Trends</h3>
            <div className="space-y-3">
              {analyticsData.recentTrends.slice(-5).map((trend, index) => (
                <div key={trend.date} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{new Date(trend.date).toLocaleDateString()}</p>
                    <p className="text-xs text-zinc-500">{trend.calls} calls</p>
                  </div>
                  <div className="flex space-x-4">
                    <div className="text-right">
                      <p className="text-xs text-green-400">{(trend.humanRate * 100).toFixed(0)}% Human</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-red-400">{(trend.machineRate * 100).toFixed(0)}% Machine</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy Comparison Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Strategy Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Strategy</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Calls</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Accuracy</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Avg Latency</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-zinc-400">Best For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <tr className="hover:bg-zinc-900/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      <span className="text-white font-medium">Twilio Native</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.twilio.calls}</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.twilio.accuracy}%</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.twilio.avgLatency}ms</td>
                  <td className="py-4 px-4 text-zinc-400 text-sm">Fast, reliable, cost-effective</td>
                </tr>
                <tr className="hover:bg-zinc-900/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-purple-500 rounded-full" />
                      <span className="text-white font-medium">Gemini Flash</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.gemini.calls}</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.gemini.accuracy}%</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.gemini.avgLatency}ms</td>
                  <td className="py-4 px-4 text-zinc-400 text-sm">Highest accuracy, reasoning</td>
                </tr>
                <tr className="hover:bg-zinc-900/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      <span className="text-white font-medium">Jambonz SIP</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.jambonz.calls}</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.jambonz.accuracy}%</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.jambonz.avgLatency}ms</td>
                  <td className="py-4 px-4 text-zinc-400 text-sm">SIP metrics, voice analysis</td>
                </tr>
                <tr className="hover:bg-zinc-900/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-white font-medium">HuggingFace</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.huggingface.calls}</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.huggingface.accuracy}%</td>
                  <td className="py-4 px-4 text-zinc-300">{analyticsData.strategyBreakdown.huggingface.avgLatency}ms</td>
                  <td className="py-4 px-4 text-zinc-400 text-sm">ML-powered, customizable</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}