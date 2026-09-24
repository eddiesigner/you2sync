// Spotify accepts base64 JPEG covers up to 256 KB (after encoding).
const MAX_BASE64_BYTES = 256 * 1024
// Try progressively smaller renditions until one fits.
const SIZES = [640, 500, 400, 300]
const GOOGLE_IMAGE_HOST = 'googleusercontent.com'

// Google image URLs accept size/format options after "=": "-rj" means JPEG.
function sizedUrl(url: string, size: number): string {
  if (!url.includes(GOOGLE_IMAGE_HOST)) {
    return url
  }
  return `${url.replace(/=[^/]*$/, '')}=w${size}-h${size}-l90-rj`
}

export async function fetchCoverJpeg(url: string): Promise<Buffer | undefined> {
  for (const size of SIZES) {
    const response = await fetch(sizedUrl(url, size))
    if (!response.ok || !response.headers.get('content-type')?.includes('jpeg')) {
      continue
    }

    const jpeg = Buffer.from(await response.arrayBuffer())
    if (Math.ceil(jpeg.length / 3) * 4 <= MAX_BASE64_BYTES) {
      return jpeg
    }
  }
  return undefined
}
