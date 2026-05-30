type PwaEnvironmentInput = {
  platform?: string;
  userAgent?: string;
  standalone?: boolean;
  maxTouchPoints?: number;
};

export type PwaEnvironment = {
  isWeb: boolean;
  isIos: boolean;
  isSafari: boolean;
  isStandalone: boolean;
  isInstallCapableIosSafari: boolean;
  isIosInAppBrowser: boolean;
};

function readNavigator() {
  if (typeof navigator === "undefined") {
    return { userAgent: "", maxTouchPoints: 0 };
  }

  return {
    userAgent: navigator.userAgent ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0
  };
}

function readStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  const mediaStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return mediaStandalone || navigatorStandalone;
}

export function getPwaEnvironment(input: PwaEnvironmentInput = {}): PwaEnvironment {
  const nav = readNavigator();
  const platform = input.platform ?? "web";
  const userAgent = input.userAgent ?? nav.userAgent;
  const maxTouchPoints = input.maxTouchPoints ?? nav.maxTouchPoints;
  const standalone = input.standalone ?? readStandalone();

  const isWeb = platform === "web";
  const isIphoneOrIpod = /iPhone|iPod/i.test(userAgent);
  const isIpad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1 && /Mobile/i.test(userAgent));
  const isIos = isIphoneOrIpod || isIpad;
  const hasSafari = /Safari/i.test(userAgent);
  const hasSafariVersion = /Version\/[\d.]+/i.test(userAgent);
  const isExcludedIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Instagram|FBAN|FBAV|Line|MicroMessenger/i.test(userAgent);
  const isSafari = hasSafari && hasSafariVersion && !isExcludedIosBrowser;

  return {
    isWeb,
    isIos,
    isSafari,
    isStandalone: standalone,
    isInstallCapableIosSafari: isWeb && isIos && isSafari,
    isIosInAppBrowser: isWeb && isIos && !isSafari
  };
}

export function shouldShowIosInstallGate(input: PwaEnvironmentInput = {}) {
  const environment = getPwaEnvironment(input);
  return environment.isInstallCapableIosSafari && !environment.isStandalone;
}
