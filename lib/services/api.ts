import type { SimpleOrderbookResponse, AdvancedOrderbookResponse, Chain } from "@/lib/types/orderbook";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

export async function getSimpleOrderbook(chain: Chain, pool: string): Promise<SimpleOrderbookResponse> {
  return fetchAPI<SimpleOrderbookResponse>(`/api/orderbook?chain=${chain}&pool=${pool}&mode=simple`);
}

export async function getAdvancedOrderbook(chain: Chain, pool: string): Promise<AdvancedOrderbookResponse> {
  return fetchAPI<AdvancedOrderbookResponse>(`/api/orderbook?chain=${chain}&pool=${pool}&mode=advanced`);
}
