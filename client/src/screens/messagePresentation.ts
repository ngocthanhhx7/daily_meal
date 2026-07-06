import { colors } from "../theme/colors";

const participantAccents = [
  colors.green,
  colors.yellow,
  colors.blue,
  colors.greenDark,
  "#DFA24B",
  "#D98989"
];

type AvatarIdentity = {
  displayName?: string;
  id?: string;
};

export function getParticipantAccent(seed?: string) {
  if (!seed) {
    return colors.green;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return participantAccents[hash % participantAccents.length];
}

export function getParticipantAvatarLabel(identity: AvatarIdentity) {
  return identity.displayName?.trim().slice(0, 1).toUpperCase() || "D";
}
