import React from 'react'
import { Card } from './card'
import { Button } from './button'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from './dialog'
import { Info, Users, Coins, HelpCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MatchCardProps {
  match: {
    id: string;
    inviteCode: string;
    name: string | null;
    summary: string | null;
    status: string;
    stakeAmount: number;
    totalPlayers: number;
    questionCount: number;
    creator: { username: string | null; wallet: string };
    players: { userId: string; score: number; user: { username: string | null } }[];
  };
  onJoin: (inviteCode: string) => void;
}

function MatchCard({ match, onJoin }: MatchCardProps) {
  return (
    <Card className="border-border overflow-hidden hover:border-primary/50 transition-all group bg-card shadow-sm">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col flex-1 mr-2">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Room Name</span>
            <span className="text-lg font-black text-foreground truncate">{match.name || match.inviteCode}</span>
          </div>
          <div className={cn(
            "text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-tighter border",
            match.status === 'WAITING' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
            match.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
            'bg-muted text-muted-foreground border-border'
          )}>
            {match.status}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Stake</span>
            <span className="text-sm font-bold text-foreground">{match.stakeAmount} SOL</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Players</span>
            <span className="text-sm font-bold text-foreground">{match.players.length}/{match.totalPlayers}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 font-bold flex items-center gap-2">
                <Info className="w-4 h-4" /> Info
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-popover text-popover-foreground">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">{match.name || match.inviteCode}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {match.summary && (
                  <div className="bg-muted/50 border border-border rounded-xl p-4">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-2">Topic Summary</p>
                    <p className="text-sm text-foreground leading-relaxed italic">"{match.summary}"</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    <div className="p-2 bg-background rounded-lg border border-border shadow-sm">
                      <Coins className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Stake Amount</p>
                      <p className="font-black text-foreground">{match.stakeAmount} SOL</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    <div className="p-2 bg-background rounded-lg border border-border shadow-sm">
                      <Users className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Players</p>
                      <p className="font-black text-foreground">{match.players.length} / {match.totalPlayers}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    <div className="p-2 bg-background rounded-lg border border-border shadow-sm">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Questions</p>
                      <p className="font-black text-foreground">{match.questionCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                    <div className="p-2 bg-background rounded-lg border border-border shadow-sm">
                      <User className="w-4 h-4 text-foreground/60" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">Creator</p>
                      <p className="font-black truncate text-foreground">{match.creator.username || match.creator.wallet.slice(0, 4) + '...'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase px-1">Active Players</p>
                  <div className="flex flex-wrap gap-2">
                    {match.players.map((p, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-full bg-muted text-xs font-bold border border-border text-foreground">
                        {p.user.username || 'Anonymous'}
                      </div>
                    ))}
                    {match.players.length === 0 && <p className="text-xs text-muted-foreground italic px-1">No players joined yet</p>}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  onClick={() => onJoin(match.inviteCode)}
                  className="w-full font-bold h-12 text-lg"
                  disabled={match.status !== 'WAITING'}
                >
                  {match.status === 'WAITING' ? 'Join Match' : 'Room Closed'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {match.status === 'WAITING' ? (
            <Button 
              onClick={() => onJoin(match.inviteCode)}
              className="flex-[2] font-bold"
            >
              Join Match
            </Button>
          ) : (
            <Button variant="outline" disabled className="flex-[2] font-bold">
              {match.status}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export default MatchCard