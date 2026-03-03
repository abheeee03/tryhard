import { useCallback, useState } from 'react'
import {
    transact,
    Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import {
    Connection,
    PublicKey,
    clusterApiUrl,
} from '@solana/web3.js'
import { useWalletStore } from '../stores/walletStore'

const APP_IDENTITY = {
    name: 'TryHard',
    uri: 'https://tryhard.gg',
    icon: 'favicon.ico',
}

export function useWallet() {
    const [connecting, setConnecting] = useState(false)
    const { publicKey, balance, isDevnet, setPublicKey, setBalance, disconnect: storeDisconnect } = useWalletStore()

    const cluster = isDevnet ? 'devnet' : 'mainnet-beta'
    const connection = new Connection(clusterApiUrl(cluster as any), 'confirmed')

    // ─── Connect ──────────────────────────────────────────────────────────────
    const connect = useCallback(async (): Promise<PublicKey> => {
        setConnecting(true)
        try {
            const authResult = await transact(async (wallet: Web3MobileWallet) => {
                return wallet.authorize({
                    chain: `solana:${cluster}`,
                    identity: APP_IDENTITY,
                })
            })

            // authResult.accounts[0].address is base64-encoded public key
            const pubkey = new PublicKey(
                Buffer.from(authResult.accounts[0].address, 'base64')
            )
            setPublicKey(pubkey)

            // Fetch balance immediately after connecting
            try {
                const bal = await connection.getBalance(pubkey)
                setBalance(bal / 1_000_000_000)
            } catch {
                setBalance(0)
            }

            return pubkey
        } catch (err: any) {
            console.error('[useWallet] connect failed:', err)
            throw err
        } finally {
            setConnecting(false)
        }
    }, [cluster, connection])

    // ─── Disconnect ───────────────────────────────────────────────────────────
    const disconnect = useCallback(() => {
        storeDisconnect()
    }, [storeDisconnect])

    // ─── Refresh Balance ──────────────────────────────────────────────────────
    const refreshBalance = useCallback(async () => {
        if (!publicKey) return
        try {
            const bal = await connection.getBalance(publicKey)
            setBalance(bal / 1_000_000_000)
        } catch (err) {
            console.error('[useWallet] getBalance failed:', err)
        }
    }, [publicKey, connection])

    return {
        publicKey,
        balance,
        connected: !!publicKey,
        connecting,
        connect,
        disconnect,
        refreshBalance,
        isDevnet,
        cluster,
        connection,
    }
}
