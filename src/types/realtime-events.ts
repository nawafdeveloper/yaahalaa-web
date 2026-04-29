import type { Message } from "./messages.type";
import type {
    EncryptedContentEnvelope,
    RecipientEncryptedAesKeyInput,
} from "./crypto";

type RealtimeMessage = Omit<Message, "created_at" | "updated_at"> & {
    created_at: string;
    updated_at: string;
};

export type ClientRealtimeEvent =
    | {
          type: "JOIN_CONVERSATION";
          conversationId: string;
      }
    | {
          type: "LEAVE_CONVERSATION";
          conversationId?: string;
      }
    | {
          type: "SEND_MESSAGE";
          clientMessageId?: string;
          conversationId?: string;
          conversationType: "direct" | "group";
          senderUserId?: string;
          senderNickname?: string;
          recipientUserId?: string;
          senderPhone?: string;
          recipientPhone?: string;
          participantIds?: string[];
          content?: string;
          messageTextContent?: string | null;
          attachedMedia?: Message["attached_media"];
          mediaUrl?: string | null;
          videoThumbnail?: string | null;
          encryptedContent?: EncryptedContentEnvelope | null;
          recipientEncryptionKeys?: RecipientEncryptedAesKeyInput[] | null;
          encryptedChatPreview?: EncryptedContentEnvelope | null;
          chatPreviewRecipientKeys?: RecipientEncryptedAesKeyInput[] | null;
      }
    | {
          type: "MARK_DELIVERED";
          conversationId: string;
          messageId?: string;
      }
    | {
          type: "MARK_READ";
          conversationId: string;
          messageId?: string;
      };

export type ServerRealtimeEvent =
    | {
          type: "MESSAGE_SENT";
          conversationId: string;
          conversationType: "direct" | "group";
          clientMessageId: string | null;
          message: RealtimeMessage;
      }
    | {
          type: "NEW_MESSAGE";
          conversationId: string;
          conversationType: "direct" | "group";
          message: RealtimeMessage;
      }
    | {
          type: "CONVERSATION_UPDATED";
          conversationId: string;
          conversationType: "direct" | "group";
          lastMessage: RealtimeMessage;
          unreadCount: number;
      }
    | {
          type: "CONVERSATION_PRESENCE";
          conversationId: string;
          status: "joined" | "left";
          userId: string;
          activeUsers: string[];
          activeUsersCount: number;
      }
    | {
          type: "MARK_DELIVERED";
          conversationId: string;
          messageId: string | null;
          userId: string;
      }
    | {
          type: "MARK_READ";
          conversationId: string;
          messageId: string | null;
          userId: string;
      }
    | {
          type: "ERROR";
          message: string;
      };
