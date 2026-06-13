import { HttpError } from "../middleware/error.js";
import { UserInteraction } from "../models/UserInteraction.js";

function idString(value: unknown) {
  return value?.toString?.() ?? "";
}

export async function blockedUserIdsFor(viewerId: string | undefined) {
  if (!viewerId) {
    return new Set<string>();
  }

  const blocks = await UserInteraction.find({
    type: "block",
    $or: [{ actor: viewerId }, { target: viewerId }]
  })
    .select("actor target")
    .lean();

  return new Set(
    blocks
      .map((block) => {
        const actor = idString(block.actor);
        const target = idString(block.target);
        return actor === viewerId ? target : actor;
      })
      .filter(Boolean)
  );
}

export async function hasBlockBetween(a: string | undefined, b: string | undefined) {
  if (!a || !b || a === b) {
    return false;
  }

  const block = await UserInteraction.exists({
    type: "block",
    $or: [
      { actor: a, target: b },
      { actor: b, target: a }
    ]
  });

  return Boolean(block);
}

export async function hasBlockedViewer(viewerId: string | undefined, targetId: string | undefined) {
  if (!viewerId || !targetId || viewerId === targetId) {
    return false;
  }

  const block = await UserInteraction.exists({
    actor: targetId,
    target: viewerId,
    type: "block"
  });

  return Boolean(block);
}

export async function assertNotBlocked(a: string | undefined, b: string | undefined) {
  if (await hasBlockBetween(a, b)) {
    throw new HttpError(403, "This action is not allowed between blocked users");
  }
}

export async function assertTargetHasNotBlockedViewer(viewerId: string | undefined, targetId: string | undefined) {
  if (await hasBlockedViewer(viewerId, targetId)) {
    throw new HttpError(404, "User not found");
  }
}
