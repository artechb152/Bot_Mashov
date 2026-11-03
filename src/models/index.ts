/** Barrel export for all Mongoose models. */
export { User, type UserDoc } from "./User";
export { Trainee, type TraineeDoc } from "./Trainee";
export { TraineeAttachment, type TraineeAttachmentDoc } from "./TraineeAttachment";
export { Feedback, type FeedbackDoc } from "./Feedback";
export { Simulation, type SimulationDoc } from "./Simulation";
export { Scenario, type ScenarioDoc } from "./Scenario";
export { FinalExercise, type FinalExerciseDoc } from "./FinalExercise";
export { KnowledgeDocument, type KnowledgeDocumentDoc } from "./KnowledgeDocument";

// Organizational hierarchy + governance (RBAC/org redesign).
export { Course, type CourseDoc } from "./Course";
export { Cohort, type CohortDoc } from "./Cohort";
export { Team, type TeamDoc } from "./Team";
export { UserAssignment, type UserAssignmentDoc } from "./UserAssignment";
export { AuditLog, type AuditLogDoc, AUDIT_TARGET_TYPES, type AuditTargetType } from "./AuditLog";
export {
  AdminInvite,
  type AdminInviteDoc,
  ADMIN_INVITE_STATUSES,
  type AdminInviteStatus,
} from "./AdminInvite";
export { Notification, type NotificationDoc } from "./Notification";

// Internal messaging.
export { InternalMessageThread, type InternalMessageThreadDoc } from "./InternalMessageThread";
export { InternalMessage, type InternalMessageDoc } from "./InternalMessage";
export { ThreadParticipantState, type ThreadParticipantStateDoc } from "./ThreadParticipantState";
export { MessageAttachment, type MessageAttachmentDoc } from "./MessageAttachment";
export { MessageDraft, type MessageDraftDoc } from "./MessageDraft";

// Access requests + trainee-access grants.
export { AccessRequest, type AccessRequestDoc } from "./AccessRequest";
export { TraineeAccessGrant, type TraineeAccessGrantDoc } from "./TraineeAccessGrant";

// AI assistant conversations + versioned trainee insights.
export { AssistantConversation, type AssistantConversationDoc } from "./AssistantConversation";
export { AssistantTurn, type AssistantTurnDoc } from "./AssistantTurn";
export { TraineeAIInsight, type TraineeAIInsightDoc } from "./TraineeAIInsight";
