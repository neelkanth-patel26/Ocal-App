// Ocal Browser - uBlock Origin Core Engine Wrapper
// Powered by Raymond Hill's @gorhill/ubo-core static network filtering engine
import { StaticNetFilteringEngine } from '@gorhill/ubo-core';

// Core uBlock Origin filter ruleset (EasyList, EasyPrivacy, uBlock Filters, Peter Lowe's)
const BUILTIN_UBLOCK_RULES = `
! -------------------------------------------------------------------
! uBlock Origin Core Built-in Rules for Ocal Browser
! -------------------------------------------------------------------

! Common Ad Networks & Exchanges
||doubleclick.net^
||googlesyndication.com^
||googleadservices.com^
||adservice.google.com^
||pagead2.googlesyndication.com^
||adnxs.com^
||criteo.com^
||criteo.net^
||amazon-adsystem.com^
||adsystem.com^
||rubiconproject.com^
||pubmatic.com^
||casalemedia.com^
||openx.net^
||appnexus.com^
||smartadserver.com^
||serving-sys.com^
||bidswitch.net^
||yieldmo.com^
||indexexchange.com^
||sovrn.com^
||lijit.com^
||undertone.com^
||outbrain.com^
||taboola.com^
||mgid.com^
||revcontent.com^
||adblade.com^
||zergnet.com^

! Telemetry, Cross-site Trackers & Behavioral Analytics
||google-analytics.com^
||analytics.google.com^
||hotjar.com^
||clarity.ms^
||scorecardresearch.com^
||quantserve.com^
||moatads.com^
||pixel.facebook.com^
||connect.facebook.net/en_US/fbevents.js
||ads.twitter.com^
||static.ads-twitter.com^
||adroll.com^
||advertising.com^
||chartbeat.com^
||chartbeat.net^
||yandex.ru/metrika
||mc.yandex.ru^
||mouseflow.com^
||crazyegg.com^
||segment.io^
||mixpanel.com^
||branch.io^
||appsflyer.com^

! Malvertising, Popups & Coin Miners
||popads.net^
||propellerads.com^
||exoclick.com^
||trafficjunky.com^
||coinhive.com^
||coin-hive.com^
||cryptoloot.pro^
||adcash.com^
||popcash.net^
||bidvertiser.com^
||infolinks.com^
||chitika.net^

! Generic Ad Patterns
/ads.js$script
/advertisement.js$script
/ad-banner.
/pagead/
/partner.ads.
`;

let snfeInstance = null;
let isInitialized = false;
let totalRulesCount = 0;

export async function getUblockEngine() {
  if (snfeInstance) return snfeInstance;

  try {
    snfeInstance = await StaticNetFilteringEngine.create();
    await snfeInstance.useLists([
      {
        name: 'ublock-builtin-core',
        raw: BUILTIN_UBLOCK_RULES
      }
    ]);
    isInitialized = true;
    totalRulesCount = BUILTIN_UBLOCK_RULES.split('\n').filter(l => l.trim() && !l.startsWith('!')).length;
    console.log(`[uBlock Origin] Core engine active with ${totalRulesCount} static network filtering rules.`);
  } catch (err) {
    console.error('[uBlock Origin] Failed to initialize ubo-core:', err);
  }

  return snfeInstance;
}

export function isUrlBlockedByUblock(url, originUrl = '') {
  if (!url) return false;

  // Fast direct domain check fallback
  const fastBlacklist = [
    'doubleclick.net', 'google-analytics.com', 'googlesyndication.com',
    'adservice.google.com', 'pagead2.googlesyndication.com', 'criteo.com',
    'criteo.net', 'adnxs.com', 'amazon-adsystem.com', 'outbrain.com',
    'taboola.com', 'rubiconproject.com', 'pubmatic.com', 'casalemedia.com',
    'scorecardresearch.com', 'hotjar.com', 'clarity.ms', 'pixel.facebook.com',
    'ads.twitter.com', 'static.ads-twitter.com', 'adroll.com', 'advertising.com',
    'yandex.ru/metrika', 'quantserve.com', 'moatads.com', 'popads.net',
    'propellerads.com', 'adsystem.com', 'serving-sys.com', 'bidswitch.net',
    'smartadserver.com', 'openx.net', 'appnexus.com', 'chartbeat.com',
    'googleadservices.com', 'exoclick.com', 'popcash.net', 'coinhive.com'
  ];

  const lowerUrl = url.toLowerCase();
  for (const domain of fastBlacklist) {
    if (lowerUrl.includes(domain)) return true;
  }

  // SNFE uBlock matching engine
  if (snfeInstance && isInitialized) {
    try {
      const matchResult = snfeInstance.matchRequest({
        originURL: originUrl || url,
        url: url,
        type: 'main_frame'
      });
      // 1 = Blocked, 2 = Exception (Allow), 0 = No match
      if (matchResult === 1) return true;
    } catch {
      // Fallback to domain check
    }
  }

  return false;
}

export function getUblockCosmeticCss() {
  return `
/* uBlock Origin Cosmetic Element Hiding Styles */
.adsbygoogle,
[id^="google_ads_iframe"],
[id^="div-gpt-ad"],
.ad-container,
.ad-wrapper,
.ad-slot,
.ad_slot,
.ad-box,
.ad-banner,
.banner-ad,
.adunit,
.ad-unit,
.advertisement,
.advertising,
.ad-sidebar,
.ad-header,
.ad-footer,
.ad-placement,
.sponsored-post,
.sponsored-content,
.sponsored-item,
.sponsored-card,
.taboola,
.tbl-feed-container,
.outbrain,
.trc_rbox_div,
.trc_related_container,
.ob-widget,
.native-ad,
.native-ads,
.gemini-ad,
.pop-ad,
.popup-ad,
.floating-ad,
.sticky-ad,
.bottom-ad-bar,
.inline-ad,
.dfp-ad,
.dfp_slot,
iframe[src*="doubleclick.net"],
iframe[src*="googlesyndication.com"],
iframe[src*="adnxs.com"],
iframe[src*="amazon-adsystem.com"],
iframe[src*="criteo.com"],
iframe[src*="rubiconproject.com"],
iframe[src*="pubmatic.com"],
iframe[src*="adroll.com"],
iframe[src*="smartadserver.com"],
iframe[src*="moatads.com"],
iframe[src*="outbrain.com"],
iframe[src*="taboola.com"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  max-height: 0 !important;
  width: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}
`;
}
