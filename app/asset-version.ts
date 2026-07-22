export const assetCacheVersion = "2026-07-22-ribble-assets-v5";

export function appendAssetVersion(url: string) {
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}v=${encodeURIComponent(assetCacheVersion)}`;
}
