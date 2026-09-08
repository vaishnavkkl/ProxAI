export type SubscriptionKind = 'ott' | 'telecom' | 'video' | 'music' | 'cloud';

export type SubscriptionApp = {
  id: string;
  name: string;
  packageName: string;
  kind: SubscriptionKind;
};

export const KIND_LABELS: Record<SubscriptionKind, string> = {
  ott: 'OTT',
  telecom: 'SIM',
  video: 'Video',
  music: 'Music',
  cloud: 'Cloud',
};

export const SUBSCRIPTION_APPS: SubscriptionApp[] = [
  { id: 'netflix', name: 'Netflix', packageName: 'com.netflix.mediaclient', kind: 'ott' },
  { id: 'prime', name: 'Amazon Prime Video', packageName: 'com.amazon.avod.thirdpartyclient', kind: 'ott' },
  { id: 'hotstar', name: 'JioHotstar', packageName: 'in.startv.hotstar', kind: 'ott' },
  { id: 'disney', name: 'Disney+', packageName: 'com.disney.disneyplus', kind: 'ott' },
  { id: 'zee5', name: 'ZEE5', packageName: 'com.graymatrix.did', kind: 'ott' },
  { id: 'sonyliv', name: 'SonyLIV', packageName: 'com.sonyliv', kind: 'ott' },
  { id: 'jiocinema', name: 'JioCinema', packageName: 'com.jio.media.ondemand', kind: 'ott' },
  { id: 'jiotv', name: 'JioTV', packageName: 'com.jio.jioplay.tv', kind: 'ott' },
  { id: 'xstream', name: 'Airtel Xstream', packageName: 'in.airtel.tv', kind: 'ott' },
  { id: 'mxplayer', name: 'MX Player', packageName: 'com.mxtech.videoplayer.ad', kind: 'ott' },
  { id: 'sunnxt', name: 'Sun NXT', packageName: 'com.suntv.sunnxt', kind: 'ott' },
  { id: 'manoramamax', name: 'ManoramaMAX', packageName: 'com.mmtv.manoramamax.android', kind: 'ott' },
  { id: 'sainaplay', name: 'Saina Play', packageName: 'com.saina', kind: 'ott' },
  { id: 'aha', name: 'aha', packageName: 'ahaflix.tv', kind: 'ott' },
  { id: 'hoichoi', name: 'Hoichoi', packageName: 'com.viewlift.hoichoi', kind: 'ott' },
  { id: 'lionsgate', name: 'Lionsgate Play', packageName: 'com.lionsgateplay.videostar', kind: 'ott' },
  { id: 'hungama', name: 'Hungama', packageName: 'com.hungama.movies.tv', kind: 'ott' },
  { id: 'eros', name: 'Eros Now', packageName: 'com.eros.now', kind: 'ott' },
  { id: 'altt', name: 'ALTT', packageName: 'tv.altt', kind: 'ott' },
  { id: 'discovery', name: 'Discovery+', packageName: 'com.discoveryplus.onestream', kind: 'ott' },
  { id: 'appletv', name: 'Apple TV', packageName: 'com.apple.atve.androidtv.appletv', kind: 'ott' },
  { id: 'crunchyroll', name: 'Crunchyroll', packageName: 'com.crunchyroll.crunchyroid', kind: 'ott' },
  { id: 'tataplay', name: 'Tata Play Binge', packageName: 'com.tataplay.binge', kind: 'ott' },
  { id: 'youtube', name: 'YouTube', packageName: 'com.google.android.youtube', kind: 'video' },
  { id: 'googletv', name: 'Google TV', packageName: 'com.google.android.videos', kind: 'video' },
  { id: 'ytmusic', name: 'YouTube Music', packageName: 'com.google.android.apps.youtube.music', kind: 'music' },
  { id: 'spotify', name: 'Spotify', packageName: 'com.spotify.music', kind: 'music' },
  { id: 'jiosaavn', name: 'JioSaavn', packageName: 'com.jio.media.jiobeats', kind: 'music' },
  { id: 'gaana', name: 'Gaana', packageName: 'com.gaana', kind: 'music' },
  { id: 'wynk', name: 'Wynk Music', packageName: 'com.bsbportal.music', kind: 'music' },
  { id: 'audible', name: 'Audible', packageName: 'com.audible.application', kind: 'music' },
  { id: 'jio', name: 'MyJio', packageName: 'com.jio.myjio', kind: 'telecom' },
  { id: 'airtel', name: 'Airtel Thanks', packageName: 'com.myairtelapp', kind: 'telecom' },
  { id: 'vi', name: 'Vi', packageName: 'com.myvi', kind: 'telecom' },
  { id: 'vodafone', name: 'Vi Selfcare', packageName: 'com.vodafone.selfcare', kind: 'telecom' },
  { id: 'bsnl', name: 'BSNL', packageName: 'com.bsnl.portal', kind: 'telecom' },
  { id: 'googleone', name: 'Google One', packageName: 'com.google.android.apps.subscriptions.red', kind: 'cloud' },
];

export function subscriptionAppPackages(): string[] {
  return SUBSCRIPTION_APPS.map((app) => app.packageName);
}

// Android resolves each URL against its specific package; a browser cannot count as the app.
export const SUBSCRIPTION_LINKS: Record<string, string> = {
  netflix: 'https://www.netflix.com/', prime: 'https://www.primevideo.com/',
  hotstar: 'https://www.hotstar.com/in', sonyliv: 'https://www.sonyliv.com/',
  zee5: 'https://www.zee5.com/', sunnxt: 'https://www.sunnxt.com/',
  manoramamax: 'https://www.manoramamax.com/', sainaplay: 'https://www.sainaplay.com/',
  spotify: 'spotify:home', ytmusic: 'https://music.youtube.com/',
  youtube: 'https://www.youtube.com/', jiosaavn: 'https://www.jiosaavn.com/',
};

export function kindLabel(kind: SubscriptionKind): string {
  return KIND_LABELS[kind];
}

export function isUtilitySubId(id: string): boolean {
  return id === 'app-drive' || id === 'app-dropbox' || id === 'app-onedrive' || id === 'app-adobe';
}
