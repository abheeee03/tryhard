import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Animated, Alert, TextInput
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { joinMatch, findMatchByCode } from '../../src/lib/api'
import { Match } from '../../src/types/game'
import { useTheme } from '../../src/context/ThemeContext'
import { useSession } from '../../src/hooks/useSession'
import { useGameStore } from '../../src/stores/useGameStore'
import { useWallet } from '../../src/hooks/useWallet'
import { ConnectButton } from '../../src/components/ConnectButton'

export default function HomeTab() {
  const { theme } = useTheme()
  const { session } = useSession()
  const router = useRouter()
  const setMatchId = useGameStore((s) => s.setMatchId)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [searchCode, setSearchCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [showJoinInput, setShowJoinInput] = useState(false)
  
  const { connected, connecting, publicKey, connect, disconnect } = useWallet()

  const fetchMatches = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'waiting')
      .neq('player1_id', session?.user.id ?? '')
      .order('created_at', { ascending: false })
    setMatches((data as Match[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!session) return
    fetchMatches()
    const channel = supabase
      .channel('public:matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        fetchMatches()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session])

  const handleJoin = async (matchId: string) => {
    if (!session) return
    setJoining(matchId)
    const res = await joinMatch(session.access_token, matchId)
    setJoining(null)
    if (res.status === 'SUCCESS') {
      setMatchId(matchId, false)
      router.push('/waiting-room')
    } else {
      Alert.alert('Could not join', res.error ?? 'Unknown error')
    }
  }

  const handleCodeSearch = async () => {
    if (!session) return
    const code = searchCode.trim().toUpperCase()
    if (code.length !== 6) { Alert.alert('Invalid Code', 'Match code must be exactly 6 characters.'); return }
    setSearching(true)
    try {
      const res = await findMatchByCode(session.access_token, code)
      if (res.status === 'SUCCESS' && res.data?.match) {
        const match = res.data.match
        if (match.status === 'waiting') {
          handleJoin(match.id)
        } else if (match.player1_id === session.user.id || match.player2_id === session.user.id) {
          setMatchId(match.id, match.player1_id === session.user.id)
          router.push('/waiting-room')
        } else {
          Alert.alert('Match Unavailable', 'This match is no longer accepting players.')
        }
      } else {
        Alert.alert('Not Found', res.error ?? 'No match found with that code.')
      }
    } catch {
      Alert.alert('Error', 'Failed to search for match.')
    } finally {
      setSearching(false)
      setSearchCode('')
    }
  }

  const s = makeStyles(theme)

  const renderCard = ({ item }: { item: Match }) => {
    const isJoining = joining === item.id
    return (
      <View style={s.card}>
        <View style={s.cardRow}>
          <View style={s.categoryBadge}>
            <Text style={s.categoryText}>{item.category ?? 'General'}</Text>
          </View>
          <View style={[s.difficultyBadge]}>
            <Text style={[s.difficultyText, { color: '#A0A0B8' }]}>⚔</Text>
          </View>
          {item.stake_amount > 0 && (
            <View style={s.stakeBadge}>
              <Text style={s.stakeText}>💰 {item.stake_amount}</Text>
            </View>
          )}
        </View>
        <View style={s.cardMeta}>
          <MetaChip icon="❓" label={`${item.total_questions} Questions`} theme={theme} />
          <MetaChip icon="⏱" label={`${item.question_duration_seconds}s / Q`} theme={theme} />
        </View>
        <TouchableOpacity
          style={[s.joinBtn, isJoining && s.joinBtnDisabled]}
          onPress={() => handleJoin(item.id)}
          disabled={!!joining}
          activeOpacity={0.8}
        >
          {isJoining
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.joinBtnText}>JOIN BATTLE ⚔</Text>
          }
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <View style={s.header}>
          <ConnectButton
            connected={connected}
            connecting={connecting}
            publicKey={publicKey?.toBase58() || null}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </View>

        <View style={s.actionButtonsRow}>
          <TouchableOpacity 
            style={[s.actionButton, s.joinMatchBtn]} 
            onPress={() => setShowJoinInput(!showJoinInput)}
            activeOpacity={0.8}
          >
            <Text style={s.actionButtonText}>Join Match</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[s.actionButton, s.createMatchBtn]} 
            onPress={() => router.push('/create-match')}
            activeOpacity={0.8}
          >
            <Text style={s.actionButtonText}>Create Match</Text>
          </TouchableOpacity>
        </View>

        {showJoinInput && (
          <View style={s.searchBar}>
            <TextInput
              style={s.searchInput}
              placeholder="Enter 6-digit match code"
              placeholderTextColor={theme.textSecondary}
              value={searchCode}
              onChangeText={(t) => setSearchCode(t.toUpperCase().slice(0, 6))}
              autoCapitalize="characters"
              maxLength={6}
              returnKeyType="search"
              onSubmitEditing={handleCodeSearch}
            />
            <TouchableOpacity
              style={[s.searchBtn, searchCode.length !== 6 && { opacity: 0.5 }]}
              onPress={handleCodeSearch}
              disabled={searching || searchCode.length !== 6}
              activeOpacity={0.8}
            >
              {searching
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.searchBtnText}>JOIN</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={renderCard}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchMatches}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={s.emptyState}>
                <Text style={s.emptyIcon}>🎮</Text>
                <Text style={s.emptyTitle}>No Battles Yet</Text>
                <Text style={s.emptySub}>Be the first to create a match!</Text>
              </View>
            )
          }
        />
      </View>
    </SafeAreaView>
  )
}

function MetaChip({ icon, label, theme }: { icon: string; label: string; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginTop: 8 }}>
      <Text style={{ fontSize: 13 }}>{icon} </Text>
      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{label}</Text>
    </View>
  )
}

const makeStyles = (theme: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  container: { flex: 1, backgroundColor: theme.bg },
  header: {
    paddingTop: 16, paddingBottom: 16, paddingHorizontal: 24, flexWrap: "wrap",
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinMatchBtn: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  createMatchBtn: {
    backgroundColor: '#3B82F6', // theme.accent or blue-500
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  searchInput: {
    flex: 1, backgroundColor: theme.card, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, color: theme.text, fontSize: 16, fontWeight: '800',
    letterSpacing: 4, textAlign: 'center', borderWidth: 1, borderColor: theme.border,
  },
  searchBtn: {
    backgroundColor: theme.accent, borderRadius: 12, paddingHorizontal: 20,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: theme.surface, borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: theme.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 },
  categoryBadge: {
    backgroundColor: theme.accentSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryText: { color: theme.accent, fontWeight: '700', fontSize: 12 },
  difficultyBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  difficultyText: { fontWeight: '700', fontSize: 12 },
  stakeBadge: { backgroundColor: theme.card, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stakeText: { color: theme.text, fontSize: 12, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  joinBtn: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: theme.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: theme.textSecondary, fontSize: 14 },
})
