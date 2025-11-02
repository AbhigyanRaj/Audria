import Navbar from '@/components/layout/Navbar';
import HeroSection from '@/components/layout/HeroSection';
import Footer from '@/components/layout/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      <HeroSection />
      <Footer />
    </div>
  );
}
