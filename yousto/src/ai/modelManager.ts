/**
 * modelManager.ts
 * Handles downloading, verifying, and locating the on-device LLM model.
 * The model is downloaded once on first launch and stored permanently in
 * the app's Documents directory.
 *
 * Model hosted on Cloudflare R2 via cdn.agowt.com — avoids App Store
 * security rejections that occur with direct HuggingFace downloads.
 */
import RNFS from 'react-native-fs';

// Llama-3.2-1B-Instruct Q4_K_M — served from Cloudflare R2 (cdn.agowt.com)
const MODEL_URL =
  'https://cdn.agowt.com/llama3-1b-q4km.gguf';

const MODEL_FILENAME = 'llama3-1b-q4km.gguf';
// Expected file size in bytes (approx 770 MB) — used to detect partial downloads
const MODEL_MIN_SIZE = 700 * 1024 * 1024;
// SHA-256 checksum of the canonical model file — verified after download
// Run: shasum -a 256 ~/Downloads/llama3-1b-q4km.gguf  to obtain this value
// Verified via: shasum -a 256 ~/Downloads/llama3-1b-q4km.gguf
const MODEL_SHA256: string | null = '6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83';

export const getModelPath = () => `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;

/**
 * Checks whether a valid (complete) model file exists in Documents.
 */
export const isModelDownloaded = async (): Promise<boolean> => {
  try {
    const exists = await RNFS.exists(getModelPath());
    if (!exists) return false;
    const stat = await RNFS.stat(getModelPath());
    return Number(stat.size) >= MODEL_MIN_SIZE;
  } catch {
    return false;
  }
};

export type DownloadProgressCallback = (progress: number, downloadedMB: number, totalMB: number) => void;
export type DownloadCompleteCallback = () => void;
export type DownloadErrorCallback = (error: string) => void;

let activeDownloadJob: { jobId: number; promise: Promise<RNFS.DownloadResult> } | null = null;

/**
 * Downloads the model file to the Documents directory.
 * Supports progress reporting. Cleans up partial files on error.
 */
export const downloadModel = (
  onProgress: DownloadProgressCallback,
  onComplete: DownloadCompleteCallback,
  onError: DownloadErrorCallback
): (() => void) => {
  const destPath = getModelPath();

  // Clean up any previous partial download
  RNFS.exists(destPath).then((exists) => {
    if (exists) {
      RNFS.stat(destPath).then((stat) => {
        if (Number(stat.size) < MODEL_MIN_SIZE) {
          // Partial file — delete and restart
          RNFS.unlink(destPath).catch(() => {});
        }
      });
    }
  });

  const { jobId, promise } = RNFS.downloadFile({
    fromUrl: MODEL_URL,
    toFile: destPath,
    background: false,
    discretionary: false,
    progress: (res) => {
      const downloadedMB = res.bytesWritten / (1024 * 1024);
      const totalMB = res.contentLength / (1024 * 1024);
      const pct = totalMB > 0 ? Math.min((res.bytesWritten / res.contentLength) * 100, 100) : 0;
      onProgress(pct, downloadedMB, totalMB);
    },
    progressDivider: 1,
  });

  activeDownloadJob = { jobId, promise };

  promise
    .then(async (result) => {
      activeDownloadJob = null;
      if (result.statusCode !== 200) {
        await RNFS.unlink(destPath).catch(() => {});
        onError(`Download failed with HTTP ${result.statusCode}`);
        return;
      }

      // ── Checksum verification ────────────────────────────────────────────
      if (MODEL_SHA256) {
        try {
          const actualHash = await RNFS.hash(destPath, 'sha256');
          if (actualHash.toLowerCase() !== MODEL_SHA256.toLowerCase()) {
            await RNFS.unlink(destPath).catch(() => {});
            onError('Model file checksum mismatch — the download may be corrupted. Please retry.');
            return;
          }
        } catch (hashErr) {
          // Non-fatal: proceed without checksum if hashing fails
          console.warn('[modelManager] Checksum verification failed:', hashErr);
        }
      }

      onComplete();
    })
    .catch((err) => {
      activeDownloadJob = null;
      if (err?.message?.includes('cancelled')) return; // User-cancelled, not an error
      RNFS.unlink(destPath).catch(() => {});
      onError(err?.message ?? 'Unknown download error');
    });

  // Return a cancel function
  return () => {
    if (activeDownloadJob) {
      RNFS.stopDownload(activeDownloadJob.jobId);
      activeDownloadJob = null;
    }
  };
};
