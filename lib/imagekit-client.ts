export interface ImageKitFile {
  fileId: string;
  name: string;
  url: string;
  thumbnail: string;
  fileType: string;
  mime: string;
  height: number;
  width: number;
  filePath: string;
}

export async function fetchImageKitVideos(folder: string): Promise<ImageKitFile[]> {
  const res = await fetch(`/api/imagekit?folder=${encodeURIComponent(folder)}&fileType=non-image`);
  if (!res.ok) throw new Error("Failed to fetch ImageKit videos");
  const data = await res.json();
  return (data.files || []).filter((f: any) => f.mime?.startsWith("video/") || f.fileType === "non-image");
}

export const IMAGEKIT_CATEGORIES = [
  { id: "nature", label: "Nature", icon: "🌿" },
  { id: "sky", label: "Sky", icon: "☁️" },
  { id: "water", label: "Water", icon: "🌊" },
  { id: "city", label: "City", icon: "🏙️" },
  { id: "abstract", label: "Abstract", icon: "✨" },
  { id: "islamic", label: "Islamic", icon: "🕌" },
];
