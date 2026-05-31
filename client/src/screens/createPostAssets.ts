type ResolvedAsset = {
  uri?: string;
};

type AssetResolver = (asset: any) => ResolvedAsset | undefined;

export function resolveRecentPhotoUri(asset: unknown, resolveAssetSource?: AssetResolver) {
  const resolved = resolveAssetSource?.(asset);

  if (resolved?.uri) {
    return resolved.uri;
  }

  if (typeof asset === "string") {
    return asset;
  }

  if (asset && typeof asset === "object") {
    const candidate = asset as { uri?: unknown; default?: { uri?: unknown } };
    if (typeof candidate.uri === "string") {
      return candidate.uri;
    }
    if (typeof candidate.default?.uri === "string") {
      return candidate.default.uri;
    }
  }

  return undefined;
}
