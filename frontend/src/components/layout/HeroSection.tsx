'use client';

import Button from '@/components/ui/Button';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black" />
      
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      
      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-[120px] animate-pulse delay-1000" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 text-center pt-20">
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-zinc-400">AI-Powered Detection</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
          We Detect Humans.{' '}
          <span className="italic font-normal">
            Not Voicemail.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-zinc-400 mb-12 max-w-2xl mx-auto">
          Detect humans in under 3 seconds. Connect smarter. Save time and money.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Button href="/login" variant="primary" size="md">
            Start with Audria →
          </Button>
          <Button href="/login" variant="outline" size="md">
            Sign In
          </Button>
        </div>

        {/* Video Demo Section */}
        <div className="relative max-w-4xl mx-auto">
          <div className="aspect-video bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden">
            {/* YouTube Embed - Replace VIDEO_ID with your actual YouTube video ID */}
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/mM4SGf_Mhm0"
              title="Audria Demo Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {/* Placeholder when no video is set */}
            {/* <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <svg className="w-16 h-16 text-zinc-700 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <p className="text-sm text-zinc-500">Demo video coming soon</p>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </section>
  );
}
