import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { emitToUser, broadcastToRoom } from "../services/socket.js";

export const messagesRouter = Router();

const conversationBodySchema = z.object({
  recipientId: z.string().min(1)
});

const messageBodySchema = z.object({
  body: z.string().min(1).max(2000)
});

function participantKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function userDto(user: any) {
  return {
    id: user._id?.toString?.() ?? user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isPremium: user.isPremium
  };
}

function messageDto(message: any) {
  return {
    id: message._id.toString(),
    conversationId: message.conversation.toString(),
    sender: userDto(message.sender),
    body: message.body,
    createdAt: message.createdAt
  };
}

function conversationDto(conversation: any, viewerId: string) {
  const participants = conversation.participants.map(userDto);
  const otherUser = participants.find((participant: any) => participant.id !== viewerId) ?? participants[0];

  return {
    id: conversation._id.toString(),
    participants,
    otherUser,
    lastMessage: conversation.lastMessage ?? { body: "" },
    updatedAt: conversation.updatedAt
  };
}

async function assertParticipant(conversationId: string, viewerId: string) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: viewerId
  });

  if (!conversation) {
    throw new HttpError(404, "Conversation not found");
  }

  return conversation;
}

messagesRouter.get("/conversations", requireAuth, async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user?.id })
      .sort({ updatedAt: -1 })
      .populate("participants", "displayName avatarUrl isPremium")
      .lean();

    res.json({
      conversations: conversations.map((conversation) =>
        conversationDto(conversation, req.user?.id ?? "")
      )
    });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post("/conversations", requireAuth, async (req, res, next) => {
  try {
    const body = conversationBodySchema.parse(req.body);

    if (body.recipientId === req.user?.id) {
      throw new HttpError(400, "Cannot message yourself");
    }

    const recipient = await User.findById(body.recipientId).select("_id").lean();

    if (!recipient) {
      throw new HttpError(404, "User not found");
    }

    const key = participantKey(req.user?.id ?? "", body.recipientId);
    const conversation = await Conversation.findOneAndUpdate(
      { participantKey: key },
      {
        $setOnInsert: {
          participants: [req.user?.id, body.recipientId],
          participantKey: key
        }
      },
      { new: true, upsert: true }
    )
      .populate("participants", "displayName avatarUrl isPremium")
      .lean();

    res.status(201).json({ conversation: conversationDto(conversation, req.user?.id ?? "") });
  } catch (error) {
    next(error);
  }
});

messagesRouter.get("/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    if (!conversationId) {
      throw new HttpError(400, "Conversation id is required");
    }
    await assertParticipant(conversationId, req.user?.id ?? "");

    const messages = await Message.find({ conversation: conversationId })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate("sender", "displayName avatarUrl isPremium")
      .lean();

    res.json({ messages: messages.map(messageDto) });
  } catch (error) {
    next(error);
  }
});

messagesRouter.post("/conversations/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const body = messageBodySchema.parse(req.body);
    const conversationId = req.params.id;
    if (!conversationId) {
      throw new HttpError(400, "Conversation id is required");
    }
    const conversation = await assertParticipant(conversationId, req.user?.id ?? "");

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user?.id,
      body: body.body,
      readBy: [req.user?.id]
    });

    conversation.lastMessage = {
      body: message.body,
      sender: message.sender,
      sentAt: message.createdAt
    };
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate("sender", "displayName avatarUrl isPremium")
      .lean();

    if (!populated) {
      throw new HttpError(404, "Message not found");
    }

    const formattedMessage = messageDto(populated);

    // 1. Broadcast new message in real-time to the specific conversation room
    broadcastToRoom(`conversation:${conversationId}`, "message:created", formattedMessage);

    // 2. Trigger notification for the recipient participant
    const recipientId = conversation.participants.find(p => p.toString() !== req.user?.id)?.toString();
    if (recipientId) {
      const senderName = (populated.sender as any)?.displayName || "Ai đó";
      const snippet = body.body.length > 50 ? `${body.body.slice(0, 50)}...` : body.body;

      const notification = await Notification.create({
        user: recipientId,
        sender: req.user?.id,
        type: "message",
        body: `đã gửi tin nhắn: "${snippet}"`
      });

      const populatedNotification = await Notification.findById(notification._id)
        .populate("sender", "displayName avatarUrl")
        .lean();

      emitToUser(recipientId, "notification:created", populatedNotification);
    }

    res.status(201).json({ message: formattedMessage });
  } catch (error) {
    next(error);
  }
});
