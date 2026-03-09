import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, Animated, Alert, TextInput, Image, Modal
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { joinMatch, findMatchByCode } from '../../src/lib/api'
import { Match } from '../../src/types/game'
import { useTheme } from '../../src/context/ThemeContext'
import { useSession } from '../../src/hooks/useSession'
import { useGameStore } from '../../src/stores/useGameStore'

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

  const fetchMatches = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'waiting')
      .eq('is_private', false)
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
        <View style={s.cardTopRow}>
          <Text style={s.cardTitle}>{item.category ?? 'General'}</Text>
          <Ionicons name="heart-outline" size={28} color="#FFF" />
        </View>

        <View style={s.cardMiddle}>
          {/* The illustration placeholder space */}
        </View>

        <View style={s.cardPriceRow}>
          <Text style={s.cardPriceText}>{item.stake_amount}</Text>
          <Image source={require('../../assets/solana-icon.png')} style={[s.solanaIcon, { tintColor: '#fff' }]} />
        </View>

        <View style={s.cardBottomRow}>
          <View style={s.pillGroup}>
            <View style={s.pillBlack}>
              <Text style={s.pillBlackText}>☆ 4.8</Text>
            </View>
            <View style={s.pillBlack}>
              <Text style={s.pillBlackText}>{item.total_questions} Qs</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.joinBtn, isJoining && s.joinBtnDisabled]}
            onPress={() => handleJoin(item.id)}
            disabled={!!joining}
            activeOpacity={0.8}
          >
            {isJoining
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.joinBtnText}>JOIN</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>BATTLES</Text>
        </View>

        <View style={s.actionButtonsRow}>
          <TouchableOpacity
            style={[s.actionButton, s.joinMatchBtn]}
            onPress={() => setShowJoinInput(!showJoinInput)}
            activeOpacity={0.8}
          >
            <Text style={[s.actionButtonText, { color: theme.text }]}>Join Match</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionButton, s.createMatchBtn]}
            onPress={() => router.push('/create-match')}
            activeOpacity={0.8}
          >
            <Text style={s.actionButtonText}>Create Match</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showJoinInput}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowJoinInput(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Enter Match Code</Text>
              <TextInput
                style={s.modalInput}
                placeholder="6-DIGIT CODE"
                placeholderTextColor={theme.textSecondary}
                value={searchCode}
                onChangeText={(t) => setSearchCode(t.toUpperCase().slice(0, 6))}
                autoCapitalize="characters"
                maxLength={6}
                returnKeyType="search"
                onSubmitEditing={handleCodeSearch}
              />
              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowJoinInput(false)}>
                  <Text style={s.modalCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalJoinBtn, searchCode.length !== 6 && { opacity: 0.5 }]}
                  onPress={handleCodeSearch}
                  disabled={searching || searchCode.length !== 6}
                >
                  {searching ? <ActivityIndicator color="#fff" /> : <Text style={s.modalJoinText}>JOIN</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
    paddingTop: 16, paddingBottom: 16, paddingHorizontal: 24,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontFamily: 'CabinetGrotesk', fontSize: 28, color: theme.text, letterSpacing: 2 },
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
    fontFamily: 'CabinetGrotesk',
    color: "white",
    fontSize: 18,

    letterSpacing: 1,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: theme.surface, width: '100%', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border },
  modalTitle: { fontFamily: 'CabinetGrotesk', fontSize: 22, color: theme.text, marginBottom: 16, textAlign: 'center' },
  modalInput: { fontFamily: 'CabinetGrotesk', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 18, color: theme.text, fontSize: 24, letterSpacing: 6, textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, backgroundColor: theme.bg, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  modalCancelText: { fontFamily: 'CabinetGrotesk', color: theme.textSecondary, fontSize: 16 },
  modalJoinBtn: { flex: 1, backgroundColor: '#3B82F6', padding: 16, borderRadius: 16, alignItems: 'center' },
  modalJoinText: { fontFamily: 'CabinetGrotesk', color: '#fff', fontSize: 16, letterSpacing: 1 },

  list: { padding: 16, paddingBottom: 100 },

  // New Card Styles
  card: {
    backgroundColor: '#3B82F6', // Blue-500
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    minHeight: 200,
    justifyContent: 'space-between'
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontFamily: 'CabinetGrotesk', color: '#FFF', fontSize: 24, width: '70%' },

  cardMiddle: {
    height: 40,
  },

  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardPriceText: { fontFamily: 'CabinetGrotesk', color: '#FFF', fontSize: 42, letterSpacing: -1 },
  solanaIcon: { width: 32, height: 32, resizeMode: 'contain' },

  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pillGroup: { flexDirection: 'row', gap: 8 },
  pillBlack: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pillBlackText: { fontFamily: 'CabinetGrotesk', color: '#FFF', fontSize: 13 },

  joinBtn: { backgroundColor: '#fff', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  joinBtnDisabled: { opacity: 0.6 },
  joinBtnText: { fontFamily: 'CabinetGrotesk', color: '#3B82F6', fontSize: 16, letterSpacing: 1 },

  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontFamily: 'CabinetGrotesk', color: theme.text, fontSize: 24, marginBottom: 8 },
  emptySub: { fontFamily: 'CabinetGrotesk', color: theme.textSecondary, fontSize: 16 },
})
