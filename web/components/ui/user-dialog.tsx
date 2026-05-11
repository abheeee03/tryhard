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
            <Avatar size='lg' className="border-2 border-border hover:border-border transition-colors">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                    {user?.username ? user.username.slice(0, 2).toUpperCase() : (base58 ? base58.slice(0, 2).toUpperCase() : 'U')}
                </AvatarFallback>
            </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className="w-56 p-2 bg-popover border-border shadow-xl rounded-2xl mt-2">
            <Link href="/profile">
              <div className="px-3 py-2 mb-2 hover:bg-muted rounded-xl transition-colors cursor-pointer group">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest group-hover:text-foreground/70">
                    {user?.username ? "Connected as" : "Connected Wallet"}
                  </p>
                  <p className="text-xs font-mono font-bold text-muted-foreground truncate mt-1 group-hover:text-foreground">
                    {user?.username ?? base58}
                  </p>
              </div>
            </Link>
            <Link href="/profile">
                <DropdownMenuItem className='cursor-pointer flex items-center gap-2 p-3 rounded-xl hover:bg-muted focus:bg-muted transition-colors'>
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold text-foreground/80">Profile</span>
                </DropdownMenuItem>
            </Link>
            <DropdownMenuItem 
                onClick={() => disconnect()}
                className='cursor-pointer flex items-center gap-2 p-3 rounded-xl hover:bg-destructive/10 focus:bg-destructive/10 text-destructive transition-colors'
            >
                <LogOut className="h-4 w-4" />
                <span className="font-bold">Disconnect</span>
            </DropdownMenuItem>
        </DropdownMenuContent>        
    </DropdownMenu>
  )
}

export default UserDialog