/** Host serving library assets when no library asset host is configured. */
const LEGACY_LIBRARY_ASSET_HOST = 'https://cdn.assets.scratch.mit.edu';

/**
 * Optional asset host override. When set (may be an empty string for same-origin),
 * all library asset requests go there instead of the public Scratch asset service.
 * Used by offline desktop builds that bundle the library assets locally.
 */
const getAssetHostOverride = (): string | null => {
    if (typeof window !== 'undefined') {
        const override = (window as {SCRATCH_ASSET_HOST?: unknown}).SCRATCH_ASSET_HOST;
        if (typeof override === 'string') {
            return override;
        }
    }
    return null;
};

/**
 * Build the URL a library asset is fetched from, in the shape Scratch's asset service uses.
 * @param {string} assetId - the md5 of the asset.
 * @param {string} dataFormat - the asset's file extension.
 * @param {string} [host] - the host serving the assets, without a trailing slash.
 *   When omitted or empty, the host override (if set) or the public Scratch asset service is used.
 * @returns {string} - the URL to fetch the asset from.
 */
export const buildLibraryAssetUrl = (assetId: string, dataFormat: string, host?: string): string => {
    const effectiveHost = host || getAssetHostOverride();
    if (!effectiveHost) {
        return `${LEGACY_LIBRARY_ASSET_HOST}/internalapi/asset/${assetId}.${dataFormat}/get/`;
    }
    return `${effectiveHost}/internalapi/asset/${assetId}.${dataFormat}/get/`;
};
