'use client';

import { Phone, Settings, BarChart3, Lock } from 'lucide-react';

const features = [
  {
    icon: Phone,
    title: 'Real-Time AMD',
    description: 'Identify human vs. voicemail in milliseconds',
  },
  {
    icon: Settings,
    title: 'Multiple Strategies',
    description: 'Choose Twilio, Hugging Face, Gemini',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Track accuracy, latency, and costs',
  },
  {
    icon: Lock,
    title: 'Secure & Scalable',
    description: 'Backed by Twilio and PostgreSQL',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-32 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Everything you need to optimize your outbound calling workflow
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl hover:border-zinc-700 transition-all duration-300 hover:bg-zinc-900"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-purple-400" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
