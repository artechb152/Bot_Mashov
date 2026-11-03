"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as api from "@/lib/workspace/api";
import { ApiError } from "@/lib/workspace/api";
import { NO_COHORT, traineeMatchesCohort } from "@/lib/workspace/nav";
import type { TraineeDTO } from "@/lib/data/trainees";
import type { FeedbackDTO, FeedbackInput } from "@/lib/data/feedback";
import type { InsightDTO } from "@/lib/data/ai-insights";
import type { ConversationDTO, TurnDTO } from "@/lib/data/conversations";
import type { AIArtifactTask, FeedbackPolishInput } from "@/lib/ai/types";

/**
 * חונך+ /workspace — the single client state container (Stage 3).
 *
 * Owns the whole work-area state (selection, per-trainee data, the active
 * conversation) so no state is scattered across panels — they read/act through
 * `useWorkspace()`. Selection is mirrored to the URL (`?cohort=&trainee=`) via
 * history.replaceState so the page is shareable and reloads into the same context.
 *
 * Security: this layer never authorizes — every mutation calls a Stage 1/2 route
 * that enforces access server-side. A 404/403 on a trainee-scoped read is surfaced
 * as `traineeAccessError` (the server returns a generic 404 for "no access"), and a
 * 401 as a session-expiry error. AI source selection is persisted PER CONVERSATION;
 * the server always re-derives the context feedback, so client ids can't widen it.
 */

/** An ephemeral, client-only chat entry (task confirmations, not-configured, errors)
 *  shown inline in the assistant panel — never persisted, cleared on switch. */
export type ChatNotice = {
  id: string;
  kind: "task" | "not_configured" | "error";
  text: string;
};

export type AIStatus = { configured: boolean; mock: boolean; provider: string; category: string };

/** Central work-area tab (one visible at a time). */
export type WorkspaceTab = "overview" | "timeline" | "final";

/** Feedback creation input — text and/or an uploaded file. */
export type AddFeedbackInput = {
  feedbackType: FeedbackInput["feedbackType"];
  title: string;
  rawText: string;
  selectedAction?: string;
  file?: File | null;
};

type WorkspaceLoading = {
  trainee: boolean;
  conversation: boolean;
  sending: boolean;
  task: AIArtifactTask | null;
  feedback: boolean;
  archived: boolean;
};

export type WorkspaceContextValue = {
  // Static (from the server) --------------------------------------------------
  trainees: TraineeDTO[];
  username: string;
  ai: AIStatus;

  // Selection -----------------------------------------------------------------
  selectedCohortId: string | null;
  selectedTraineeId: string | null;
  selectedTrainee: TraineeDTO | null;
  expandedTraineeId: string | null;
  activeConversationId: string | null;

  // Data for the selected trainee ---------------------------------------------
  feedback: FeedbackDTO[];
  archivedFeedback: FeedbackDTO[];
  insights: InsightDTO[];
  conversations: ConversationDTO[];
  turns: TurnDTO[];
  notices: ChatNotice[];

  // Derived -------------------------------------------------------------------
  visibleTrainees: TraineeDTO[];
  /** The single aggregated review ("סקירה") artifact shown in the work area. */
  overviewInsight: InsightDTO | null;
  reviewInsight: InsightDTO | null;
  timelineInsight: InsightDTO | null;
  finalEvalInsight: InsightDTO | null;
  selectedFeedbackIdSet: ReadonlySet<string>;
  selectedSourceCount: number;
  activeConversation: ConversationDTO | null;

  // Status --------------------------------------------------------------------
  loading: WorkspaceLoading;
  error: string | null;
  traineeAccessError: "forbidden" | "notfound" | null;
  showArchived: boolean;
  composerFocusSignal: number;
  activeTab: WorkspaceTab;

  // Actions -------------------------------------------------------------------
  selectTrainee: (id: string | null) => void;
  selectCohort: (id: string | null) => void;
  toggleExpand: (id: string) => void;
  requestComposerFocus: () => void;
  dismissError: () => void;
  setActiveTab: (tab: WorkspaceTab) => void;

  addFeedback: (input: AddFeedbackInput) => Promise<boolean>;
  editFeedback: (id: string, input: Partial<FeedbackInput>) => Promise<boolean>;
  archiveFeedbackEntry: (id: string) => Promise<void>;
  restoreFeedbackEntry: (id: string) => Promise<void>;
  setShowArchived: (show: boolean) => void;
  polish: (input: FeedbackPolishInput) => Promise<api.PolishResult | null>;

  toggleSource: (feedbackId: string, checked: boolean) => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => Promise<void>;
  archiveConversationEntry: (id: string) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  runTask: (task: AIArtifactTask) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

const activeIdsOf = (items: FeedbackDTO[]): string[] =>
  items.filter((f) => f.status === "active").map((f) => f.id);

const latestOfType = (insights: InsightDTO[], type: AIArtifactTask): InsightDTO | null =>
  insights.find((i) => i.artifactType === type && (i.status === "current" || i.status === "stale")) ?? null;

/** Chat confirmation shown after a structured artifact is generated. */
const ARTIFACT_DONE: Record<AIArtifactTask, string> = {
  trainee_overview: "הופקה סקירה מעודכנת. היא מוצגת באזור הסקירה.",
  trainee_review: "נוצרה סקירת חניך מעודכנת. היא מוצגת באזור הסקירה.",
  development_timeline: "נוצר ציר התפתחות מעודכן. הוא מוצג מתחת לסקירה.",
  next_focus: "נוצרה המלצת מוקד לחניכה הבאה.",
  feedback_summary: "נוצר סיכום משובים מעודכן.",
  final_evaluation: "נוצרה טיוטת חוות דעת סוף. היא מוצגת באזור הסקירה — טיוטה בלבד, לא חוות דעת רשמית.",
};

export function WorkspaceProvider({
  trainees,
  username,
  ai,
  initialTraineeId,
  initialCohortId,
  children,
}: {
  trainees: TraineeDTO[];
  username: string;
  ai: AIStatus;
  initialTraineeId?: string | null;
  initialCohortId?: string | null;
  children: React.ReactNode;
}) {
  // Only auto-select the URL trainee if it exists AND belongs to the initial cohort.
  const firstValidTrainee = (() => {
    if (!initialTraineeId) return null;
    const t = trainees.find((x) => x.id === initialTraineeId);
    if (!t) return null;
    return traineeMatchesCohort(t.cohortId, initialCohortId ?? null) ? initialTraineeId : null;
  })();

  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(initialCohortId ?? null);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(firstValidTrainee);
  const [expandedTraineeId, setExpandedTraineeId] = useState<string | null>(firstValidTrainee);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<FeedbackDTO[]>([]);
  const [archivedFeedback, setArchivedFeedback] = useState<FeedbackDTO[]>([]);
  const [insights, setInsights] = useState<InsightDTO[]>([]);
  const [conversations, setConversations] = useState<ConversationDTO[]>([]);
  const [turns, setTurns] = useState<TurnDTO[]>([]);
  const [notices, setNotices] = useState<ChatNotice[]>([]);

  const [loading, setLoading] = useState<WorkspaceLoading>({
    trainee: false,
    conversation: false,
    sending: false,
    task: null,
    feedback: false,
    archived: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [traineeAccessError, setTraineeAccessError] = useState<"forbidden" | "notfound" | null>(null);
  const [showArchived, setShowArchivedState] = useState(false);
  const [composerFocusSignal, setComposerFocusSignal] = useState(0);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");

  // Ignore responses from a trainee that is no longer selected (fast switching).
  const loadToken = useRef(0);
  const noticeSeq = useRef(0);
  const patchLoading = useCallback(
    (partial: Partial<WorkspaceLoading>) => setLoading((prev) => ({ ...prev, ...partial })),
    [],
  );

  const pushNotice = useCallback((kind: ChatNotice["kind"], text: string) => {
    noticeSeq.current += 1;
    setNotices((prev) => [...prev, { id: `n${noticeSeq.current}`, kind, text }]);
  }, []);

  /** Map a caught error to the right UI state. Returns true if it was an access error. */
  const handleError = useCallback((err: unknown, fallback: string): boolean => {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        setError("פג תוקף ההתחברות. רעננו את העמוד והתחברו מחדש.");
        return false;
      }
      if (err.status === 403 || err.status === 404) {
        return true; // caller decides whether this is a trainee-access error
      }
      setError(err.message || fallback);
      return false;
    }
    setError(fallback);
    return false;
  }, []);

  // --- Cohort is URL/navigation-driven (from the sidebar tree) ----------------
  // When the resolved cohort prop changes, adopt it and drop a selected trainee that
  // does not belong to the new cohort (so another cohort's trainee is never shown).
  const lastPersistedCohort = useRef<string | null>(initialCohortId ?? null);
  useEffect(() => {
    const next = initialCohortId ?? null;
    setSelectedCohortId((prev) => (prev === next ? prev : next));
    setSelectedTraineeId((prevTrainee) => {
      if (!prevTrainee) return prevTrainee;
      const t = trainees.find((x) => x.id === prevTrainee);
      return t && traineeMatchesCohort(t.cohortId, next) ? prevTrainee : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCohortId]);

  // Persist a real cohort selection as the personal default (best-effort; skips the
  // server-resolved initial value and the "unassigned" bucket).
  useEffect(() => {
    if (!selectedCohortId || selectedCohortId === NO_COHORT) return;
    if (selectedCohortId === lastPersistedCohort.current) return;
    lastPersistedCohort.current = selectedCohortId;
    void api.setDefaultCohort(selectedCohortId).catch(() => {});
  }, [selectedCohortId]);

  // --- URL sync (shareable ?cohort=&trainee=) --------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedTraineeId) url.searchParams.set("trainee", selectedTraineeId);
    else url.searchParams.delete("trainee");
    if (selectedCohortId) url.searchParams.set("cohort", selectedCohortId);
    else url.searchParams.delete("cohort");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [selectedTraineeId, selectedCohortId]);

  // --- Load a conversation's turns + selection -------------------------------
  const loadConversation = useCallback(
    async (conversationId: string, token: number) => {
      patchLoading({ conversation: true });
      try {
        const { conversation, turns: convTurns } = await api.fetchConversation(conversationId);
        if (loadToken.current !== token) return;
        setActiveConversationId(conversation.id);
        setConversations((prev) => prev.map((c) => (c.id === conversation.id ? conversation : c)));
        setTurns(convTurns);
        setNotices([]);
      } catch (err) {
        if (loadToken.current !== token) return;
        handleError(err, "טעינת השיחה נכשלה.");
      } finally {
        if (loadToken.current === token) patchLoading({ conversation: false });
      }
    },
    [handleError, patchLoading],
  );

  // --- Load everything for a trainee -----------------------------------------
  const loadTrainee = useCallback(
    async (traineeId: string) => {
      const token = ++loadToken.current;
      setLoading({ trainee: true, conversation: false, sending: false, task: null, feedback: false, archived: false });
      setTraineeAccessError(null);
      setError(null);
      setFeedback([]);
      setArchivedFeedback([]);
      setInsights([]);
      setConversations([]);
      setTurns([]);
      setNotices([]);
      setActiveConversationId(null);
      setShowArchivedState(false);

      try {
        const [fb, ins, convs] = await Promise.all([
          api.fetchFeedback(traineeId),
          api.fetchInsights(traineeId),
          api.fetchConversations(traineeId),
        ]);
        if (loadToken.current !== token) return;
        setFeedback(fb);
        setInsights(ins);
        setConversations(convs);
        // Resume the most recent conversation (list is lastMessageAt-desc).
        if (convs.length > 0) {
          await loadConversation(convs[0].id, token);
        }
      } catch (err) {
        if (loadToken.current !== token) return;
        const isAccess = handleError(err, "טעינת נתוני החניך נכשלה.");
        if (isAccess) setTraineeAccessError("notfound");
      } finally {
        if (loadToken.current === token) patchLoading({ trainee: false });
      }
    },
    [handleError, loadConversation, patchLoading],
  );

  // Load when the selected trainee changes.
  useEffect(() => {
    if (!selectedTraineeId) {
      setFeedback([]);
      setArchivedFeedback([]);
      setInsights([]);
      setConversations([]);
      setTurns([]);
      setNotices([]);
      setActiveConversationId(null);
      setTraineeAccessError(null);
      return;
    }
    void loadTrainee(selectedTraineeId);
  }, [selectedTraineeId, loadTrainee]);

  // --- Derived ---------------------------------------------------------------
  const selectedTrainee = useMemo(
    () => trainees.find((t) => t.id === selectedTraineeId) ?? null,
    [trainees, selectedTraineeId],
  );

  const visibleTrainees = useMemo(
    () => trainees.filter((t) => traineeMatchesCohort(t.cohortId, selectedCohortId)),
    [trainees, selectedCohortId],
  );

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const overviewInsight = useMemo(() => latestOfType(insights, "trainee_overview"), [insights]);
  const reviewInsight = useMemo(() => latestOfType(insights, "trainee_review"), [insights]);
  const timelineInsight = useMemo(() => latestOfType(insights, "development_timeline"), [insights]);
  const finalEvalInsight = useMemo(() => latestOfType(insights, "final_evaluation"), [insights]);

  // The concrete "selected as AI source" set: the active conversation's persisted
  // selection, or (no conversation yet) all ACTIVE feedback — the new-conversation default.
  const selectedFeedbackIdSet = useMemo<ReadonlySet<string>>(() => {
    if (activeConversation) return new Set(activeConversation.selectedFeedbackIds);
    return new Set(activeIdsOf(feedback));
  }, [activeConversation, feedback]);

  const selectedSourceCount = useMemo(
    () => feedback.filter((f) => f.status === "active" && selectedFeedbackIdSet.has(f.id)).length,
    [feedback, selectedFeedbackIdSet],
  );

  // --- Selection actions -----------------------------------------------------
  const selectTrainee = useCallback((id: string | null) => {
    setSelectedTraineeId(id);
    setExpandedTraineeId(id);
  }, []);

  const selectCohort = useCallback((id: string | null) => setSelectedCohortId(id), []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedTraineeId((prev) => (prev === id ? null : id));
  }, []);

  const requestComposerFocus = useCallback(() => {
    setExpandedTraineeId(selectedTraineeId);
    setComposerFocusSignal((n) => n + 1);
  }, [selectedTraineeId]);

  const dismissError = useCallback(() => setError(null), []);

  const refreshInsights = useCallback(async (traineeId: string, token: number) => {
    try {
      const ins = await api.fetchInsights(traineeId);
      if (loadToken.current === token) setInsights(ins);
    } catch {
      /* non-fatal — a stale insights view corrects on the next trainee load */
    }
  }, []);

  // --- Ensure an active conversation exists (create on demand) ----------------
  const ensureConversation = useCallback(async (): Promise<ConversationDTO | null> => {
    if (!selectedTraineeId) return null;
    if (activeConversation) return activeConversation;
    try {
      const conv = await api.createConversation(selectedTraineeId);
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setTurns([]);
      setNotices([]);
      return conv;
    } catch (err) {
      const isAccess = handleError(err, "פתיחת שיחה חדשה נכשלה.");
      if (isAccess) setTraineeAccessError("notfound");
      return null;
    }
  }, [selectedTraineeId, activeConversation, handleError]);

  // --- Feedback actions ------------------------------------------------------
  const addFeedback = useCallback(
    async (input: AddFeedbackInput): Promise<boolean> => {
      if (!selectedTraineeId) return false;
      const token = loadToken.current;
      patchLoading({ feedback: true });
      setError(null);
      try {
        const created = input.file
          ? await api.createFeedbackWithFile(
              selectedTraineeId,
              { title: input.title, feedbackType: input.feedbackType, rawText: input.rawText, selectedAction: input.selectedAction },
              input.file,
            )
          : await api.createFeedback(selectedTraineeId, {
              feedbackType: input.feedbackType,
              title: input.title,
              rawText: input.rawText,
              selectedAction: input.selectedAction,
            });
        if (loadToken.current !== token) return true;
        setFeedback((prev) => [...prev, created]);
        // A new source: add it to the active conversation's selection so it is used.
        if (activeConversation) {
          const next = Array.from(new Set([...activeConversation.selectedFeedbackIds, created.id]));
          try {
            const updated = await api.updateConversation(activeConversation.id, { selectedFeedbackIds: next });
            if (loadToken.current === token) {
              setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            }
          } catch {
            /* selection is best-effort; the feedback itself was saved */
          }
        }
        // The new source makes existing artifacts incomplete → server marked them stale.
        await refreshInsights(selectedTraineeId, token);
        return true;
      } catch (err) {
        const isAccess = handleError(err, "שמירת המשוב נכשלה.");
        if (isAccess) setError("אין לך הרשאה להוסיף משוב לחניך זה.");
        return false;
      } finally {
        if (loadToken.current === token) patchLoading({ feedback: false });
      }
    },
    [selectedTraineeId, activeConversation, handleError, patchLoading, refreshInsights],
  );

  const editFeedback = useCallback(
    async (id: string, input: Partial<FeedbackInput>): Promise<boolean> => {
      if (!selectedTraineeId) return false;
      const token = loadToken.current;
      setError(null);
      try {
        const updated = await api.updateFeedback(id, input);
        if (loadToken.current !== token) return true;
        setFeedback((prev) => prev.map((f) => (f.id === id ? updated : f)));
        await refreshInsights(selectedTraineeId, token);
        return true;
      } catch (err) {
        const isAccess = handleError(err, "עדכון המשוב נכשל.");
        if (isAccess) setError("אין לך הרשאה לערוך משוב זה.");
        return false;
      }
    },
    [selectedTraineeId, handleError, refreshInsights],
  );

  const archiveFeedbackEntry = useCallback(
    async (id: string) => {
      if (!selectedTraineeId) return;
      const token = loadToken.current;
      setError(null);
      try {
        const archived = await api.archiveFeedback(id);
        if (loadToken.current !== token) return;
        setFeedback((prev) => prev.filter((f) => f.id !== id));
        setArchivedFeedback((prev) => (showArchived ? [archived, ...prev] : prev));
        await refreshInsights(selectedTraineeId, token);
      } catch (err) {
        const isAccess = handleError(err, "ארכוב המשוב נכשל.");
        if (isAccess) setError("אין לך הרשאה לארכב משוב זה.");
      }
    },
    [selectedTraineeId, showArchived, handleError, refreshInsights],
  );

  const restoreFeedbackEntry = useCallback(
    async (id: string) => {
      if (!selectedTraineeId) return;
      const token = loadToken.current;
      setError(null);
      try {
        const restored = await api.restoreFeedback(id);
        if (loadToken.current !== token) return;
        setArchivedFeedback((prev) => prev.filter((f) => f.id !== id));
        setFeedback((prev) => [...prev, restored].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")));
        await refreshInsights(selectedTraineeId, token);
      } catch (err) {
        const isAccess = handleError(err, "שחזור המשוב נכשל.");
        if (isAccess) setError("אין לך הרשאה לשחזר משוב זה.");
      }
    },
    [selectedTraineeId, handleError, refreshInsights],
  );

  const setShowArchived = useCallback(
    (show: boolean) => {
      setShowArchivedState(show);
      if (show && selectedTraineeId) {
        const token = loadToken.current;
        patchLoading({ archived: true });
        api
          .fetchFeedback(selectedTraineeId, true)
          .then((all) => {
            if (loadToken.current === token) setArchivedFeedback(all.filter((f) => f.status === "archived"));
          })
          .catch((err) => handleError(err, "טעינת המשובים בארכיון נכשלה."))
          .finally(() => {
            if (loadToken.current === token) patchLoading({ archived: false });
          });
      }
    },
    [selectedTraineeId, handleError, patchLoading],
  );

  const polish = useCallback(
    async (input: FeedbackPolishInput): Promise<api.PolishResult | null> => {
      if (!selectedTraineeId) return null;
      try {
        return await api.polishFeedback(selectedTraineeId, input);
      } catch (err) {
        handleError(err, "ניסוח המשוב באמצעות AI נכשל.");
        return null;
      }
    },
    [selectedTraineeId, handleError],
  );

  // --- Source selection ------------------------------------------------------
  const toggleSource = useCallback(
    async (feedbackId: string, checked: boolean) => {
      const conv = await ensureConversation();
      if (!conv) return;
      const current = new Set(conv.selectedFeedbackIds);
      if (checked) current.add(feedbackId);
      else current.delete(feedbackId);
      const next = Array.from(current);
      // Optimistic — reflect the toggle immediately, reconcile with the server result.
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, selectedFeedbackIds: next } : c)));
      try {
        const updated = await api.updateConversation(conv.id, { selectedFeedbackIds: next });
        setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (err) {
        // Roll back the optimistic change.
        setConversations((prev) => prev.map((c) => (c.id === conv.id ? conv : c)));
        handleError(err, "עדכון בחירת המקורות נכשל.");
      }
    },
    [ensureConversation, handleError],
  );

  // --- Conversation actions --------------------------------------------------
  const selectConversation = useCallback(
    async (id: string) => {
      const token = loadToken.current;
      await loadConversation(id, token);
    },
    [loadConversation],
  );

  const startNewConversation = useCallback(async () => {
    if (!selectedTraineeId) return;
    try {
      const conv = await api.createConversation(selectedTraineeId);
      setConversations((prev) => [conv, ...prev]);
      setActiveConversationId(conv.id);
      setTurns([]);
      setNotices([]);
    } catch (err) {
      const isAccess = handleError(err, "פתיחת שיחה חדשה נכשלה.");
      if (isAccess) setTraineeAccessError("notfound");
    }
  }, [selectedTraineeId, handleError]);

  const archiveConversationEntry = useCallback(
    async (id: string) => {
      try {
        await api.archiveConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setTurns([]);
          setNotices([]);
        }
      } catch (err) {
        handleError(err, "ארכוב השיחה נכשל.");
      }
    },
    [activeConversationId, handleError],
  );

  const sendChat = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const conv = await ensureConversation();
      if (!conv) return;
      const token = loadToken.current;
      patchLoading({ sending: true });
      try {
        const res = await api.sendMessage(conv.id, trimmed);
        if (loadToken.current !== token) return;
        const newTurns = [res.userTurn, res.assistantTurn].filter((t): t is TurnDTO => t !== null);
        setTurns((prev) => [...prev, ...newTurns]);
        // Keep the conversation list ordered by recency.
        setConversations((prev) => {
          const bumped = prev.map((c) => (c.id === conv.id ? { ...c, lastMessageAt: new Date().toISOString() } : c));
          return [...bumped].sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
        });
        if (res.result.status === "not_configured") pushNotice("not_configured", res.result.message);
        else if (res.result.status === "error") pushNotice("error", res.result.message);
      } catch (err) {
        const isAccess = handleError(err, "שליחת ההודעה נכשלה.");
        if (isAccess) setError("אין לך הרשאה לשלוח הודעה בשיחה זו.");
      } finally {
        if (loadToken.current === token) patchLoading({ sending: false });
      }
    },
    [ensureConversation, patchLoading, pushNotice, handleError],
  );

  const runTask = useCallback(
    async (task: AIArtifactTask) => {
      if (!selectedTraineeId) return;
      const token = loadToken.current;
      patchLoading({ task });
      setError(null);
      try {
        const res = await api.runArtifactTask(task, {
          traineeId: selectedTraineeId,
          conversationId: activeConversationId,
          selectedFeedbackIds: activeConversationId ? undefined : Array.from(selectedFeedbackIdSet),
        });
        if (loadToken.current !== token) return;
        if (res.result.status === "ok") {
          pushNotice("task", ARTIFACT_DONE[task]);
          await refreshInsights(selectedTraineeId, token);
        } else if (res.result.status === "not_configured") {
          pushNotice("not_configured", res.result.message);
        } else {
          pushNotice("error", res.result.message);
        }
      } catch (err) {
        const isAccess = handleError(err, "הרצת המשימה נכשלה.");
        if (isAccess) setError("אין לך הרשאה להריץ משימה זו.");
      } finally {
        if (loadToken.current === token) patchLoading({ task: null });
      }
    },
    [selectedTraineeId, activeConversationId, selectedFeedbackIdSet, patchLoading, pushNotice, refreshInsights, handleError],
  );

  const value: WorkspaceContextValue = {
    trainees,
    username,
    ai,
    selectedCohortId,
    selectedTraineeId,
    selectedTrainee,
    expandedTraineeId,
    activeConversationId,
    feedback,
    archivedFeedback,
    insights,
    conversations,
    turns,
    notices,
    visibleTrainees,
    overviewInsight,
    reviewInsight,
    timelineInsight,
    finalEvalInsight,
    selectedFeedbackIdSet,
    selectedSourceCount,
    activeConversation,
    loading,
    error,
    traineeAccessError,
    showArchived,
    composerFocusSignal,
    activeTab,
    selectTrainee,
    selectCohort,
    toggleExpand,
    requestComposerFocus,
    dismissError,
    setActiveTab,
    addFeedback,
    editFeedback,
    archiveFeedbackEntry,
    restoreFeedbackEntry,
    setShowArchived,
    polish,
    toggleSource,
    selectConversation,
    startNewConversation,
    archiveConversationEntry,
    sendChat,
    runTask,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
