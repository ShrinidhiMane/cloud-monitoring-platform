import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const AWS_SETUP_PROFILES_KEY = "aws.setup.profiles";
const AWS_SETUP_ACTIVE_ID_KEY = "aws.setup.activeId";

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

const memoryStore: Record<string, string | null> = {};
let secureStoreAvailable: Promise<boolean> | null = null;

export interface AwsSetupProfile {
  id: string;
  label: string;
  region: string;
  backendUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | null;
  instanceId: string;
  instanceName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AwsSetupProfileInput {
  label: string;
  region: string;
  backendUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | null;
  instanceId: string;
  instanceName?: string;
  notes?: string;
}

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  if (!secureStoreAvailable) {
    secureStoreAvailable = SecureStore.isAvailableAsync().catch(() => false);
  }

  return secureStoreAvailable;
}

async function setItem(key: string, value: string | null): Promise<void> {
  const normalized = value?.trim() ? value : null;

  if (await canUseSecureStore()) {
    if (!normalized) {
      await SecureStore.deleteItemAsync(key);
      return;
    }

    await SecureStore.setItemAsync(key, normalized, STORE_OPTIONS);
    return;
  }

  memoryStore[key] = normalized;
}

async function getItem(key: string): Promise<string | null> {
  if (await canUseSecureStore()) {
    return SecureStore.getItemAsync(key);
  }

  return memoryStore[key] ?? null;
}

async function readProfiles(): Promise<AwsSetupProfile[]> {
  const raw = await getItem(AWS_SETUP_PROFILES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as AwsSetupProfile[];
    return parsed.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  } catch {
    return [];
  }
}

async function writeProfiles(profiles: AwsSetupProfile[]): Promise<void> {
  await setItem(AWS_SETUP_PROFILES_KEY, JSON.stringify(profiles));
}

function createProfileId(): string {
  return `aws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listAwsSetupProfiles(): Promise<AwsSetupProfile[]> {
  return readProfiles();
}

export async function getActiveAwsSetupId(): Promise<string | null> {
  return getItem(AWS_SETUP_ACTIVE_ID_KEY);
}

export async function setActiveAwsSetup(id: string | null): Promise<void> {
  await setItem(AWS_SETUP_ACTIVE_ID_KEY, id);
}

export async function getActiveAwsSetup(): Promise<AwsSetupProfile | null> {
  const [profiles, activeId] = await Promise.all([
    readProfiles(),
    getActiveAwsSetupId(),
  ]);

  if (!profiles.length) {
    return null;
  }

  if (!activeId) {
    return profiles[0];
  }

  return profiles.find((profile) => profile.id === activeId) ?? profiles[0];
}

export async function saveAwsSetupProfile(
  input: AwsSetupProfileInput,
): Promise<AwsSetupProfile> {
  const timestamp = new Date().toISOString();
  const nextProfile: AwsSetupProfile = {
    id: createProfileId(),
    label: input.label.trim(),
    region: input.region.trim(),
    backendUrl: input.backendUrl.trim(),
    accessKeyId: input.accessKeyId.trim(),
    secretAccessKey: input.secretAccessKey.trim(),
    sessionToken: input.sessionToken?.trim() || null,
    instanceId: input.instanceId.trim(),
    instanceName: input.instanceName?.trim() || "",
    notes: input.notes?.trim() || "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const profiles = await readProfiles();
  profiles.unshift(nextProfile);

  await Promise.all([
    writeProfiles(profiles),
    setActiveAwsSetup(nextProfile.id),
  ]);

  return nextProfile;
}

export async function deleteAwsSetupProfile(id: string): Promise<void> {
  const [profiles, activeId] = await Promise.all([
    readProfiles(),
    getActiveAwsSetupId(),
  ]);

  const filteredProfiles = profiles.filter((profile) => profile.id !== id);

  await writeProfiles(filteredProfiles);

  if (activeId === id) {
    await setActiveAwsSetup(filteredProfiles[0]?.id ?? null);
  }
}
