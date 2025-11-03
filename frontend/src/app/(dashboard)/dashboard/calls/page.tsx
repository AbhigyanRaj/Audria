'use client';

import { useState, useEffect } from 'react';

type CallStatus = 'all' | 'completed' | 'in-progress' | 'failed';
type AMDStrategy = 'all' | 'twilio' | 'jambonz' | 'huggingface' | 'gemini';

interface Call {
  id: string;
  callSid: string;
  targetNumber: string;
  fromNumber: string;
  status: string;
  duration?: number;
  strategy: string;
  detection: string;
  confidence?: number;
  latencyMs?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Load calls
  useEffect(() => {
    loadCalls();
  }, [statusFilter, strategyFilter, searchQuery, pagination.page]);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (strategyFilter !== 'all') params.append('strategy', strategyFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/calls?${params}`);
      const data = await response.json();

      if (response.ok) {
        setCalls(data.calls);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error loading calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const exportData = {
        status: statusFilter === 'all' ? undefined : statusFilter,
        strategy: strategyFilter === 'all' ? undefined : strategyFilter,
        search: searchQuery || undefined,
      };

      const response = await fetch('/api/calls/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audria-calls-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDetectionColor = (detection: string) => {
    switch (detection) {
      case 'human':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'machine':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'analyzing':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'unknown':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const getDetectionLabel = (detection: string, metadata?: Record<string, any>) => {
    // PDF REQUIREMENT: Show "Undecided—treating as human" for low confidence
    if (metadata?.ui_display) {
      return metadata.ui_display;
    }
    
    switch (detection) {
      case 'analyzing':
        return 'Analyzing';
      case 'pending':
        return 'Pending';
      case 'unknown':
        return 'Unknown';
      case 'human':
        return 'Human';
      case 'machine':
        return 'Machine';
      default:
        return detection.charAt(0).toUpperCase() + detection.slice(1);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'in-progress':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'human':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'machine':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Call History</h1>
            <p className="text-zinc-400">View and manage your call records</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium">Export CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Phone number, Call SID..."
                className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CallStatus)}
                className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Strategy Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                AMD Strategy
              </label>
              <select
                value={strategyFilter}
                onChange={(e) => setStrategyFilter(e.target.value as AMDStrategy)}
                className="w-full px-4 py-2 bg-black border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Strategies</option>
                <option value="twilio">Twilio Native</option>
                <option value="jambonz">Jambonz</option>
                <option value="huggingface">HuggingFace</option>
                <option value="gemini">Gemini Flash</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900/80 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Call SID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Target Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Strategy
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Decision
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex items-center justify-center">
                        <svg className="w-6 h-6 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="ml-2 text-zinc-500">Loading calls...</span>
                      </div>
                    </td>
                  </tr>
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <svg className="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <p className="text-zinc-500 text-sm mb-1">No calls found</p>
                      <p className="text-zinc-600 text-xs">Make your first call to see it here</p>
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr key={call.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-zinc-400">
                        {call.callSid}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {call.targetNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-300">
                        {call.strategy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getDetectionColor(call.detection)}`}>
                          {getDetectionLabel(call.detection, call.metadata)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                        {call.duration ? `${call.duration}s` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(call.status)}`}>
                          {call.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                        {formatDate(call.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {calls.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Showing <span className="font-medium text-white">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
              <span className="font-medium text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
              <span className="font-medium text-white">{pagination.total}</span> results
            </p>
            <div className="flex space-x-2">
              <button 
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button 
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}