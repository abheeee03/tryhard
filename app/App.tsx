import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { Session } from '@supabase/supabase-js'
import Auth from './components/Auth'
import HomeTab from './screens/HomeTab'
import AccountTab from './screens/AccountTab'
import CreateMatch from './screens/CreateMatch'
import WaitingRoom from './screens/WaitingRoom'
import Game from './screens/Game'
import Result from './screens/Result'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { Match, MatchQuestion } from './types/game'

type Screen =
  | 'tabs'
  | 'createMatch'
  | 'waitingRoom'
  | 'game'
  | 'result'

type NavParams = {
  matchId?: string
  isPlayer1?: boolean
  questions?: MatchQuestion[]
  match?: Match
}

function TabBar({ activeTab, onSelect, theme }: { activeTab: string; onSelect: (t: string) => void; theme: any }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: '⚔' },
    { id: 'account', label: 'Account', icon: '👤' },
  ]
  return (
    <View style={[tabBarStyles.bar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id
        return (
          <TouchableOpacity
            key={tab.id}
            style={tabBarStyles.tabItem}
            onPress={() => onSelect(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[tabBarStyles.icon, { opacity: active ? 1 : 0.45 }]}>{tab.icon}</Text>
            <Text style={[tabBarStyles.label, { color: active ? theme.accent : theme.textSecondary }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const tabBarStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 24,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  icon: { fontSize: 22 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
})

function AppInner() {
  const { theme } = useTheme()
  const [session, setSession] = useState<Session | null>(null)
  const [screen, setScreen] = useState<Screen>('tabs')
  const [params, setParams] = useState<NavParams>({})
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  const navigate = (s: string, p: NavParams = {}) => {
    setScreen(s as Screen)
    setParams(p)
  }

  if (!session) return <Auth />

  // Full-screen game flow screens
  if (screen === 'createMatch') {
    return (
      <CreateMatch
        session={session}
        onNavigate={navigate}
        onBack={() => navigate('tabs')}
      />
    )
  }
  if (screen === 'waitingRoom' && params.matchId) {
    return (
      <WaitingRoom
        session={session}
        matchId={params.matchId}
        isPlayer1={params.isPlayer1 ?? true}
        onNavigate={navigate}
        onBack={() => navigate('tabs')}
      />
    )
  }
  if (screen === 'game' && params.matchId && params.questions && params.match) {
    return (
      <Game
        session={session}
        matchId={params.matchId}
        questions={params.questions}
        initialMatch={params.match}
        onNavigate={navigate}
      />
    )
  }
  if (screen === 'result' && params.matchId) {
    return (
      <Result
        session={session}
        matchId={params.matchId}
        onNavigate={navigate}
      />
    )
  }

  // Tab layout
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1 }}>
        {activeTab === 'home'
          ? <HomeTab session={session} onNavigate={navigate} />
          : <AccountTab session={session} />
        }
      </View>
      <TabBar activeTab={activeTab} onSelect={setActiveTab} theme={theme} />
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}