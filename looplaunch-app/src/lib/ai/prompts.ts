/**
 * Gemini Prompt Templates
 *
 * All prompts are separated from logic for easy iteration.
 * Gemini is used for STRUCTURING and REASONING, not as a primary data source.
 * Raw evidence comes from crawling and research — Gemini organizes and interprets it.
 */

import type { OnboardingInput, ChatMessage } from "../intelligence/types";

// ──────────────────────────────────────────────
// Company Intelligence Prompt
// ──────────────────────────────────────────────

export function buildCompanyAnalysisPrompt(
  onboarding: OnboardingInput,
  crawledContent: string
): string {
  return `You are a strategic marketing analyst for Loop Launch, an AI-powered marketing intelligence platform.

TASK: Analyze the following company data and produce a STRUCTURED intelligence profile.

═══ USER-PROVIDED CONTEXT ═══
Company Name: ${onboarding.companyName}
Contact: ${onboarding.nameAndRole}
Website: ${onboarding.website}
What They Sell & Who Buys It: ${onboarding.whatTheySell}
Competitors: ${onboarding.competitors || "Not specified"}
Pain Point: ${onboarding.painPoint}
Why They're Here: ${onboarding.whyTheyreHere?.join(", ") || "Not specified"}

═══ CRAWLED WEBSITE CONTENT ═══
${crawledContent || "No website content was crawled successfully."}

═══ INSTRUCTIONS ═══
Based on BOTH the user's self-description AND the crawled website data, produce a JSON object with this exact structure:

{
  "name": "Company name",
  "website": "URL",
  "industry": "Primary industry",
  "description": "Clear, concise description synthesized from both sources",
  "valueProposition": "Core value proposition as communicated on the website",
  "products": ["Product/service 1", "Product/service 2"],
  "targetSegments": ["Segment 1", "Segment 2"],
  "brandTone": "Description of the brand's voice and tone",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "currentChannels": ["Marketing channel 1", "Marketing channel 2"],
  "contentThemes": ["Theme 1", "Theme 2"],
  "technologyStack": ["Tech 1", "Tech 2"]
}

RULES:
- Use evidence from the crawled content wherever possible
- Where crawled content is thin, supplement with the user's description
- Be specific and actionable, not generic
- Identify AT LEAST 3 strengths and 3 weaknesses
- Return ONLY the JSON object, no markdown fences or extra text`;
}

// ──────────────────────────────────────────────
// Competitor Intelligence Prompt
// ──────────────────────────────────────────────

export function buildCompetitorAnalysisPrompt(
  competitorName: string,
  crawledContent: string,
  companyContext: string
): string {
  return `You are a competitive intelligence analyst for Loop Launch.

TASK: Analyze competitor "${competitorName}" and produce a STRUCTURED intelligence profile.

═══ ABOUT THE CLIENT (for comparison context) ═══
${companyContext}

═══ CRAWLED COMPETITOR WEBSITE CONTENT ═══
${crawledContent || "No website content was crawled for this competitor."}

═══ INSTRUCTIONS ═══
Produce a JSON object with this exact structure:

{
  "name": "${competitorName}",
  "website": "URL if found",
  "description": "What this competitor does",
  "valueProposition": "Their core value proposition",
  "products": ["Product/service 1", "Product/service 2"],
  "targetSegments": ["Segment 1", "Segment 2"],
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "marketingChannels": ["Channel 1", "Channel 2"],
  "contentStrategy": "Description of their content approach",
  "differentiators": ["What makes them different 1", "What makes them different 2"],
  "pricing": "Pricing info if available, or 'Not publicly available'"
}

RULES:
- Base analysis primarily on crawled content
- Where data is limited, clearly state it as an inference
- Focus on aspects relevant to competitive positioning
- Return ONLY the JSON object, no markdown fences or extra text`;
}

// ──────────────────────────────────────────────
// Market Intelligence Prompt
// ──────────────────────────────────────────────

export function buildMarketAnalysisPrompt(
  onboarding: OnboardingInput,
  searchResults: string
): string {
  return `You are a market research analyst for Loop Launch.

TASK: Analyze market data and produce a STRUCTURED market intelligence report.

═══ COMPANY CONTEXT ═══
Company: ${onboarding.companyName}
What They Sell: ${onboarding.whatTheySell}
Pain Point: ${onboarding.painPoint}
Why They're Here: ${onboarding.whyTheyreHere?.join(", ") || "Not specified"}

═══ RESEARCH DATA ═══
${searchResults || "No market research data was gathered. Use general industry knowledge to provide baseline analysis."}

═══ INSTRUCTIONS ═══
Produce a JSON object with this exact structure:

{
  "industryOverview": "Brief overview of the industry landscape",
  "marketSize": "Estimated market size if data available, or 'Data not available'",
  "growthTrends": ["Trend 1", "Trend 2"],
  "keyPlayers": ["Player 1", "Player 2"],
  "emergingTrends": ["Emerging trend 1", "Emerging trend 2"],
  "customerBehaviors": ["Behavior 1", "Behavior 2"],
  "regulations": ["Relevant regulation or consideration 1"],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "threats": ["Threat 1", "Threat 2"]
}

RULES:
- Clearly distinguish between data-backed insights and inferences
- Focus on trends relevant to the company's target audience
- Be specific — avoid generic marketing jargon
- Return ONLY the JSON object, no markdown fences or extra text`;
}

// ──────────────────────────────────────────────
// Strategic Diagnosis Prompt
// ──────────────────────────────────────────────

export function buildDiagnosisPrompt(
  companyIntel: string,
  competitorIntel: string,
  marketIntel: string,
  onboarding: OnboardingInput
): string {
  return `You are a senior marketing strategist at Loop Launch, an AI-powered strategic marketing intelligence system.

TASK: Synthesize all gathered intelligence into a STRATEGIC DIAGNOSIS.

═══ COMPANY INTELLIGENCE ═══
${companyIntel}

═══ COMPETITOR INTELLIGENCE ═══
${competitorIntel}

═══ MARKET INTELLIGENCE ═══
${marketIntel}

═══ USER'S PAIN POINT ═══
${onboarding.painPoint}

═══ WHY THEY'RE HERE ═══
${onboarding.whyTheyreHere?.join(", ") || "Not specified"}

═══ INSTRUCTIONS ═══
Produce a comprehensive strategic diagnosis as a JSON object:

{
  "swot": {
    "strengths": ["Evidence-backed strength 1", "..."],
    "weaknesses": ["Evidence-backed weakness 1", "..."],
    "opportunities": ["Market opportunity 1", "..."],
    "threats": ["Competitive/market threat 1", "..."]
  },
  "positioning": {
    "current": "Where the company currently sits in the market",
    "ideal": "Where they should aim to be positioned",
    "gap": "What needs to change to close the gap"
  },
  "competitiveAnalysis": {
    "advantages": ["Advantage over competitors 1", "..."],
    "disadvantages": ["Disadvantage vs competitors 1", "..."],
    "differentiationOpportunities": ["Opportunity to differentiate 1", "..."]
  },
  "keyInsights": [
    "Strategic insight 1 with evidence",
    "Strategic insight 2 with evidence"
  ],
  "strategicPriorities": [
    "Priority 1: What to focus on and why",
    "Priority 2: What to focus on and why"
  ],
  "channelRecommendations": [
    {
      "channel": "Channel name",
      "reasoning": "Why this channel, based on evidence",
      "priority": "high"
    }
  ]
}

RULES:
- Every insight MUST be connected to evidence from the gathered intelligence
- Don't generate a marketing plan — this is a DIAGNOSIS, not a prescription
- Be direct and specific — avoid platitudes
- Prioritize actionable insights over comprehensive coverage
- Channel recommendations should account for the user's stated constraints
- Return ONLY the JSON object, no markdown fences or extra text`;
}

// ──────────────────────────────────────────────
// Strategic Question-Answering Prompt
// ──────────────────────────────────────────────

export interface ConversationalPromptOptions {
  question: string;
  companyIntel: any;
  competitorIntel: any[];
  marketIntel: any;
  diagnosis: any;
  history?: ChatMessage[];
  conversationSummary?: string;
  researchText?: string;
  researchStatus?: string;
  intentGuidance?: string;
  resolvedReference?: string;
  frameworkContext?: string;
}

/**
 * Intelligent Conversational Strategy Advisor Prompt
 *
 * Produces continuous, context-aware dialogue that connects every new question
 * with preceding discussion, company intelligence, and optional web research.
 */
export function buildConversationalAdvisorPrompt(options: ConversationalPromptOptions): string {
  const {
    question,
    companyIntel,
    competitorIntel,
    marketIntel,
    diagnosis,
    history = [],
    conversationSummary,
    researchText,
    researchStatus,
    intentGuidance,
    resolvedReference,
    frameworkContext,
  } = options;

  // Format recent conversation history (last 8 messages)
  const recentHistory = history.slice(-8);
  const historyText = recentHistory.length > 0
    ? recentHistory
        .map((m) => `${m.role === "user" ? "CLIENT" : "STRATEGY ADVISOR"}:\n${m.content.trim()}`)
        .join("\n\n---\n\n")
    : "No previous conversation in this session yet. This is the client's first question.";

  // Optional summary of older messages
  const summaryBlock = conversationSummary
    ? `═══ PREVIOUS DISCUSSION SUMMARY ═══\n${conversationSummary}\n\n`
    : "";

  // Proprietary framework section (RAG from Loop Launch framework docs)
  const frameworkSection = frameworkContext?.trim()
    ? `═══ LOOP LAUNCH PROPRIETARY FRAMEWORK (RETRIEVED KNOWLEDGE) ═══
[The following verified framework passages from Loop Launch are authoritative for this industry and problem:]
${frameworkContext}

`
    : "";

  // Web research section (only if available)
  const webResearchSection = researchText?.trim()
    ? `═══ REAL-TIME WEB RESEARCH (via Tavily Search) ═══
Status: ${researchStatus || "success"}
${researchText}
`
    : "";

  // Reference note
  const referenceNote = resolvedReference
    ? `\n[Contextual Reference Note: The user's query refers to: ${resolvedReference}]\n`
    : "";

  // Intent guidance
  const intentNote = intentGuidance
    ? `\n[Advisory Directive: ${intentGuidance}]\n`
    : "";

  return `You are the Chief Strategy Officer and Lead Marketing Advisor at Loop Launch. You are in an ONGOING, collaborative strategic advisory conversation with the company founder/executive.

${summaryBlock}═══ CONVERSATION HISTORY (Previous turns in this session) ═══
${historyText}

${frameworkSection}${webResearchSection}
═══ AUTHORITATIVE COMPANY INTELLIGENCE BASE ═══
Company: ${companyIntel.name} (${companyIntel.website || "N/A"})
Core Focus: ${companyIntel.description}
Value Proposition: ${companyIntel.valueProposition}
Target Segments: ${companyIntel.targetSegments?.join("; ") || "B2B Operators"}
Strengths: ${companyIntel.strengths?.join("; ") || "Speed and agility"}
Weaknesses: ${companyIntel.weaknesses?.join("; ") || "Emerging brand awareness"}
Current Channels: ${companyIntel.currentChannels?.join(", ") || "Direct, organic"}
Known Competitors: ${competitorIntel?.map((c: any) => c.name).join(", ") || "Industry incumbents"}
Core Positioning Gap: ${diagnosis?.positioning?.gap || "Focusing on features over business outcomes"}
Key Strategic Bottleneck: ${diagnosis?.keyInsights?.[0] || "Acquisition velocity and competitive differentiation"}

═══ CURRENT CLIENT QUESTION ═══
"${question}"
${referenceNote}${intentNote}
═══ CONVERSATIONAL RULES ═══
1. **GROUND IN LOOP LAUNCH FRAMEWORK**:
   - If the "LOOP LAUNCH PROPRIETARY FRAMEWORK" section above contains relevant principles, frameworks, loops, or heuristics, prioritize applying them directly to the client's problem.
   - Mention the framework terminology and principles naturally without reading like a textbook.

2. **CONTINUITY IS MANDATORY**:
   - Understand the current question in relation to the conversation history above.
   - If the user asks "Why?", explain the causal mechanism behind the statement you made in the previous message.
   - If the user asks "How do we fix it?", provide concrete operational steps for the specific problem discussed above.
   - If the user refers to "the second one" or "that option", look at the previous turn and address that exact entity.
   - If the user tests a pivot ("What if we target SMBs instead?"), re-evaluate the strategy under that scenario and contrast it with previous points.
   - NEVER repeat your prior answers. Build forward.

3. **CONCISE & DIRECT BY DEFAULT**:
   - DO NOT generate a 500-word boilerplate consulting report.
   - Answer the actual question that was asked. A simple question deserves a crisp, 1-3 paragraph answer or focused bullets.
   - Use natural transitions ("The catch is...", "That changes the economics.", "Looking at your customer acquisition cost...", "The underlying reason is...").
   - Avoid generic intros like "Based on the available intelligence..." or "In conclusion...". Jump straight to the insight.

3. **SELECTIVE EVIDENCE**:
   - Only include the "evidence" array when you make specific factual claims that benefit from verification (e.g. market share percentages, competitor pricing, customer behavior data).
   - For logical follow-ups ("Why?", "What if?", "Give me 3 ideas"), leave evidence empty or omit it. Do not force fake evidence blocks on conversational thoughts.

4. **OUTPUT FORMAT (Strict JSON)**:
Return a valid JSON object matching this schema:
{
  "answer": "Your direct, context-aware strategic response formatted in clean markdown (paragraphs, bold text, or lists).",
  "evidence": [
    // Include ONLY if specific factual data points were cited. Otherwise leave empty [].
    {
      "source": "Domain or source name",
      "insight": "Specific fact or data point",
      "url": "https://... (EXACT Tavily URL if web research was used, otherwise omit)"
    }
  ],
  "sources": [
    // Include ONLY if Tavily web research was conducted and cited. Otherwise leave empty [].
    {
      "title": "Page title",
      "url": "The exact URL",
      "source": "Domain"
    }
  ],
  "confidence": "high",
  "followUpQuestions": [
    // OPTIONAL: 1-2 sharp, highly contextual next questions the founder might naturally ask next. Max 2.
  ]
}

Return ONLY the JSON object. Do not wrap in extra markdown fences or preface text.`;
}

// ──────────────────────────────────────────────
// Backward-compatible Strategic Question-Answering Prompt
// ──────────────────────────────────────────────

export function buildQuestionAnswerPrompt(
  question: string,
  companyIntel: string,
  competitorIntel: string,
  marketIntel: string,
  diagnosis: string,
  researchText?: string,
  researchStatus?: string
): string {
  try {
    const parsedCompany = typeof companyIntel === "string" ? JSON.parse(companyIntel) : companyIntel;
    const parsedComp = typeof competitorIntel === "string" ? JSON.parse(competitorIntel) : competitorIntel;
    const parsedMarket = typeof marketIntel === "string" ? JSON.parse(marketIntel) : marketIntel;
    const parsedDiag = typeof diagnosis === "string" ? JSON.parse(diagnosis) : diagnosis;

    return buildConversationalAdvisorPrompt({
      question,
      companyIntel: parsedCompany,
      competitorIntel: parsedComp,
      marketIntel: parsedMarket,
      diagnosis: parsedDiag,
      researchText,
      researchStatus,
    });
  } catch {
    // Fallback if raw strings are passed
    return buildConversationalAdvisorPrompt({
      question,
      companyIntel: { name: "Our Company", description: companyIntel },
      competitorIntel: [],
      marketIntel: {},
      diagnosis: {},
      researchText,
      researchStatus,
    });
  }
}

