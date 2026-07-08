type Preferences = {
  interests?: string[];
  eatingStyles?: string[];
};

type PostSearchInput = {
  _id?: unknown;
  author?: any;
  caption?: string;
  tags?: string[];
  recipe?: { title?: string; ingredients?: string[] };
  recipes?: Array<{ title?: string; ingredients?: string[] }>;
  nutritionSummary?: { calories?: number } | null;
  stats?: { likes?: number; saves?: number; comments?: number } | null;
  createdAt?: Date | string;
};

type UserSearchInput = {
  _id?: unknown;
  id?: string;
  displayName?: string;
  email?: string | null;
  bio?: string | null;
  preferences?: Preferences | null;
  counts?: { posts?: number; followers?: number } | null;
};

type RankContext = {
  query?: string;
  viewerId?: string;
  viewerPreferences?: Preferences | null;
  followingIds?: Set<string>;
  friendIds?: Set<string>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rawText(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function idOf(value: unknown) {
  return (value as any)?._id?.toString?.() ?? (value as any)?.id?.toString?.() ?? (value as any)?.toString?.() ?? "";
}

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}

function preferenceValues(preferences?: Preferences | null) {
  return [...(preferences?.interests ?? []), ...(preferences?.eatingStyles ?? [])];
}

function preferenceProfile(preferences?: Preferences | null) {
  const values = preferenceValues(preferences);
  const haystack = `${values.map(rawText).join(" ")} ${values.map(normalizeText).join(" ")}`;
  const keywords = new Set(values.flatMap((value) => normalizeText(value).split(/\s+/)).filter(Boolean));
  let wantsLowCalorie = false;

  const add = (...items: string[]) => {
    for (const item of items) {
      keywords.add(item);
    }
  };

  if (/recipe|cong thuc|công thức|cã´ng|thá»©c|nau|nấu|note|ingredient/.test(haystack)) {
    add("recipe", "cooking", "ingredient", "ingredients", "healthy");
  }
  if (/an uong|ăn uống|food|meal|m[oó]n|mã³n|Äƒn/.test(haystack)) {
    add("food", "meal", "mon", "dish");
  }
  if (/calo|calorie|deficit|thâm hụt|thã¢m|healthy/.test(haystack)) {
    wantsLowCalorie = true;
    add("calo", "calorie", "healthy", "light");
  }
  if (/keto/.test(haystack)) {
    add("keto", "lowcarb", "low carb");
  }
  if (/chay|vegan|vegetarian/.test(haystack)) {
    add("chay", "vegan", "vegetarian");
  }

  return { keywords: [...keywords], wantsLowCalorie };
}

function textMatchScore(query: string | undefined, fields: string[]) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return 0;
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const combined = fields.map(normalizeText).join(" ");
  let score = combined.includes(normalizedQuery) ? 20 : 0;
  for (const term of terms) {
    if (combined.includes(term)) {
      score += 4;
    }
  }
  return score;
}

function preferenceScore(fields: string[], preferences?: Preferences | null, nutrition?: { calories?: number } | null) {
  const profile = preferenceProfile(preferences);
  if (!profile.keywords.length && !profile.wantsLowCalorie) {
    return 0;
  }

  const combined = fields.map(normalizeText).join(" ");
  let score = 0;
  for (const keyword of profile.keywords) {
    if (keyword && combined.includes(normalizeText(keyword))) {
      score += 6;
    }
  }

  if (profile.wantsLowCalorie && typeof nutrition?.calories === "number") {
    if (nutrition.calories <= 500) {
      score += 30;
    } else if (nutrition.calories <= 700) {
      score += 10;
    }
  }

  return clamp(score, 60);
}

function relationshipScore(targetId: string, context: RankContext) {
  if (context.viewerId && targetId === context.viewerId) {
    return 4;
  }
  if (context.friendIds?.has(targetId)) {
    return 10;
  }
  if (context.followingIds?.has(targetId)) {
    return 6;
  }
  return 0;
}

function engagementScore(stats?: { likes?: number; saves?: number; comments?: number } | null) {
  return clamp((stats?.likes ?? 0) + (stats?.saves ?? 0) * 2 + (stats?.comments ?? 0), 40) / 8;
}

function recencyScore(createdAt?: Date | string) {
  if (!createdAt) {
    return 0;
  }
  const ageDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / MS_PER_DAY);
  return clamp(8 - ageDays, 8);
}

function postFields(post: PostSearchInput) {
  return [
    post.caption,
    ...(post.tags ?? []),
    post.recipe?.title,
    ...(post.recipe?.ingredients ?? []),
    ...(post.recipes ?? []).flatMap((recipe) => [recipe.title, ...(recipe.ingredients ?? [])])
  ].filter(Boolean) as string[];
}

function userFields(user: UserSearchInput) {
  return [
    user.displayName,
    user.email,
    user.bio,
    ...preferenceValues(user.preferences)
  ].filter(Boolean) as string[];
}

function diversityLimit<T>(items: T[], getAuthorId: (item: T) => string) {
  const result: T[] = [];
  const deferred: T[] = [];
  let lastAuthor = "";
  let runLength = 0;

  for (const item of items) {
    const authorId = getAuthorId(item);
    if (authorId && authorId === lastAuthor && runLength >= 2) {
      deferred.push(item);
      continue;
    }
    result.push(item);
    if (authorId === lastAuthor) {
      runLength += 1;
    } else {
      lastAuthor = authorId;
      runLength = 1;
    }
  }

  return [...result, ...deferred];
}

export function rankPostsForSearch<T extends PostSearchInput>(posts: T[], context: RankContext) {
  const ranked = [...posts].sort((a, b) => {
    const score = (post: T) => {
      const authorId = idOf(post.author);
      const fields = postFields(post);
      return (
        textMatchScore(context.query, fields) +
        preferenceScore(fields, context.viewerPreferences, post.nutritionSummary) +
        relationshipScore(authorId, context) +
        engagementScore(post.stats) +
        recencyScore(post.createdAt)
      );
    };
    const scoreDiff = score(b) - score(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  return diversityLimit(ranked, (post) => idOf(post.author));
}

export function rankUsersForSearch<T extends UserSearchInput>(users: T[], context: RankContext) {
  return [...users].sort((a, b) => {
    const score = (user: T) => {
      const userId = idOf(user._id ?? user.id);
      const fields = userFields(user);
      const sharedPreferences = preferenceValues(user.preferences).filter((value) =>
        preferenceValues(context.viewerPreferences).some((viewerValue) => normalizeText(viewerValue) === normalizeText(value))
      ).length;
      return (
        textMatchScore(context.query, fields) +
        preferenceScore(fields, context.viewerPreferences) +
        sharedPreferences * 8 +
        relationshipScore(userId, context) +
        clamp((user.counts?.followers ?? 0) + (user.counts?.posts ?? 0) * 2, 30) / 3
      );
    };
    const scoreDiff = score(b) - score(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return String(a.displayName ?? "").localeCompare(String(b.displayName ?? ""));
  });
}
