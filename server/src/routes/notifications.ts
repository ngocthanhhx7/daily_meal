import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { Notification } from "../models/Notification.js";

export const notificationsRouter = Router();

// Get list of notifications for current authenticated user
notificationsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("sender", "displayName avatarUrl")
      .populate("post", "caption images")
      .lean();

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

// Mark all user's notifications as read
notificationsRouter.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user?.id, read: false }, { read: true });
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Mark single notification as read
notificationsRouter.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user?.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});
