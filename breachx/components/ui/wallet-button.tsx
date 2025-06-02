"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { WalletIcon, ChevronDown, ExternalLink, LogOut } from "lucide-react";
import { useState } from "react";
import { truncateAddress } from "@/lib/utils";
import Link from "next/link";

export function WalletButton() {
  const { publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [isOpen, setIsOpen] = useState(false);

  const handleConnectClick = () => {
    setVisible(true);
  };

  const handleDisconnect = () => {
    disconnect();
    setIsOpen(false);
  };

  if (!publicKey) {
    return (
      <Button 
        onClick={handleConnectClick}
        className="bg-gradient-to-r from-purple-600 to-blue-600 cursor-pointer text-white rounded-full px-4 h-9 shadow-md"
      >
        <WalletIcon className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  const walletAddress = publicKey.toString();

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          className="bg-gradient-to-r from-purple-600 to-blue-600 cursor-pointer text-white rounded-full px-3 h-9 flex items-center shadow-md"
        >
          <WalletIcon className="w-4 h-4 mr-2" />
          <span>{truncateAddress(walletAddress)}</span>
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-gray-900/95 backdrop-blur-md border border-gray-800 text-white rounded-xl shadow-xl p-1">
        <DropdownMenuItem className="cursor-default flex flex-col items-start py-2 px-3 rounded-lg">
          <span className="text-xs text-gray-400">Connected Wallet</span>
          <span className="font-mono text-sm mt-1 break-all">{walletAddress}</span>
        </DropdownMenuItem>
        <Link href="/reports" passHref className="w-full">
          <DropdownMenuItem className="flex items-center py-2 px-3 cursor-pointer hover:bg-gray-800/50 rounded-lg transition-colors duration-150">
            <ExternalLink className="w-4 h-4 mr-2" />
            <span>Vulnerability Reports</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuItem 
          className="flex items-center py-2 px-3 cursor-pointer hover:bg-gray-800/50 rounded-lg transition-colors duration-150 text-red-400"
          onClick={handleDisconnect}
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 