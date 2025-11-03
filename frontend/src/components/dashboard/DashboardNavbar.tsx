'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/auth-client';

export default function DashboardNavbar() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center group">
            <span className="text-white font-semibold text-xl">Audria</span>
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
              Dashboard
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/dashboard" 
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Overview
            </Link>
            <Link 
              href="/dashboard/calls" 
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Call History
            </Link>
            <Link 
              href="/dashboard/analytics" 
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Analytics
            </Link>
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-zinc-900/50 transition-colors"
            >
              {/* User Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              
              {/* User Info */}
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-white">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-zinc-400">
                  {session?.user?.email}
                </p>
              </div>

              {/* Dropdown Icon */}
              <svg
                className={`w-4 h-4 text-zinc-400 transition-transform ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800">
                  <p className="text-sm font-medium text-white">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {session?.user?.email}
                  </p>
                </div>

                <div className="py-2">
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Settings
                  </Link>

                  <Link
                    href="/dashboard/billing"
                    className="flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                    Billing
                  </Link>
                </div>

                <div className="border-t border-zinc-800 py-2">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
