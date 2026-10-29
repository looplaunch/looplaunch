/**
 * Intelligence Store — Supabase persistent storage with in-memory caching.
 *
 * "Research Once, Answer Many Times"
 *
 * Persists all onboarding intelligence, SWOT diagnosis, market research,
 * and chat history to Supabase Postgres (sessions table).
 * Falls back gracefully to in-memory cache if Supabase is offline.
 */

import type {
  IntelligenceSession,
  PipelineStatus,
  ChatMessage,
  OnboardingInput,
  CompanyIntelligence,
  CompetitorIntelligence,
  MarketIntelligence,
  StrategicDiagnosis,
} from "./types";
import { getSupabase } from "@/lib/db/supabase";
import { displayDomain, userQuestions, type SessionSummary } from "./summary";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SESSIONS_TABLE = "sessions";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in-memory TTL
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ──────────────────────────────────────────────
// In-Memory Cache (global singleton for fast reads & HMR survival)
// ──────────────────────────────────────────────

const globalStore = globalThis as unknown as {
  __intelligenceStore?: Map<string, IntelligenceSession>;
  __cleanupTimer?: ReturnType<typeof setInterval>;
};

function getMemoryStore(): Map<string, IntelligenceSession> {
  if (!globalStore.__intelligenceStore) {
    globalStore.__intelligenceStore = new Map();

    if (!globalStore.__cleanupTimer) {
      globalStore.__cleanupTimer = setInterval(() => {
        cleanupExpiredMemory();
      }, CLEANUP_INTERVAL_MS);
    }
  }
  return globalStore.__intelligenceStore;
}

// ──────────────────────────────────────────────
// Database Row ↔ Session Mapping
// ──────────────────────────────────────────────

/** Supabase row shape (snake_case columns) */
interface SessionRow {
  id: string;
  status: string;
  status_message: string | null;
  onboarding_input: OnboardingInput;
  company_intelligence: CompanyIntelligence | null;
  competitor_intelligence: CompetitorIntelligence[] | null;
  market_intelligence: MarketIntelligence | null;
  diagnosis: StrategicDiagnosis | null;
  messages: ChatMessage[] | null;
  conversation_summary: string | null;
  error: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Convert an IntelligenceSession to a Supabase row for insert/upsert. */
function sessionToRow(session: IntelligenceSession): SessionRow {
  return {
    id: session.id,
    status: session.status,
    status_message: session.statusMessage || null,
    onboarding_input: session.onboardingInput,
    company_intelligence: session.companyIntelligence || null,
    competitor_intelligence: session.competitorIntelligence || null,
    market_intelligence: session.marketIntelligence || null,
    diagnosis: session.diagnosis || null,
    messages: session.messages || [],
    conversation_summary: session.conversationSummary || null,
    error: session.error || null,
    // Only sent when set, so anonymous saves still work before migration 005 is run.
    ...(session.userId ? { user_id: session.userId } : {}),
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

/** Convert a Supabase row back to an IntelligenceSession. */
function rowToSession(row: SessionRow): IntelligenceSession {
  const session: IntelligenceSession = {
    id: row.id,
    status: row.status as PipelineStatus,
    statusMessage: row.status_message || "",
    onboardingInput: row.onboarding_input,
    messages: row.messages || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.company_intelligence) session.companyIntelligence = row.company_intelligence;
  if (row.competitor_intelligence) session.competitorIntelligence = row.competitor_intelligence;
  if (row.market_intelligence) session.marketIntelligence = row.market_intelligence;
  if (row.diagnosis) session.diagnosis = row.diagnosis;
  if (row.conversation_summary) session.conversationSummary = row.conversation_summary;
  if (row.error) session.error = row.error;
  if (row.user_id) session.userId = row.user_id;

  return session;
}

/** Convert a partial camelCase update object to snake_case columns for Supabase. */
function partialUpdatesToRow(
  updates: Partial<Omit<IntelligenceSession, "id" | "createdAt">>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.statusMessage !== undefined) row.status_message = updates.statusMessage;
  if (updates.onboardingInput !== undefined) row.onboarding_input = updates.onboardingInput;
  if (updates.companyIntelligence !== undefined) row.company_intelligence = updates.companyIntelligence;
  if (updates.competitorIntelligence !== undefined) row.competitor_intelligence = updates.competitorIntelligence;
  if (updates.marketIntelligence !== undefined) row.market_intelligence = updates.marketIntelligence;
  if (updates.diagnosis !== undefined) row.diagnosis = updates.diagnosis;
  if (updates.messages !== undefined) row.messages = updates.messages;
  if (updates.conversationSummary !== undefined) row.conversation_summary = updates.conversationSummary;
  if (updates.error !== undefined) row.error = updates.error;
  if (updates.userId !== undefined) row.user_id = updates.userId;
  // updated_at is handled by the DB trigger, but we set it here too for consistency
  if (updates.updatedAt !== undefined) row.updated_at = updates.updatedAt;
  return row;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  // Random UUID bits, not Math.random: the ID is the only thing guarding an unowned analysis.
  const random = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `ll_${timestamp}_${random}`;
}

/**
 * Create a new intelligence session.
 */
export async function createSession(
  input: IntelligenceSession["onboardingInput"],
  userId?: string
): Promise<IntelligenceSession> {
  const memory = getMemoryStore();
  const session: IntelligenceSession = {
    id: generateSessionId(),
    status: "idle",
    statusMessage: "Session created",
    onboardingInput: input,
    userId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Cache in-memory
  memory.set(session.id, session);

  // Persist to Supabase
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from(SESSIONS_TABLE)
        .insert(sessionToRow(session));

      if (error) {
        console.warn(`[Supabase Store] Failed to persist new session ${session.id}:`, error.message);
      } else {
        console.log(`[Supabase Store] Created session ${session.id} in Supabase.`);
      }
    }
  } catch (error) {
    console.warn(`[Supabase Store] Failed to persist new session ${session.id} (in-memory preserved):`, error);
  }

  return session;
}

function createTestSession(id: string): IntelligenceSession {
  return {
    id,
    status: "ready",
    statusMessage: "Intelligence gathering complete. Ready for questions.",
    onboardingInput: {
      companyName: "Acme SaaS",
      website: "https://acme.example.com",
      role: "Founder / Co-founder",
      industry: "Tech & SaaS",
      stage: "1 to 3 years",
      coreOffer: "B2B Software & Marketing Operations Suite",
      audience: ["Other businesses", "Young professionals"],
      salesChannels: ["Own website", "Instagram / DMs"],
      biggestHeadache: "Posting but no sales",
      thirtyDayGoal: "More sales",
    },
    companyIntelligence: {
      name: "Acme SaaS",
      website: "https://acme.example.com",
      industry: "B2B Software / E-commerce Infrastructure",
      description: "Modern cloud platform solving e-commerce and marketing operational bottlenecks.",
      valueProposition: "High-velocity modern software with transparent pricing and agile ergonomics.",
      products: ["Cloud Suite", "Analytics Engine", "Strategic Intelligence"],
      targetSegments: ["Founders", "Growth Marketers", "E-commerce Operators"],
      brandTone: "Sharp, forward-thinking, pragmatic",
      strengths: ["Fast onboarding", "Modern UX", "High agility and velocity"],
      weaknesses: ["Emerging brand recognition compared to legacy incumbents"],
      currentChannels: ["Organic Discovery", "Founder Network", "Direct Outbound"],
      contentThemes: ["Modern Tooling Teardowns", "Growth Frameworks"],
      technologyStack: ["Next.js", "TypeScript", "Cloud-native microservices"],
    },
    competitorIntelligence: [
      {
        name: "Shopify",
        website: "https://shopify.com",
        description: "Leading global commerce platform offering hosted store software.",
        valueProposition: "All-in-one commerce solution with massive app store ecosystem.",
        products: ["Shopify Basic", "Shopify Plus", "Shop Payments"],
        targetSegments: ["SMB Merchants", "Enterprise Brands"],
        strengths: ["Huge ecosystem", "High brand recognition", "App store variety"],
        weaknesses: ["Transaction fees on non-native payments", "Expensive app stack costs"],
        marketingChannels: ["Search Ads", "Brand Sponsorships", "Partner Network"],
        contentStrategy: "High-volume founder case studies and commerce guides",
        differentiators: ["Industry standard ecosystem with extensive third-party integration"],
        pricing: "Tiered subscription + app add-ons + transaction fees",
      },
    ],
    marketIntelligence: {
      industryOverview: "Dynamic digital commerce and marketing technology market undergoing rapid transformation toward specialist tools.",
      marketSize: "Multi-billion dollar global addressable market with double-digit CAGR",
      growthTrends: [
        "Shift from bloated legacy suites to specialized agile tooling",
        "Demand for real-time intelligence over static dashboards",
      ],
      keyPlayers: ["Legacy Incumbents", "Agile Challengers", "AI-native platforms"],
      emergingTrends: ["Transparent usage-based pricing", "AI-assisted marketing execution"],
      customerBehaviors: ["Independent research before buying", "High UX sensitivity"],
      regulations: ["GDPR / SOC2"],
      opportunities: ["Disrupt slow, expensive legacy competitors by highlighting TCO"],
      threats: ["Incumbent bundling of shallow copycat features"],
    },
    diagnosis: {
      swot: {
        strengths: ["Modern tech stack", "Fast iteration cycle", "Transparent pricing"],
        weaknesses: ["Smaller top-of-funnel reach than legacy players"],
        opportunities: ["Position as agile alternative to legacy complexity"],
        threats: ["Aggressive incumbent discounting"],
      },
      positioning: {
        current: "Fast-moving specialist in high-growth category",
        ideal: "The premier modern intelligence platform for growth teams",
        gap: "Transition from feature messaging to high-leverage business outcomes",
      },
      competitiveAnalysis: {
        advantages: ["10x faster time to value", "Lower total cost of ownership"],
        disadvantages: ["Smaller enterprise sales partner network"],
        differentiationOpportunities: ["Highlight agility, speed, and transparent pricing"],
      },
      keyInsights: [
        "Focus on high-intent search and comparative positioning against legacy fees.",
        "Target operators dissatisfied with expensive, monolithic apps.",
      ],
      strategicPriorities: [
        "Deploy intent-driven comparative landing pages.",
        "Accelerate outbound to dissatisfied incumbent customers.",
      ],
      channelRecommendations: [
        { channel: "Intent Search", reasoning: "Captures buyers actively looking to switch", priority: "high" },
        { channel: "Strategic Teardowns", reasoning: "Builds high-trust authority with founders", priority: "high" },
      ],
      generatedAt: new Date().toISOString(),
    },
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a session by ID (checks memory first, falls back to Supabase).
 */
export async function getSession(
  sessionId: string
): Promise<IntelligenceSession | undefined> {
  const memory = getMemoryStore();
  let session = memory.get(sessionId);

  // If not in memory, query Supabase
  if (!session) {
    try {
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from(SESSIONS_TABLE)
          .select("*")
          .eq("id", sessionId)
          .single();

        if (data && !error) {
          session = rowToSession(data as SessionRow);
          memory.set(sessionId, session);
          console.log(`[Supabase Store] Hydrated session ${sessionId} from Supabase.`);
        }
      }
    } catch (error) {
      console.warn(`[Supabase Store] Error querying session ${sessionId}:`, error);
    }
  }

  // Handle demo / test session
  if (!session && (sessionId === "test" || sessionId.startsWith("test_") || sessionId === "demo")) {
    session = createTestSession(sessionId);
    memory.set(sessionId, session);
  }

  if (!session) return undefined;

  // Check in-memory TTL
  const age = Date.now() - new Date(session.createdAt).getTime();
  if (age > SESSION_TTL_MS) {
    memory.delete(sessionId);
    return undefined;
  }

  return session;
}

/**
 * Append a message to the session's persistent conversation history.
 */
export async function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): Promise<ChatMessage[]> {
  const session = await getSession(sessionId);
  if (!session) return [];

  if (!session.messages) {
    session.messages = [];
  }

  session.messages.push(message);
  session.updatedAt = new Date().toISOString();
  getMemoryStore().set(sessionId, session);

  // Persist to Supabase
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from(SESSIONS_TABLE)
        .update({
          messages: session.messages,
          updated_at: session.updatedAt,
        })
        .eq("id", sessionId);

      if (error) {
        console.warn(`[Supabase Store] Error persisting message to session ${sessionId}:`, error.message);
      }
    }
  } catch (error) {
    console.warn(`[Supabase Store] Error persisting message to session ${sessionId}:`, error);
  }

  return session.messages;
}

/**
 * Get the full conversation history for a session.
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const session = await getSession(sessionId);
  return session?.messages || [];
}

/**
 * Update rolling conversation summary for long conversations.
 */
export async function updateConversationSummary(
  sessionId: string,
  summary: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (session) {
    session.conversationSummary = summary;
    session.updatedAt = new Date().toISOString();
    getMemoryStore().set(sessionId, session);

    try {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase
          .from(SESSIONS_TABLE)
          .update({
            conversation_summary: summary,
            updated_at: session.updatedAt,
          })
          .eq("id", sessionId);

        if (error) {
          console.warn(`[Supabase Store] Error updating summary for ${sessionId}:`, error.message);
        }
      }
    } catch (error) {
      console.warn(`[Supabase Store] Error updating summary for ${sessionId}:`, error);
    }
  }
}

/**
 * Update a session's status and optional fields.
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<IntelligenceSession, "id" | "createdAt">>
): Promise<IntelligenceSession | undefined> {
  const memory = getMemoryStore();
  let session = memory.get(sessionId);

  if (!session) {
    session = await getSession(sessionId);
  }
  if (!session) return undefined;

  const updated: IntelligenceSession = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  memory.set(sessionId, updated);

  // Persist update to Supabase (upsert to handle edge cases)
  try {
    const supabase = getSupabase();
    if (supabase) {
      const dbUpdates = partialUpdatesToRow(updates);
      dbUpdates.updated_at = updated.updatedAt;

      const { error } = await supabase
        .from(SESSIONS_TABLE)
        .update(dbUpdates)
        .eq("id", sessionId);

      if (error) {
        // If update fails (row doesn't exist), try upsert with full row
        console.warn(`[Supabase Store] Update failed for ${sessionId}, attempting upsert:`, error.message);
        const { error: upsertError } = await supabase
          .from(SESSIONS_TABLE)
          .upsert(sessionToRow(updated), { onConflict: "id" });

        if (upsertError) {
          console.warn(`[Supabase Store] Upsert also failed for ${sessionId}:`, upsertError.message);
        }
      }
    }
  } catch (error) {
    console.warn(`[Supabase Store] Error updating session ${sessionId}:`, error);
  }

  return updated;
}

/**
 * Update just the pipeline status with a message.
 */
export async function updateStatus(
  sessionId: string,
  status: PipelineStatus,
  statusMessage: string
): Promise<void> {
  await updateSession(sessionId, { status, statusMessage });
}

/**
 * Delete one analysis, only if `ownerId` owns it. A single conditional delete, so ownership
 * is checked without downloading the (large) research data first.
 */
export async function deleteOwnedSession(
  sessionId: string,
  ownerId: string
): Promise<"deleted" | "not-found" | "failed"> {
  const memory = getMemoryStore();
  const supabase = getSupabase();
  if (!supabase) {
    if (memory.get(sessionId)?.userId !== ownerId) return "not-found";
    memory.delete(sessionId);
    return "deleted";
  }

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .delete()
    .eq("id", sessionId)
    .eq("user_id", ownerId)
    .select("id");
  if (error) {
    console.warn(`[Supabase Store] Error deleting session ${sessionId}:`, error.message);
    return "failed";
  }
  if (!data?.length) return "not-found";
  memory.delete(sessionId);
  return "deleted";
}

/**
 * Delete every analysis a user owns (when they delete their account).
 * Returns false if the database delete failed.
 */
export async function deleteSessionsForUser(userId: string): Promise<boolean> {
  const memory = getMemoryStore();
  for (const [id, session] of memory) {
    if (session.userId === userId) memory.delete(id);
  }
  const supabase = getSupabase();
  if (!supabase) return true;

  const { error } = await supabase.from(SESSIONS_TABLE).delete().eq("user_id", userId);
  if (error) {
    console.warn(`[Supabase Store] Error deleting sessions for user ${userId}:`, error.message);
    return false;
  }
  return true;
}

/**
 * List all active sessions.
 */
export async function listSessions(): Promise<IntelligenceSession[]> {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from(SESSIONS_TABLE)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (data && !error) {
        return (data as SessionRow[]).map(rowToSession);
      }

      if (error) {
        console.warn("[Supabase Store] Error listing sessions:", error.message);
      }
    }
  } catch (error) {
    console.warn("[Supabase Store] Error listing sessions:", error);
  }

  return Array.from(getMemoryStore().values());
}

/**
 * One user's analyses, newest first, trimmed to what the dashboard and History show.
 * Only the database knows owners, so this is Supabase-only.
 */
export async function listSessionSummaries(userId: string, limit = 50): Promise<SessionSummary[]> {
  try {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select("id, status, onboarding_input, company_name:company_intelligence->>name, messages, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[Supabase Store] Error listing sessions for user:", error.message);
      return [];
    }

    return (data || []).map((row) => {
      const input = (row.onboarding_input || {}) as Partial<OnboardingInput>;
      const questions = userQuestions((row.messages || []) as ChatMessage[]);
      return {
        id: row.id as string,
        companyName: input.companyName || (row.company_name as string | null) || displayDomain(input.website) || "Untitled analysis",
        website: input.website || "",
        status: row.status as PipelineStatus,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        questionCount: questions.length,
        lastQuestion: questions[questions.length - 1],
      };
    });
  } catch (error) {
    console.warn("[Supabase Store] Error listing sessions for user:", error);
    return [];
  }
}

/**
 * Give an unowned analysis to a user (used right after login).
 * Returns false if it doesn't exist or already belongs to someone else.
 */
export async function claimSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) return false;
  if (session.userId === userId) return true;
  if (session.userId) return false;

  const updated = await updateSession(sessionId, { userId });
  return !!updated;
}

// ──────────────────────────────────────────────
// Internal Cleanup (in-memory)
// ──────────────────────────────────────────────

function cleanupExpiredMemory(): void {
  const memory = getMemoryStore();
  const now = Date.now();
  for (const [id, session] of memory.entries()) {
    const age = now - new Date(session.createdAt).getTime();
    if (age > SESSION_TTL_MS) {
      memory.delete(id);
    }
  }
}
