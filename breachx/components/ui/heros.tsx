"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";

export default function Heros() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn("github");
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative rounded-b-4xl md:rounded-b-full md:min-h-screen flex justify-center w-full overflow-hidden bg-black text-white">
        {/* Dynamic Background with refined radial gradient and animated stars */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(88,0,150,0.5)_0%,_rgba(0,0,0,1)_100%)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(98,0,234,0.2)_0%,_transparent_50%)]"></div>
          <AnimatedStars />
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center justify-center px-4 py-24 text-center md:py-32 lg:py-40"
        >
          {/* Beta badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mb-8 inline-flex items-center rounded-full border border-purple-400/30 bg-purple-900/40 px-4 py-1.5 text-sm backdrop-blur-sm"
          >
            BreachX is now in beta <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
            className="mb-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-6xl"
          >
            <motion.span
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="inline-block"
            >
              Zero-Day Vulnerability Detection Powered by Solana
            </motion.span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1 }}
            className="mb-10 max-w-2xl text-base text-purple-100/90 sm:text-lg md:text-xl"
          >
            Connect your GitHub account to scan repositories for vulnerabilities
            and store reports securely on the Solana blockchain. Earn
            recognition with our Verified Secure Contributor badge.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.2,
                  delayChildren: 1.2,
                },
              },
            }}
            className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
          >
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              {!loading && !session && (
                <Button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="cursor-pointer bg-white px-6 text-black hover:bg-white/90 disabled:opacity-70"
                >
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {session && (
                <Link href="/dashboard">
                  <Button className="cursor-pointer bg-white px-6 text-black hover:bg-white/90">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              )}
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  className="cursor-pointer border-purple-400/30 bg-transparent backdrop-blur-sm hover:bg-purple-400/30"
                >
                  <BookOpen className="mr-2 h-4 w-4 text-white" />{" "}
                  <span className="text-white">Dashboard</span>
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}

// Animated Stars Component - Fixed for SSR
function AnimatedStars() {
  const [isClient, setIsClient] = useState(false);
  const [stars, setStars] = useState<any>([]);
  const [orbs, setOrbs] = useState<any>([]);

  useEffect(() => {
    setIsClient(true);

    // Generate stars data once on client
    const starsData = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.7 + 0.3,
      animationDelay: Math.random() * 10,
      animationDuration: Math.random() * 5 + 5,
    }));

    // Generate orbs data once on client
    const orbsData = Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 150 + 50,
      opacity: Math.random() * 0.15 + 0.05,
      translateX: Math.random() * 30 - 15,
      translateY: Math.random() * 30 - 15,
      duration: Math.random() * 20 + 30,
    }));

    setStars(starsData);
    setOrbs(orbsData);
  }, []);

  // Don't render stars on server to avoid hydration mismatch
  if (!isClient) {
    return (
      <>
        {/* Central glow */}
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/20 blur-3xl"></div>
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-200/20 blur-2xl"></div>
        <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-xl"></div>
      </>
    );
  }

  return (
    <>
      {/* Static stars layer */}
      <div className="absolute inset-0">
        {stars.map((star: any) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              top: `${star.top}%`,
              left: `${star.left}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.animationDelay}s`,
              animationDuration: `${star.animationDuration}s`,
            }}
          />
        ))}
      </div>

      {/* Glowing orbs for dynamic effect */}
      <div className="absolute inset-0 overflow-hidden">
        {orbs.map((orb: any) => (
          <div
            key={`orb-${orb.id}`}
            className="absolute rounded-full bg-purple-400 blur-3xl"
            style={{
              top: `${orb.top}%`,
              left: `${orb.left}%`,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              opacity: orb.opacity,
              animation: `float ${orb.duration}s infinite ease-in-out`,
              transform: `translate(${orb.translateX}px, ${orb.translateY}px)`,
            }}
          />
        ))}
      </div>

      {/* Central glow */}
      <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-300/20 blur-3xl"></div>
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-200/20 blur-2xl"></div>
      <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30 blur-xl"></div>
    </>
  );
}
