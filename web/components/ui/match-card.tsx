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
    <Card className="border-zinc-200 overflow-hidden hover:border-zinc-400 transition-all group bg-white shadow-sm">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col flex-1 mr-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Room Name</span>
            <span className="text-lg font-black text-zinc-900 truncate">{match.name || match.inviteCode}</span>
          </div>
          <div className={cn(
            "text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-tighter border",
            match.status === 'WAITING' ? 'bg-amber-100 text-amber-700 border-amber-200' :
            match.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            'bg-zinc-100 text-zinc-600 border-zinc-200'
          )}>
            {match.status}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Stake</span>
            <span className="text-sm font-bold">{match.stakeAmount} SOL</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Players</span>
            <span className="text-sm font-bold">{match.players.length}/{match.totalPlayers}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 font-bold flex items-center gap-2">
                <Info className="w-4 h-4" /> Info
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-black">{match.name || match.inviteCode}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {match.summary && (
                  <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Topic Summary</p>
                    <p className="text-sm text-zinc-700 leading-relaxed italic">"{match.summary}"</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                    <div className="p-2 bg-white rounded-lg border border-zinc-200 shadow-sm">
                      <Coins className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Stake Amount</p>
                      <p className="font-black">{match.stakeAmount} SOL</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                    <div className="p-2 bg-white rounded-lg border border-zinc-200 shadow-sm">
                      <Users className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Players</p>
                      <p className="font-black">{match.players.length} / {match.totalPlayers}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                    <div className="p-2 bg-white rounded-lg border border-zinc-200 shadow-sm">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Questions</p>
                      <p className="font-black">{match.questionCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                    <div className="p-2 bg-white rounded-lg border border-zinc-200 shadow-sm">
                      <User className="w-4 h-4 text-zinc-600" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase">Creator</p>
                      <p className="font-black truncate">{match.creator.username || match.creator.wallet.slice(0, 4) + '...'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase px-1">Active Players</p>
                  <div className="flex flex-wrap gap-2">
                    {match.players.map((p, i) => (
                      <div key={i} className="px-3 py-1.5 rounded-full bg-zinc-100 text-xs font-bold border border-zinc-200">
                        {p.user.username || 'Anonymous'}
                      </div>
                    ))}
                    {match.players.length === 0 && <p className="text-xs text-zinc-400 italic px-1">No players joined yet</p>}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button 
                  onClick={() => onJoin(match.inviteCode)}
                  className="w-full bg-zinc-900 text-white font-bold h-12 text-lg"
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
              className="flex-[2] bg-zinc-900 text-white font-bold group-hover:bg-zinc-800 transition-colors"
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