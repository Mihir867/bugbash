"use client";

import { useEffect, useState } from "react";
import {
  useConnection,
  useWallet,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  getProgram,
  storeVulnerabilityReport,
  getUserVulnerabilityReports,
  ReportWithTransaction,
} from "@/lib/anchor-program";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  X,
  Sparkles,
  Zap,
  Rocket,
} from "lucide-react";
import { formatDate, getSolanaExplorerUrl, truncateAddress } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const shortenPdfUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);

    // If it's a pre-signed URL (has AWS signature parameters), return the original URL
    if (
      urlObj.search.includes("X-Amz-Signature") ||
      urlObj.search.includes("X-Amz-Credential") ||
      urlObj.search.includes("X-Amz-Algorithm")
    ) {
      return url;
    }

    // Handle different S3 URL formats for non-pre-signed URLs
    if (urlObj.hostname.includes("s3.amazonaws.com")) {
      // Format: https://bucket-name.s3.amazonaws.com/path/to/file.pdf
      const pathParts = urlObj.pathname.split("/").filter((part) => part);
      const fileName = pathParts[pathParts.length - 1];
      const bucketName = urlObj.hostname.split(".")[0];

      return `https://${bucketName}.s3.amazonaws.com/${fileName}${urlObj.search}`;
    } else if (urlObj.hostname.includes("amazonaws.com")) {
      // Format: https://s3.region.amazonaws.com/bucket/path/to/file.pdf
      const pathParts = urlObj.pathname.split("/").filter((part) => part);
      const fileName = pathParts[pathParts.length - 1];
      const bucketName = pathParts[0];

      return `https://${bucketName}.s3.amazonaws.com/${fileName}${urlObj.search}`;
    } else {
      // For other domains, just remove unnecessary path components
      const pathParts = urlObj.pathname.split("/");
      const fileName = pathParts[pathParts.length - 1];

      return `${urlObj.origin}/${fileName}${urlObj.search}`;
    }
  } catch (error) {
    console.error("Error shortening URL:", error);
    return url;
  }
};

const EnhancedPinContainer = ({
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="relative group/pin">
      <div
        className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-30 group-hover/pin:opacity-50 transition-all duration-700 animate-pulse"
        // style={{
        //   animation:
        //     "float 6s ease-in-out infinite, pulse 2s ease-in-out infinite alternate",
        // }}
      />
      <div className="relative z-10 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1 hover:border-white/20 transition-all duration-300 group-hover/pin:scale-105">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
};

const SuccessModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [activeBadge, setActiveBadge] = useState(0);
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; delay: number }>
  >([]);

  useEffect(() => {
    if (isOpen) {
      const newParticles = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
      }));
      setParticles(newParticles);
    }
  }, [isOpen]);

  const badges = [
    {
      title: "Report Stored Successfully",
      subtitle: "✅ Blockchain Verified",
      description:
        "Your vulnerability report has been securely stored on the Solana blockchain with immutable proof of submission.",
      icon: "🛡️",
      gradient: "from-emerald-400 via-green-500 to-teal-600",
      href: "#report-success",
      bgColor: "from-emerald-500/20 to-green-500/20",
    },
    {
      title: "NFT Generation",
      subtitle: "🚀 Coming Soon",
      description:
        "Transform your vulnerability reports into unique, tradeable NFTs with AI-powered generation and smart contract deployment.",
      icon: "🎨",
      gradient: "from-purple-400 via-pink-500 to-rose-600",
      href: "#nft-generation",
      bgColor: "from-purple-500/20 to-pink-500/20",
    },
    {
      title: "GitHub Integration",
      subtitle: "⚡ Coming Soon",
      description:
        "Seamless integration with GitHub repositories for automated vulnerability scanning and instant blockchain reporting.",
      icon: "🔗",
      gradient: "from-blue-400 via-cyan-500 to-teal-600",
      href: "#github-integration",
      bgColor: "from-blue-500/20 to-cyan-500/20",
    },
  ];

  const currentBadge = badges[activeBadge];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute w-1 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-ping opacity-30"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: "3s",
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-4xl mx-auto">
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 z-10 w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-200 shadow-lg"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="bg-gradient-to-br from-slate-900/95 to-black/95 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
              <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                Security Report on Solana
              </h2>
              <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
            </div>
            <p className="text-slate-400 text-lg">
              Your journey towards writing secure code
            </p>
          </div>

          <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 mb-8 justify-center">
            {badges.map((badge, index) => (
              <button
                key={index}
                onClick={() => setActiveBadge(index)}
                className={`
                  px-6 py-3 rounded-xl text-sm font-medium transition-all duration-500 relative overflow-hidden group
                  ${
                    activeBadge === index
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25 scale-105"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:scale-102"
                  }
                `}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {badge.icon}
                  <span className="hidden sm:inline">{badge.title}</span>
                </span>
                {activeBadge === index && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-20 animate-pulse" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            ))}
          </div>

          <div className="relative">
            <EnhancedPinContainer
              title={currentBadge.href}
              href={currentBadge.href}
            >
              <div className="w-full h-80 relative overflow-hidden">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${currentBadge.bgColor} rounded-xl`}
                />

                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-4 left-4 w-2 h-2 bg-white/40 rounded-full animate-ping opacity-50"></div>
                  <div className="absolute top-12 right-8 w-1 h-1 bg-white/30 rounded-full animate-ping opacity-40 delay-1000"></div>
                  <div className="absolute bottom-16 left-8 w-1.5 h-1.5 bg-white/20 rounded-full animate-ping opacity-30 delay-500"></div>
                  <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-white/10 rounded-full animate-bounce opacity-20"></div>
                </div>

                <div className="relative z-10 p-6 h-full flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-6xl filter drop-shadow-lg">
                      {currentBadge.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {currentBadge.title}
                      </h3>
                      <div
                        className={`
                        px-4 py-2 rounded-full text-sm font-semibold inline-block
                        ${
                          activeBadge === 0
                            ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                            : "bg-gradient-to-r from-yellow-400 to-orange-500 text-black"
                        }
                      `}
                      >
                        {currentBadge.subtitle}
                      </div>
                    </div>
                  </div>

                  <p className="text-white/90 text-base leading-relaxed mb-6 flex-1">
                    {currentBadge.description}
                  </p>

                  <div className="mt-auto">
                    <div className="flex justify-between text-sm text-white/70 mb-3">
                      <span>
                        {activeBadge === 0
                          ? "Verification Status"
                          : "Development Progress"}
                      </span>
                      <span className="font-semibold">
                        {activeBadge === 0 ? "100%" : "75%"}
                      </span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-1000 ${
                          activeBadge === 0
                            ? "bg-gradient-to-r from-green-400 to-emerald-500 w-full"
                            : "bg-gradient-to-r from-purple-400 to-blue-500 w-3/4"
                        }`}
                      >
                        <div className="h-full bg-gradient-to-r from-white/20 via-white/40 to-white/20 animate-shimmer" />
                      </div>
                    </div>
                  </div>
                </div>

                {activeBadge === 0 && (
                  <div className="absolute top-4 right-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center animate-pulse">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </EnhancedPinContainer>
          </div>

          <div className="flex items-center justify-center gap-3 mt-8 text-sm">
            <div
              className={`w-3 h-3 rounded-full animate-pulse ${
                activeBadge === 0 ? "bg-green-500" : "bg-orange-500"
              }`}
            ></div>
            <span className="text-slate-300 font-medium">
              {activeBadge === 0
                ? "Report successfully stored on Solana blockchain"
                : "Feature in active development"}
            </span>
            {activeBadge !== 0 && (
              <Rocket className="w-4 h-4 text-orange-400 animate-bounce" />
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

interface PageProps {
  searchParams: Promise<{
    pdfUrl?: string;
    repoUrl?: string;
  }>;
}

export default function DemoPage({ searchParams }: PageProps) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [loading, setLoading] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);
  const [storingReport, setStoringReport] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [userReports, setUserReports] = useState<ReportWithTransaction[]>([]);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [repositoryId, setRepositoryId] = useState<string>("");
  const [fullReportUrl, setFullReportUrl] = useState<string>("");
  const [reportUrl, setReportUrl] = useState<string>("");

  useEffect(() => {
    async function loadUserReports() {
      if (!publicKey || !connected) {
        setUserReports([]);
        setProgramError(null);
        return;
      }

      setLoading(true);
      setProgramError(null);

      try {
        const program = await getProgram(wallet, connection);

        if (!program) {
          setProgramError("Failed to initialize Anchor program");
          return;
        }

        const reports = await getUserVulnerabilityReports(program, publicKey);
        setUserReports(reports);
      } catch (error) {
        console.error("Error loading user reports:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        setProgramError(`Failed to load reports: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    loadUserReports();
  }, [publicKey, wallet, connection, txSignature, connected]);

  useEffect(() => {
    async function handleSearchParams() {
      try {
        const params = await searchParams;

        if (params?.repoUrl) {
          setRepositoryId(decodeURIComponent(params.repoUrl));
        }

        if (params?.pdfUrl) {
          const decodedUrl = decodeURIComponent(params.pdfUrl);
          setFullReportUrl(decodedUrl);
          setReportUrl(shortenPdfUrl(decodedUrl));
        }
      } catch (error) {
        console.error("Error handling search params:", error);
      }
    }

    handleSearchParams();
  }, [searchParams]);

  const handleStoreReport = async () => {
    if (!publicKey || !connected) {
      alert("Please connect your wallet first");
      return;
    }

    if (!repositoryId.trim()) {
      alert("Repository URL is required");
      return;
    }

    if (!fullReportUrl.trim()) {
      alert("PDF Report URL is required");
      return;
    }

    setStoringReport(true);
    setProgramError(null);

    try {
      const program = await getProgram(wallet, connection);

      if (!program) {
        throw new Error("Failed to initialize Anchor program");
      }

      const { tx } = await storeVulnerabilityReport(
        program,
        repositoryId,
        reportUrl
      );
      setTxSignature(tx);

      setRepositoryId("");
      setFullReportUrl("");
      setReportUrl("");

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const reports = await getUserVulnerabilityReports(program, publicKey);
      setUserReports(reports);

      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error storing report:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setProgramError(`Failed to store report: ${errorMessage}`);
      alert("Failed to store report. Please try again.");
    } finally {
      setStoringReport(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedTxId(text);
        setCopySuccess(`${type} copied!`);

        setTimeout(() => {
          setCopySuccess(null);
          setCopiedTxId(null);
        }, 2000);
      },
      () => {
        setCopySuccess("Failed to copy");
        setTimeout(() => setCopySuccess(null), 2000);
      }
    );
  };

  return (
    <div className="min-h-screen py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="relative mb-6">
            <ShieldAlert className="h-16 w-16 text-purple-500 animate-pulse" />
            <div className="absolute inset-0 h-16 w-16 bg-purple-500/20 rounded-full animate-ping" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
            Zero-Day Vulnerability Reports
          </h1>
          <div className="h-1 w-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full mb-4" />
          <p className="mt-4 text-gray-300 text-center max-w-2xl text-lg">
            Store your vulnerability reports securely on the Solana blockchain.
            Each report is tied to a specific repository ID, allowing you to
            maintain multiple security findings per wallet.
          </p>
        </div>

        {programError && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-800 rounded-lg backdrop-blur-sm">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <div>
                <h3 className="text-red-400 font-medium">Error</h3>
                <p className="text-red-300 text-sm">{programError}</p>
              </div>
            </div>
          </div>
        )}

        {copySuccess && (
          <div className="fixed bottom-4 right-4 bg-green-900/90 text-green-100 px-4 py-2 rounded-md shadow-lg animate-fade-in-out backdrop-blur-sm">
            {copySuccess}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-gray-900/60 border border-gray-700/50 shadow-xl backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Zap className="w-6 h-6 text-yellow-400" />
                Store New Report
              </CardTitle>
              <CardDescription>
                Add a new vulnerability report to the Solana blockchain
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!connected ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4 animate-bounce" />
                  <p className="text-center text-gray-400 mb-4">
                    Please connect your wallet to store a vulnerability report
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white" htmlFor="repositoryId">
                      Repository URL
                    </Label>
                    <Input
                      id="repositoryId"
                      placeholder="e.g., https://github.com/user/repo"
                      value={repositoryId}
                      readOnly
                      className="bg-gray-950/50 border-gray-800 text-white cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white" htmlFor="reportUrl">
                      PDF Report URL
                    </Label>
                    <Input
                      id="reportUrl"
                      placeholder="https://example.com/vulnerability-report.pdf"
                      value={reportUrl}
                      readOnly
                      className="bg-gray-950/50 border-gray-800 text-white cursor-not-allowed"
                    />
                  </div>

                  <div className="bg-gray-950/60 rounded-lg p-4 border border-gray-800/60">
                    <p className="text-sm text-gray-400">
                      <span className="text-yellow-500">Note:</span> The PDF
                      report URL has been simplified for display. The full URL
                      will be stored on the blockchain.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleStoreReport}
                disabled={!connected || storingReport}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-md transition-all duration-300 hover:scale-105"
              >
                {storingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Storing Report...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Store Report
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-gray-900/60 border border-gray-700/50 shadow-xl backdrop-blur-sm hover:border-gray-600/50 transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-green-400" />
                Your Reports
              </CardTitle>
              <CardDescription>
                View your stored vulnerability reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : !connected ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4 animate-bounce" />
                  <p className="text-center text-gray-400">
                    Connect your wallet to view your reports
                  </p>
                </div>
              ) : userReports.length > 0 ? (
                <div className="space-y-4">
                  {userReports.map((reportItem, index) => (
                    <div
                      key={index}
                      className="bg-gray-950/70 rounded-lg p-4 border border-gray-800/60 hover:border-gray-700/60 transition-all duration-300 hover:scale-102"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs text-gray-500">
                          Repository ID
                        </span>
                        <div className="px-2 py-1 bg-purple-900/40 rounded-full text-purple-400 text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified on Solana
                        </div>
                      </div>

                      <div className="text-lg font-medium text-white mb-2">
                        {reportItem.report.repositoryId}
                      </div>

                      <a
                        href={reportItem.report.reportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-medium text-blue-400 hover:underline hover:text-blue-300 transition-colors break-all leading-relaxed block"
                      >
                        <span className="break-all">
                          {reportItem.report.reportUrl}
                        </span>
                        <ExternalLink className="ml-2 h-4 w-4 inline-block flex-shrink-0" />
                      </a>

                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Submitted by:</span>
                          <span className="text-gray-300 font-mono">
                            {truncateAddress(
                              reportItem.report.reporter.toString()
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Timestamp:</span>
                          <span className="text-gray-300">
                            {formatDate(
                              new Date(
                                reportItem.report.timestamp.toNumber() * 1000
                              )
                            )}
                          </span>
                        </div>

                        {reportItem.transactionId && (
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-gray-400">
                              Transaction ID:
                            </span>
                            <div className="flex items-center">
                              <Link
                                href={getSolanaExplorerUrl(
                                  reportItem.transactionId
                                )}
                                target="_blank"
                                className="text-blue-400 hover:text-blue-300 font-mono text-xs truncate max-w-32 sm:max-w-48 md:max-w-32 lg:max-w-48 transition-colors"
                              >
                                {truncateAddress(reportItem.transactionId)}
                                <ExternalLink className="inline ml-1 h-3 w-3" />
                              </Link>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    reportItem.transactionId!,
                                    "Transaction ID"
                                  )
                                }
                                className="ml-2 text-gray-400 hover:text-white transition-colors"
                                title="Copy Transaction ID"
                              >
                                {copiedTxId === reportItem.transactionId ? (
                                  <Check className="h-3 w-3 text-green-400" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                  <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                    <ShieldAlert className="w-12 h-12 text-gray-500" />
                  </div>
                  <p className="text-center text-gray-400">
                    No vulnerability reports found for this wallet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {txSignature && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              Recent Transaction
            </h2>
            <Card className="bg-gray-900/60 border border-gray-700/50 shadow-xl overflow-hidden backdrop-blur-sm">
              <div className="p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-white">
                      Transaction Confirmed
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={getSolanaExplorerUrl(txSignature)}
                      target="_blank"
                      className="flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View on Explorer
                    </Link>
                    <button
                      onClick={() =>
                        copyToClipboard(txSignature, "Transaction ID")
                      }
                      className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
                      title="Copy Transaction ID"
                    >
                      {copiedTxId === txSignature ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="font-mono text-xs text-gray-400 break-all bg-gray-950/50 p-3 rounded-lg">
                  {txSignature}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
    </div>
  );
}
