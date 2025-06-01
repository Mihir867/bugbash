import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo") || "Repository";

  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffd700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ffb347;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="400" height="400" fill="url(#bgGradient)" rx="20"/>
      
      <!-- Border -->
      <rect x="10" y="10" width="380" height="380" fill="none" stroke="#ffffff" stroke-width="2" rx="15"/>
      
      <!-- Shield Icon -->
      <g transform="translate(200,120)">
        <path d="M0,-50 L40,-30 L40,20 L20,40 L0,50 L-20,40 L-40,20 L-40,-30 Z" 
              fill="url(#shieldGradient)" stroke="#ffffff" stroke-width="2"/>
        <path d="M0,-30 L20,-20 L20,10 L10,20 L0,25 L-10,20 L-20,10 L-20,-20 Z" 
              fill="#ffffff" opacity="0.3"/>
        <!-- Checkmark -->
        <path d="M-15,0 L-5,10 L15,-10" stroke="#ffffff" stroke-width="4" 
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
      
      <!-- BreachX Logo Text -->
      <text x="200" y="220" font-family="Arial, sans-serif" font-size="24" font-weight="bold" 
            text-anchor="middle" fill="#ffffff">BreachX</text>
      
      <!-- Security Badge Text -->
      <text x="200" y="250" font-family="Arial, sans-serif" font-size="16" font-weight="normal" 
            text-anchor="middle" fill="#ffffff" opacity="0.9">Security Badge</text>
      
      <!-- Repository Name -->
      <text x="200" y="290" font-family="Arial, sans-serif" font-size="14" font-weight="normal" 
            text-anchor="middle" fill="#ffffff" opacity="0.8">${repo}</text>
      
      <!-- Verified Text -->
      <text x="200" y="320" font-family="Arial, sans-serif" font-size="12" font-weight="normal" 
            text-anchor="middle" fill="#00ff88">✓ VERIFIED ON SOLANA</text>
      
      <!-- Decorative Elements -->
      <circle cx="80" cy="80" r="3" fill="#ffffff" opacity="0.6"/>
      <circle cx="320" cy="80" r="3" fill="#ffffff" opacity="0.6"/>
      <circle cx="80" cy="320" r="3" fill="#ffffff" opacity="0.6"/>
      <circle cx="320" cy="320" r="3" fill="#ffffff" opacity="0.6"/>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
