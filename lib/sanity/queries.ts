import "server-only";
import { groq } from "next-sanity";
import { client } from "./client";

export interface LoggedQuery {
  _id: string;
  question: string;
  /** Which part of the subscription setup: frequency, discount, products and so on. */
  topic: string | null;
  answer: unknown[] | null;
  raisedAt: string;
  /** How many clients have raised it. */
  raisedCount: number | null;
  source: "merchant" | "team" | null;
  status?: string;
  storeId?: string | null;
}

export interface PlanRec {
  _key: string;
  label: string;
  scope: "products" | "collection" | "all";
  scopeDetail: string | null;
  everyDays: number;
  deliveries: number;
  discountPct: number;
  unitPrice: number | null;
  mode: "prepaid" | "payg" | "autopay";
  rationale: string | null;
}

export interface StepState {
  step: string;
  done: boolean;
  at: string | null;
  by: string | null;
  note: string | null;
}

export interface StoreRecord {
  _id: string;
  name: string;
  slug: string;
  stage: string;
  intro: string | null;
  recommendations: PlanRec[] | null;
  widgetSettings: string | null;
  progress: StepState[] | null;
}

const CACHE = { next: { revalidate: 60, tags: ["help"] } };

/** Only answered queries are public. One sitting unanswered is an internal to-do, not
 *  content, and publishing it would tell a client we have their question and no reply. */
export const ANSWERED = groq`
  *[_type == "merchantQuery" && status == "answered" && defined(answer)
    && (!defined(store) || store._ref == $storeId)]
    | order(coalesce(raisedCount, 1) desc, raisedAt desc) {
      _id, question, topic, answer, raisedAt, raisedCount, source
    }
`;

/** What this client still has to answer before their plans can be curated. */
export const OPEN_FOR_STORE = groq`
  *[_type == "merchantQuery" && status == "new" && store._ref == $storeId]
    | order(raisedAt asc) { _id, question, topic, raisedAt, raisedCount, source }
`;

export const STORE_BY_SLUG = groq`
  *[_type == "store" && slug.current == $slug][0]{
    _id, name, "slug": slug.current, stage, intro,
    recommendations[]{ _key, label, scope, scopeDetail, everyDays, deliveries, discountPct, unitPrice, mode, rationale },
    widgetSettings, progress[]{ step, done, at, by, note }
  }
`;

export const ALL_STORES = groq`
  *[_type == "store"] | order(name asc) {
    _id, name, "slug": slug.current, stage,
    recommendations[]{ _key }, progress[]{ step, done }
  }
`;

export async function fetchAnswered(storeId: string | null = null): Promise<LoggedQuery[]> {
  if (!client) return [];
  try { return await client.fetch<LoggedQuery[]>(ANSWERED, { storeId }, CACHE); }
  catch { return []; }
}

export async function fetchStore(slug: string): Promise<StoreRecord | null> {
  if (!client) return null;
  try { return await client.fetch<StoreRecord | null>(STORE_BY_SLUG, { slug }, CACHE); }
  catch { return null; }
}

export async function fetchOpenQueries(storeId: string): Promise<LoggedQuery[]> {
  if (!client) return [];
  try { return await client.fetch<LoggedQuery[]>(OPEN_FOR_STORE, { storeId }, CACHE); }
  catch { return []; }
}

export interface StoreSummary {
  _id: string; name: string; slug: string; stage: string;
  recommendations: { _key: string }[] | null;
  progress: { step: string; done: boolean }[] | null;
}

export async function fetchStores(): Promise<StoreSummary[]> {
  if (!client) return [];
  try { return await client.fetch<StoreSummary[]>(ALL_STORES, {}, { next: { revalidate: 30, tags: ["help"] } }); }
  catch { return []; }
}
