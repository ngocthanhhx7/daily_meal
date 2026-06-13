export function hasActivePremium(user: any, now = new Date()) {
  const paidEndsAt = user?.premiumPaidEndsAt ? new Date(user.premiumPaidEndsAt) : undefined;

  if (paidEndsAt && paidEndsAt.getTime() > now.getTime()) {
    return true;
  }

  const trialEndsAt = user?.premiumTrialEndsAt ? new Date(user.premiumTrialEndsAt) : undefined;
  if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
    return true;
  }

  return Boolean(user?.isPremium && !paidEndsAt);
}

export function premiumTrialDto(user: any) {
  return {
    premiumTrialUsed: Boolean(user?.premiumTrialUsed),
    premiumTrialStartedAt: user?.premiumTrialStartedAt?.toISOString?.(),
    premiumTrialEndsAt: user?.premiumTrialEndsAt?.toISOString?.(),
    premiumPaidEndsAt: user?.premiumPaidEndsAt?.toISOString?.()
  };
}
