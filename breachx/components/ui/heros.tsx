import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen } from 'lucide-react';

export default function Heros() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative rounded-b-4xl md:rounded-b-full md:min-h-screen flex justify-center w-full overflow-hidden bg-black text-white">
        {/* Dynamic Background with radial gradient and animated stars */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(147,51,234,0.5)_0%,rgba(88,28,135,0.3)_50%,rgba(0,0,0,1)_100%)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(216,180,254,0.4)_0%,transparent_50%)]"></div>
          <AnimatedStars />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-24 text-center md:py-32 lg:py-40">
          {/* Beta badge */}
          <div className="mb-8 inline-flex items-center rounded-full border border-purple-400/30 bg-purple-900/40 px-4 py-1.5 text-sm backdrop-blur-sm">
            BreachX is now in beta <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>

          {/* Heading */}
          <h1 className="mb-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-6xl">
          Zero-Day Vulnerability Detection Powered by Solana
          </h1>

          {/* Subtext */}
          <p className="mb-10 max-w-2xl text-base text-purple-100/90 sm:text-lg md:text-xl">
            Connect your GitHub account to scan repositories for vulnerabilities and store reports securely on the Solana blockchain. Earn recognition with our Verified Secure Contributor badge.
          </p>

          {/* Buttons */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            <Button className="bg-white px-6 text-black hover:bg-white/90">
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="border-purple-400/30 bg-transparent backdrop-blur-sm hover:bg-purple-900/40"
            >
              <BookOpen className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </div>
        </div>
      </section>
      
    </main>
  )
}

// Animated Stars Component
function AnimatedStars() {
  return (
    <>
      {/* Static stars layer */}
      <div className="absolute inset-0">
        {Array.from({ length: 80 }).map((_, i) => {
          const top = `${Math.random() * 100}%`
          const left = `${Math.random() * 100}%`
          const size = Math.random() * 2 + 1
          const opacity = Math.random() * 0.7 + 0.3
          const animationDelay = `${Math.random() * 10}s`
          const animationDuration = `${Math.random() * 5 + 5}s`

          return (
            <div
              key={i}
              className="absolute rounded-full bg-white animate-pulse"
              style={{
                top,
                left,
                width: `${size}px`,
                height: `${size}px`,
                opacity,
                animationDelay,
                animationDuration,
              }}
            />
          )
        })}
      </div>

      {/* Glowing orbs for dynamic effect */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => {
          const top = `${Math.random() * 100}%`
          const left = `${Math.random() * 100}%`
          const size = Math.random() * 150 + 50
          const opacity = Math.random() * 0.15 + 0.05

          return (
            <div
              key={`orb-${i}`}
              className="absolute rounded-full bg-purple-400 blur-3xl"
              style={{
                top,
                left,
                width: `${size}px`,
                height: `${size}px`,
                opacity,
                animation: `float ${Math.random() * 20 + 30}s infinite ease-in-out`,
                transform: `translate(${Math.random() * 30 - 15}px, ${Math.random() * 30 - 15}px)`,
              }}
            />
          )
        })}
      </div>

      {/* Central glow */}
      <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/20 blur-3xl"></div>
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-200/20 blur-2xl"></div>
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-xl"></div>
    </>
  );
}

// Logos data


