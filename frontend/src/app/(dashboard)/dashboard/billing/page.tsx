'use client';

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Billing</h1>
          <p className="text-zinc-400">Manage your subscription and payment methods</p>
        </div>

        {/* Current Plan */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1">Current Plan</h2>
              <p className="text-sm text-zinc-400">Free Trial</p>
            </div>
            <button className="px-4 py-2 bg-purple-500 text-white font-medium rounded-xl hover:bg-purple-600 transition-colors">
              Upgrade Plan
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400 mb-1">Monthly Calls</p>
              <p className="text-2xl font-bold text-white">0 / 100</p>
            </div>
            <div className="bg-black border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400 mb-1">Current Spend</p>
              <p className="text-2xl font-bold text-white">$0.00</p>
            </div>
            <div className="bg-black border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-400 mb-1">Next Billing</p>
              <p className="text-2xl font-bold text-white">--</p>
            </div>
          </div>
        </div>

        {/* Usage History */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Usage History</h2>
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-zinc-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-zinc-500 text-sm">No billing history yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
