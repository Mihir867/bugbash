"use client";
import { PinContainer } from "@/components/ui/3d-pin";
import React, { useState } from "react";

export default function AnimatedBadgeSwitcher() {
  const [activeBadge, setActiveBadge] = useState(0);

  const badges = [
    {
      title: "NFT Generation",
      subtitle: "Coming Soon",
      description: "Create unique NFTs with AI-powered generation tools and smart contract deployment.",
      icon: "🎨",
      gradient: "from-purple-500 via-pink-500 to-rose-500",
      href: "#nft-generation"
    },
    {
      title: "GitHub Integration", 
      subtitle: "Coming Soon",
      description: "Seamless integration with your GitHub repositories for automated workflows.",
      icon: "🔗",
      gradient: "from-blue-500 via-cyan-500 to-teal-500", 
      href: "#github-integration"
    }
  ];

  const currentBadge = badges[activeBadge];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-8 p-8">
      {/* Controller */}
      <div className="flex gap-4 p-2 bg-slate-900/50 backdrop-blur-sm rounded-full border border-slate-700/50">
        {badges.map((badge, index) => (
          <button
            key={index}
            onClick={() => setActiveBadge(index)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 relative overflow-hidden
              ${activeBadge === index 
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }
            `}
          >
            <span className="relative z-10 flex items-center gap-2">
              {badge.icon}
              {badge.title}
            </span>
            {activeBadge === index && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 opacity-20 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Animated Badge */}
      <div className="relative pt-20">
        {/* Shiny Border Animation */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-lg blur opacity-75 animate-pulse"></div>
        
        {/* Main Container */}
        <div className="relative">
          <PinContainer
            title={currentBadge.href}
            href={currentBadge.href}
          >
            <div className="flex basis-full flex-col p-6 tracking-tight text-slate-100/50 sm:basis-1/2 w-[24rem] h-[24rem] relative overflow-hidden">
              {/* Animated background particles */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-4 left-4 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-50"></div>
                <div className="absolute top-12 right-8 w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-40 delay-1000"></div>
                <div className="absolute bottom-16 left-8 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping opacity-30 delay-500"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{currentBadge.icon}</span>
                  <div>
                    <h3 className="!pb-1 !m-0 font-bold text-xl text-slate-100">
                      {currentBadge.title}
                    </h3>
                    <div className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-semibold rounded-full inline-block">
                      {currentBadge.subtitle}
                    </div>
                  </div>
                </div>
                
                <div className="text-base !m-0 !p-0 font-normal mb-6">
                  <span className="text-slate-300 leading-relaxed">
                    {currentBadge.description}
                  </span>
                </div>

                {/* Progress indicator */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Development Progress</span>
                    <span>60%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full w-3/5 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Animated gradient background */}
              <div className={`flex flex-1 w-full rounded-lg mt-4 bg-gradient-to-br ${currentBadge.gradient} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer"></div>
              </div>
            </div>
          </PinContainer>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
        <span>Feature in active development</span>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}