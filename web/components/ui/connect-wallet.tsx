"use client";

import React, { useState } from 'react';
import { useWallet, Wallet } from '@solana/wallet-adapter-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import Image from 'next/image';

export function ConnectWallet() {
  const { wallets, select, connected, disconnect, publicKey, wallet } = useWallet();
  const [open, setOpen] = useState(false);

  const handleConnect = async (walletName: Wallet['adapter']['name']) => {
    try {
      select(walletName);
      setOpen(false);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const base58 = publicKey?.toBase58();
  const content = base58 
    ? `${base58.slice(0, 4)}...${base58.slice(-4)}`
    : 'Connect Wallet';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full px-6 font-bold">
          {content}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white border-zinc-200">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-center mb-4">Connect Wallet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {wallets.length > 0 ? (
            wallets.map((w) => (
              <button
                key={w.adapter.name}
                onClick={() => handleConnect(w.adapter.name)}
                className="w-full group rounded-2xl border border-zinc-100 p-4 flex items-center justify-between hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-10 h-10 flex items-center justify-center bg-zinc-100 rounded-xl group-hover:bg-white transition-colors">
                    {w.adapter.icon && (
                      <img
                        src={w.adapter.icon}
                        alt={w.adapter.name}
                        className="w-6 h-6"
                      />
                    )}
                  </div>
                  <span className="text-lg font-bold text-zinc-700">
                    {w.adapter.name}
                  </span>
                </div>
                {w.readyState === 'Installed' && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">
                    Detected
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-zinc-500 font-medium">
              No wallets found. Please install a Solana wallet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConnectWallet;
