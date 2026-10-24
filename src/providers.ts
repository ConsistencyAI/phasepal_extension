interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly hosts: readonly string[];
  readonly metadataSelectors?: { readonly title: string; readonly artist: string };
}

/** Exact music-player hosts; also used to generate Chrome's site permissions. */
export const MUSIC_PROVIDERS = [
  { id: "spotify_web", name: "Spotify Web", hosts: ["open.spotify.com"], metadataSelectors: {
    title: "[data-testid='context-item-link']", artist: "[data-testid='context-item-info-artist']"
  } },
  { id: "youtube_music", name: "YouTube Music", hosts: ["music.youtube.com"], metadataSelectors: {
    title: "ytmusic-player-bar .title", artist: "ytmusic-player-bar .byline"
  } },
  { id: "soundcloud", name: "SoundCloud", hosts: ["soundcloud.com", "www.soundcloud.com"], metadataSelectors: {
    title: ".playbackSoundBadge__title", artist: ".playbackSoundBadge__lightLink"
  } },
  { id: "apple_music", name: "Apple Music", hosts: ["music.apple.com"] },
  { id: "amazon_music", name: "Amazon Music", hosts: [
    "music.amazon.com", "music.amazon.co.uk", "music.amazon.de", "music.amazon.fr",
    "music.amazon.it", "music.amazon.es", "music.amazon.co.jp", "music.amazon.in",
    "music.amazon.com.au", "music.amazon.com.br", "music.amazon.ca", "music.amazon.com.mx"
  ] },
  { id: "deezer", name: "Deezer", hosts: ["www.deezer.com", "deezer.com"] },
  { id: "tidal", name: "TIDAL", hosts: ["listen.tidal.com"] },
  { id: "qobuz", name: "Qobuz", hosts: ["play.qobuz.com"] },
  { id: "pandora", name: "Pandora", hosts: ["www.pandora.com", "pandora.com"] },
  { id: "yandex_music", name: "Yandex Music", hosts: ["music.yandex.com", "music.yandex.ru"] },
  { id: "qq_music", name: "QQ Music", hosts: ["y.qq.com"] },
  { id: "kugou", name: "KuGou", hosts: ["www.kugou.com"] },
  { id: "jiosaavn", name: "JioSaavn", hosts: ["www.jiosaavn.com"] },
  { id: "line_music", name: "LINE MUSIC", hosts: ["music.line.me"] },
  { id: "bugs", name: "Bugs", hosts: ["music.bugs.co.kr"] },
  { id: "joox", name: "JOOX", hosts: ["www.joox.com", "joox.com"] },
  { id: "anghami", name: "Anghami", hosts: ["play.anghami.com"] },
  { id: "audiomack", name: "Audiomack", hosts: ["audiomack.com", "www.audiomack.com"] }
] as const satisfies readonly ProviderDefinition[];

export type MusicProvider = typeof MUSIC_PROVIDERS[number]["id"] | "custom_site";

/** Match HTTPS player hosts without accepting unrelated subdomains or URL lookalikes. */
export function providerForUrl(url: string | undefined): MusicProvider | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return undefined;
    return MUSIC_PROVIDERS.find(provider =>
      (provider.hosts as readonly string[]).includes(parsed.hostname.toLowerCase()))?.id;
  } catch {
    return undefined;
  }
}

export function providerName(provider: MusicProvider | undefined): string {
  if (provider === "custom_site") return "Custom website";
  return MUSIC_PROVIDERS.find(item => item.id === provider)?.name ?? "Phase Pal browser bridge";
}

export function metadataSelectorsForProvider(provider: MusicProvider): ProviderDefinition["metadataSelectors"] {
  const definition: ProviderDefinition | undefined = MUSIC_PROVIDERS.find(item => item.id === provider);
  return definition?.metadataSelectors;
}

export function musicSitePatterns(): string[] {
  return MUSIC_PROVIDERS.flatMap(provider => provider.hosts.map(host => `https://${host}/*`));
}
