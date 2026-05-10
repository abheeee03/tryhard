"use client"
import React from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu'
import { Avatar, AvatarFallback } from './avatar'
import { useWallet } from '@solana/wallet-adapter-react'
import { LogOut, User } from 'lucide-react'

function UserDialog() {
  const { publicKey, disconnect } = useWallet();
  const base58 = publicKey?.toBase58();

  return (
    <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
            <Avatar size='lg' className="border-2 border-zinc-100 hover:border-zinc-300 transition-colors">
                <AvatarFallback className="bg-zinc-900 text-white font-bold">
                    {base58 ? base58.slice(0, 2).toUpperCase() : 'U'}
                </AvatarFallback>
            </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className="w-56 p-2 bg-white border-zinc-200 shadow-xl rounded-2xl mt-2">
            <div className="px-3 py-2 mb-2">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Connected Wallet</p>
                <p className="text-xs font-mono font-bold text-zinc-600 truncate mt-1">{base58}</p>
            </div>
            <DropdownMenuItem className='cursor-pointer flex items-center gap-2 p-3 rounded-xl hover:bg-zinc-50 focus:bg-zinc-50 transition-colors'>
                <User className="h-4 w-4 text-zinc-400" />
                <span className="font-bold text-zinc-700">Profile Settings</span>
            </DropdownMenuItem>
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