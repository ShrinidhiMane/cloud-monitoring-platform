import { getSecureStore } from "./secureStore";

const FAVORITE_INSTANCE_IDS_KEY = "instances.favoriteIds";

let memoryFavoriteIds: string[] = [];

async function persistFavoriteIds(ids: string[]): Promise<void> {
  const normalizedIds = [...new Set(ids.filter((id) => id.trim().length > 0))];
  const secureStore = await getSecureStore();

  if (secureStore) {
    if (!normalizedIds.length) {
      await secureStore.deleteItemAsync(FAVORITE_INSTANCE_IDS_KEY);
      return;
    }

    await secureStore.setItemAsync(
      FAVORITE_INSTANCE_IDS_KEY,
      JSON.stringify(normalizedIds),
    );
    return;
  }

  memoryFavoriteIds = normalizedIds;
}

export async function readFavoriteInstanceIds(): Promise<string[]> {
  const secureStore = await getSecureStore();

  if (secureStore) {
    const rawValue = await secureStore.getItemAsync(FAVORITE_INSTANCE_IDS_KEY);
    if (!rawValue) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawValue);
      return Array.isArray(parsed)
        ? parsed.filter(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          )
        : [];
    } catch {
      return [];
    }
  }

  return memoryFavoriteIds;
}

export async function setFavoriteInstance(
  instanceId: string,
  shouldFavorite: boolean,
): Promise<string[]> {
  const currentIds = await readFavoriteInstanceIds();
  const nextIds = shouldFavorite
    ? [...currentIds, instanceId]
    : currentIds.filter((currentId) => currentId !== instanceId);

  await persistFavoriteIds(nextIds);
  return readFavoriteInstanceIds();
}

export async function toggleFavoriteInstance(
  instanceId: string,
): Promise<string[]> {
  const currentIds = await readFavoriteInstanceIds();
  const isFavorite = currentIds.includes(instanceId);

  return setFavoriteInstance(instanceId, !isFavorite);
}
