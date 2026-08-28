export interface PexelsVideo {
  id: number;
  duration: number;
  width: number;
  height: number;
  image: string;
  url: string;
  photographer: string;
  photographerUrl: string;
  videoUrl: string;
}

export interface PexelsSearchResult {
  videos: PexelsVideo[];
  totalResults: number;
  page: number;
  perPage: number;
  nextPage: string | null;
}

export async function searchPexelsVideos(
  query: string,
  page: number = 1,
  signal?: AbortSignal,
): Promise<PexelsSearchResult> {
  const res = await fetch(
    `/api/pexels/search?query=${encodeURIComponent(query)}&page=${page}&per_page=30`,
    { signal },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to search Pexels");
  }
  return res.json();
}
