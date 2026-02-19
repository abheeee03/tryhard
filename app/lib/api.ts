const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8080';

async function apiRequest(path: string, method: string, body?: object, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = token;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

export const createMatch = (
    token: string,
    payload: { time_per_que: number; category: string; total_questions: number; stake_amount: number; difficulty: string }
) => apiRequest('/api/match/create', 'POST', payload, token);

export const joinMatch = (token: string, matchId: string) =>
    apiRequest(`/api/match/${matchId}/join`, 'POST', {}, token);

export const startMatch = (token: string, matchId: string) =>
    apiRequest(`/api/match/${matchId}/start`, 'POST', {}, token);

export const submitAnswer = (
    token: string,
    matchId: string,
    payload: { answer: number; question_id: string }
) => apiRequest(`/api/match/${matchId}/submit`, 'POST', payload, token);
