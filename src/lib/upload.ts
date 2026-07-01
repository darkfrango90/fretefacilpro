import { supabase } from "@/integrations/supabase/client";

export async function uploadPhoto(
  bucket: "odometros" | "abastecimentos",
  empresaId: string,
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const id = crypto.randomUUID();
  const path = `${empresaId}/${userId}/${id}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export function getGps(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}
