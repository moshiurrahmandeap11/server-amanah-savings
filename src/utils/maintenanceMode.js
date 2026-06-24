import { db } from "../database/db.js";

const DEFAULT_MESSAGE = "We are currently under maintenance. Please try again later.";
const CACHE_TTL_MS = 10000;

let maintenanceCache = {
  expiresAt: 0,
  data: {
    mode: false,
    message: DEFAULT_MESSAGE,
    allowedIps: [],
  },
};

export const clearMaintenanceCache = () => {
  maintenanceCache.expiresAt = 0;
};

export const getMaintenanceState = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && maintenanceCache.expiresAt > now) {
    return maintenanceCache.data;
  }

  const settingsCollection = db.collection("platform_settings");
  const settings = await settingsCollection.findOne(
    { key: "platform" },
    { projection: { maintenance: 1 } },
  );

  const mode = Boolean(settings?.maintenance?.mode);
  const message = settings?.maintenance?.message || DEFAULT_MESSAGE;
  const allowedIps = Array.isArray(settings?.maintenance?.allowedIps)
    ? settings.maintenance.allowedIps
    : [];

  maintenanceCache = {
    expiresAt: now + CACHE_TTL_MS,
    data: {
      mode,
      message,
      allowedIps,
    },
  };

  return maintenanceCache.data;
};
