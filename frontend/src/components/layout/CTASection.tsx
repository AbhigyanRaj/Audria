'use client';

import Button from '@/components/ui/Button';

export default function CTASection() {
  return (
    <section className="relative py-32 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative p-12 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-zinc-800 rounded-3xl overflow-hidden">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-blue-600/10 blur-3xl" />
          
          {/* Content */}
          <div className="relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to boost your outbound calling?
            </h2>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto">
              Join teams using Audria to save time and connect with real humans faster
            </p>
            <Button href="/login" variant="primary" size="lg">
              Start with Audria →
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
