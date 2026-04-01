/*
 AXON Phase 5-A: Offline-First Asset Protocol (Mobile App). 
 This module is backend/persistent logic for prefetching and integrity-checking asset bundles from V-Vault.
*/

export interface PreCacheAsset {
    assetId: string;
    assetType: 'pdf' | 'video' | 'image' | 'doc';
    vaultPath: string;
    checksum: string; // SHA-256
    sizeBytes: number;
    expiresAt?: string;
}

export interface PreCacheJobStatus {
    workOrderId: string;
    installerId: number;
    assets: PreCacheAsset[];
    downloadedCount: number;
    totalCount: number;
    cacheVerified: boolean;
    lastUpdated: string;
}

export function buildPreCacheJob(workOrderId: string, installerId: number, assets: PreCacheAsset[]): PreCacheJobStatus {
    return {
        workOrderId,
        installerId,
        assets,
        downloadedCount: 0,
        totalCount: assets.length,
        cacheVerified: false,
        lastUpdated: new Date().toISOString()
    };
}

export async function downloadAsset(asset: PreCacheAsset, downloadFunction: (path: string) => Promise<Uint8Array>): Promise<Uint8Array> {
    const data = await downloadFunction(asset.vaultPath);
    return data;
}

export function verifyAssetIntegrity(asset: PreCacheAsset, content: Uint8Array, hashFunction: (data: Uint8Array) => string): boolean {
    const actual = hashFunction(content);
    return actual === asset.checksum;
}

export async function executePreCacheCycle(
    job: PreCacheJobStatus,
    downloadFunction: (path: string) => Promise<Uint8Array>,
    hashFunction: (data: Uint8Array) => string
): Promise<PreCacheJobStatus> {
    let downloadedCount = 0;
    let allVerified = true;

    for (const asset of job.assets) {
        const content = await downloadAsset(asset, downloadFunction);
        const verified = verifyAssetIntegrity(asset, content, hashFunction);
        if (!verified) {
            allVerified = false;
            break;
        }
        downloadedCount += 1;
    }

    return {
        ...job,
        downloadedCount,
        cacheVerified: allVerified && downloadedCount === job.totalCount,
        lastUpdated: new Date().toISOString(),
    };
}

export function canPunchIn(job: PreCacheJobStatus): boolean {
    return job.cacheVerified && job.downloadedCount === job.totalCount;
}
