'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn.email({
        email,
        password,
      });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center mb-8 group">
          <span className="text-white font-semibold text-2xl">Audria</span>
        </Link>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-sm text-zinc-400">Sign in to your Audria account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                />
                <span className="text-sm text-zinc-400">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-2xl">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-400">
              Don't have an account?{' '}
              <Link href="/signup" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-zinc-500 mt-8">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
