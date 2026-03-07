const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';

async function apiRequest(path: string, method: string, body?: object, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = token;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    
    const text = await res.text();
    
    if (!text) {
        throw new Error(`Empty response from server (${res.status} ${res.statusText})`);
    }
    
    try {
        const json = JSON.parse(text);
        if (json.status === 'FAILED') {
            throw new Error(json.error || 'Request failed');
        }
        return json;
    } catch (e) {
        if (e instanceof SyntaxError) {
            throw new Error(`Server returned non-JSON: ${text.substring(0, 100)}`);
        }
        throw e;
    }
}

export const createMatch = (
    token: string,
    payload: {
        time_per_que: number;
        category: string;
        total_questions: number;
        stake_amount: number;
        difficulty: string;
        player1_wallet?: string | null;
    }
) => apiRequest('/api/match/create', 'POST', payload, token);

export const joinMatch = (token: string, matchId: string, player2_wallet?: string | null) =>
    apiRequest(`/api/match/${matchId}/join`, 'POST', { player2_wallet }, token);

export const startMatch = (token: string, matchId: string) =>
    apiRequest(`/api/match/${matchId}/start`, 'POST', {}, token);

export const submitAnswer = (
    token: string,
    matchId: string,
    payload: { answer: number; question_id: string }
) => apiRequest(`/api/match/${matchId}/submit`, 'POST', payload, token);

export const findMatchByCode = (token: string, code: string) =>
    apiRequest(`/api/match/code/${code}`, 'GET', undefined, token);

export const confirmDeposit = (
    token: string,
    matchId: string,
    txSignature: string,
    role: 'player1' | 'player2'
) => apiRequest(`/api/payment/${matchId}/confirm-deposit`, 'POST', { txSignature, role }, token);

