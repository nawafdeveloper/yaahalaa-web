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
          conversationId?: string;
          conversationType: "direct" | "group";
          senderPhone: string;
          recipientPhone?: string;
          participantIds?: string[];
          content: string;
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
          type: "NEW_MESSAGE";
          conversationId: string;
          conversationType: "direct" | "group";
          message: unknown;
      }
    | {
          type: "CONVERSATION_UPDATED";
          conversationId: string;
          conversationType: "direct" | "group";
          lastMessage: unknown;
          unreadCount: number;
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
