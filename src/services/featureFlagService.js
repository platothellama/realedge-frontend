const FeatureFlag = require('../models/featureFlag');

let featureCache = {};
let cacheTime = 0;
const CACHE_TTL = 60000;

async function refreshCache() {
  const now = Date.now();
  if (now - cacheTime > CACHE_TTL) {
    try {
      const flags = await FeatureFlag.findAll({ where: { enabled: true } });
      featureCache = flags.reduce((acc, flag) => {
        acc[flag.key] = {
          enabled: flag.enabled,
          enabledForRoles: flag.enabledForRoles || []
        };
        return acc;
      }, {});
      cacheTime = now;
    } catch (err) {
      console.error('Error refreshing feature cache:', err.message);
    }
  }
}

exports.isEnabled = async function(key, userRole = null) {
  await refreshCache();
  const feature = featureCache[key];
  if (!feature) return false;
  if (!feature.enabledForRoles || feature.enabledForRoles.length === 0) return true;
  if (!userRole) return true;
  return feature.enabledForRoles.includes(userRole);
};

exports.getEnabledFeatures = async function() {
  await refreshCache();
  return featureCache;
};

exports.clearCache = function() {
  featureCache = {};
  cacheTime = 0;
};