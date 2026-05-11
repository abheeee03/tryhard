"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Sun, Moon, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import Logo from "@/components/logo"
import UserDialog from "@/components/ui/user-dialog"
import { ConnectWallet } from "@/components/ui/connect-wallet"
import { useWallet } from "@solana/wallet-adapter-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"

export function Navbar() {
  const { setTheme, theme } = useTheme()
  const { publicKey } = useWallet()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="fixed w-full flex items-center justify-between px-6 md:px-10 py-4 backdrop-blur-md z-50 border-b border-border bg-background/80">
      <Link href="/home" className="flex gap-2 items-center justify-center text-lg font-bold text-foreground">
        <Logo /> tryhard
      </Link>
      
      <div className="flex items-center gap-2 md:gap-4">
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Laptop className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="">
          {publicKey ? <UserDialog /> : <ConnectWallet />}
        </div>
      </div>
    </nav>
  )
}
