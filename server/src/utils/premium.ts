export function hasActivePremium(user: any, now = new Date()) {
  if (user?.isPremium) {
    return true;
  }

  const trialEndsAt = user?.premiumTrialEndsAt ? new Date(user.premiumTrialEndsAt) : undefined;
  return Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
}

export function premiumTrialDto(user: any) {
  return {
    premiumTrialUsed: Boolean(user?.premiumTrialUsed),
    premiumTrialStartedAt: user?.premiumTrialStartedAt?.toISOString?.(),
    premiumTrialEndsAt: user?.premiumTrialEndsAt?.toISOString?.()
  };
}
