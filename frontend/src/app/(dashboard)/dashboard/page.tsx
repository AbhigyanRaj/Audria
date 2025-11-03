'use client';

import { useSession } from '@/lib/auth-client';
import { useState } from 'react';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [selectedStrategy, setSelectedStrategy] = useState('gemini');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const amdStrategies = [
    {
      id: 'twilio',
      name: 'Twilio Native AMD',
      description: 'Built-in machine detection (Limited accuracy on trial)',
      accuracy: '60-75%',
      latency: '~2.1s',
      cost: 'Medium',
    },
    {
      id: 'jambonz',
      name: 'Jambonz SIP-Enhanced',
      description: 'SIP-based detection with voice activity analysis',
      accuracy: '92%',
      latency: '~3.1s',
      cost: 'Medium',
    },
    {
      id: 'huggingface',
      name: 'HuggingFace ML Model',
      description: 'Machine learning audio classification',
      accuracy: '90%',
      latency: '~4.2s',
      cost: 'Low',
    },
    {
      id: 'gemini',
      name: 'Gemini Flash 2.5',
      description: 'Real-time AI audio analysis (Works on trial)',
      accuracy: '94%',
      latency: '~5.8s',
      cost: 'Low',
    },
    {
      id: 'fastapi',
      name: 'FastAPI ML Ensemble',
      description: 'Multi-model ML analysis (Works on trial)',
      accuracy: '92%',
      latency: '~3.5s',
      cost: 'Low',
    },
  ];

  const handleDialCall = async () => {
    if (!phoneNumber) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetNumber: phoneNumber,
          strategy: selectedStrategy,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Call initiated successfully! Call SID: ${data.callSid}` 
        });
        setPhoneNumber(''); // Clear input
      } else {
        // Handle trial account specific errors with helpful messages
        let errorMessage = data.error || 'Failed to initiate call';
        
        if (data.error?.includes('TRIAL_RESTRICTION')) {
          errorMessage = 'Trial Account Limitation: Cannot call toll-free numbers (1-800, 1-888, etc.). Please verify your personal phone number at https://console.twilio.com/phone-numbers/verified or upgrade to a paid account to call any US number.';
        } else if (data.error?.includes('verify')) {
          errorMessage = 'Please verify this phone number in your Twilio console first. Visit: https://console.twilio.com/phone-numbers/verified';
        } else if (data.error?.includes('Invalid phone number format')) {
          errorMessage = 'Invalid format. Please use E.164 format: +1XXXXXXXXXX (e.g., +12025551234)';
        }
        
        setMessage({ 
          type: 'error', 
          text: errorMessage
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to initiate call. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[85vh] bg-black text-white mt-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p className="text-zinc-400">
            Make calls with advanced answering machine detection
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success' 
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Total Calls</h3>
              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-white">0</p>
            <p className="text-xs text-zinc-500 mt-1">All time</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Human Detected</h3>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-green-500">0</p>
            <p className="text-xs text-zinc-500 mt-1">Connected calls</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Voicemail</h3>
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-red-500">0</p>
            <p className="text-xs text-zinc-500 mt-1">Machines detected</p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">Avg Detection</h3>
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-purple-500">0s</p>
            <p className="text-xs text-zinc-500 mt-1">Detection time</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dial Interface */}
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Make a Call</h2>
            
            <div className="space-y-6">
              {/* Phone Number Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Target Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 bg-black border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Enter number in E.164 format (e.g., +14155552671)
                </p>
              </div>

              {/* AMD Strategy Selector */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  AMD Strategy
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {amdStrategies.map((strategy) => (
                    <button
                      key={strategy.id}
                      onClick={() => setSelectedStrategy(strategy.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedStrategy === strategy.id
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-zinc-800 bg-black hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">
                          {strategy.name}
                        </span>
                        {selectedStrategy === strategy.id && (
                          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">{strategy.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dial Button */}
              <button
                onClick={handleDialCall}
                disabled={!phoneNumber || loading}
                className="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Calling...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Dial Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Info */}
          <div className="space-y-6">
            {/* Strategy Info */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Strategy Info</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5" />
                  <div>
                    <p className="text-sm text-white font-medium">
                      {selectedStrategy === 'twilio' && 'Twilio Native AMD'}
                      {selectedStrategy === 'jambonz' && 'Jambonz SIP-Enhanced'}
                      {selectedStrategy === 'huggingface' && 'HuggingFace ML Model'}
                      {selectedStrategy === 'gemini' && 'Gemini Flash 2.0'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {selectedStrategy === 'twilio' && 'Built-in Twilio detection with StatusCallback'}
                      {selectedStrategy === 'jambonz' && 'SIP-based AMD with voice activity detection'}
                      {selectedStrategy === 'huggingface' && 'Pre-trained ML model for audio classification'}
                      {selectedStrategy === 'gemini' && 'Real-time LLM audio analysis with reasoning'}
                    </p>
                  </div>
                </div>

                {/* Strategy Details */}
                <div className="bg-black/50 border border-zinc-800 rounded-lg p-3">
                  <div className="text-xs text-zinc-400 space-y-1">
                    {selectedStrategy === 'twilio' && (
                      <>
                        <p>• Latency: ~1-3 seconds</p>
                        <p>• Accuracy: 85-90%</p>
                        <p>• Cost: Included with Twilio</p>
                      </>
                    )}
                    {selectedStrategy === 'jambonz' && (
                      <>
                        <p>• Latency: ~2-4 seconds</p>
                        <p>• Accuracy: 90-95%</p>
                        <p>• Features: SIP metrics, VAD</p>
                      </>
                    )}
                    {selectedStrategy === 'huggingface' && (
                      <>
                        <p>• Latency: ~3-6 seconds</p>
                        <p>• Accuracy: 88-93%</p>
                        <p>• Model: wav2vec2-base-960h</p>
                      </>
                    )}
                    {selectedStrategy === 'gemini' && (
                      <>
                        <p>• Latency: ~4-8 seconds</p>
                        <p>• Accuracy: 92-97%</p>
                        <p>• Features: Reasoning, patterns</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-zinc-500">No calls yet</p>
                <p className="text-xs text-zinc-600 mt-1">Make your first call to get started</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
