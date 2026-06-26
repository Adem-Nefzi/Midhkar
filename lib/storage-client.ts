export interface StorageVideo {
  id: string;
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

export async function fetchStorageVideos(): Promise<StorageVideo[]> {
  const res = await fetch("/api/storage");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Failed to fetch videos");
  }
  const data = await res.json();
  return (data.files ?? []) as StorageVideo[];
}
