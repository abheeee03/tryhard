"use client"
import React from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'
import { Avatar, AvatarFallback } from './avatar'
import { useWallet } from '@solana/wallet-adapter-react'
import { LogOut, User } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

type UserRecord = {
  id: string;
  wallet: string;
  username: string | null;
};

type EnsureUserResponse =
  | { status: "SUCCESS"; data: { user: UserRecord } }
  | { status: "FAILED"; error: string };

function UserDialog() {
  const { publicKey, disconnect } = useWallet();
  const base58 = publicKey?.toBase58();
  const [user, setUser] = useState<UserRecord | null>(null);

  useEffect(() => {
    if (!base58) {
      setUser(null);
      return;
    }

    const ensureUser = async () => {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: base58 }),
        });
        const data = (await response.json()) as EnsureUserResponse;
        if (data.status === "SUCCESS") {
          setUser(data.data.user);
        }
      } catch (error) {
        console.error("Failed to fetch user in dialog", error);
      }
    };

    ensureUser();
  }, [base58]);

  return (
    <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
            <Avatar size='lg' className="border-2 border-zinc-100 hover:border-zinc-300 transition-colors">
                <AvatarFallback className="bg-zinc-900 text-white font-bold">
                    {user?.username ? user.username.slice(0, 2).toUpperCase() : (base58 ? base58.slice(0, 2).toUpperCase() : 'U')}
                </AvatarFallback>
            </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className="w-56 p-2 bg-white border-zinc-200 shadow-xl rounded-2xl mt-2">
            <Link href="/profile">
              <div className="px-3 py-2 mb-2 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer group">
                  <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest group-hover:text-zinc-500">
                    {user?.username ? "Connected as" : "Connected Wallet"}
                  </p>
                  <p className="text-xs font-mono font-bold text-zinc-600 truncate mt-1 group-hover:text-zinc-900">
                    {user?.username ?? base58}
                  </p>
              </div>
            </Link>
            <Link href="/profile">
                <DropdownMenuItem className='cursor-pointer flex items-center gap-2 p-3 rounded-xl hover:bg-zinc-50 focus:bg-zinc-50 transition-colors'>
                    <User className="h-4 w-4 text-zinc-400" />
                    <span className="font-bold text-zinc-700">Profile</span>
                </DropdownMenuItem>
            </Link>
            <DropdownMenuItem 
                onClick={() => disconnect()}
                className='cursor-pointer flex items-center gap-2 p-3 rounded-xl hover:bg-red-50 focus:bg-red-50 text-red-600 transition-colors'
            >
                <LogOut className="h-4 w-4" />
                <span className="font-bold">Disconnect</span>
            </DropdownMenuItem>
        </DropdownMenuContent>        
    </DropdownMenu>
  )
}

export default UserDialog