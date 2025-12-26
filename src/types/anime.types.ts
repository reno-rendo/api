/**
 * Anime type definitions
 */

export type AnimeType = 'TV' | 'Movie' | 'OVA' | 'ONA' | 'Special' | 'Music';
export type AnimeStatus = 'Ongoing' | 'Completed' | 'Upcoming';

/**
 * Basic anime info (used in lists)
 */
export interface AnimeListItem {
    slug: string;
    title: string;
    thumbnail: string;
    type?: AnimeType;
    status?: AnimeStatus;
    rating?: number;
    episode?: string;
    genres?: string[];
}

/**
 * Spotlight/featured anime
 */
export interface SpotlightItem {
    slug: string;
    title: string;
    thumbnail: string;
    episode?: string;
    rating?: number;
    type?: AnimeType;
}

/**
 * Episode list item
 */
export interface EpisodeListItem {
    episodeSlug: string;
    episode: number;
    title?: string;
    releaseDate?: string;
    thumbnail?: string;
}

/**
 * Latest episode item
 */
export interface LatestEpisodeItem {
    slug: string;
    animeSlug: string;
    title: string;
    episode: number;
    thumbnail: string;
    releaseDate?: string;
    dayOfWeek?: string;
}

/**
 * Full anime detail
 */
export interface AnimeDetail {
    slug: string;
    title: string;
    alternativeTitles: {
        japanese?: string;
        english?: string;
        synonyms?: string[];
    };
    thumbnail: string;
    synopsis: string;
    score?: number;
    status: AnimeStatus;
    type: AnimeType;
    totalEpisodes?: number | null;
    duration?: string;
    releaseDate?: string;
    studio?: string;
    producers?: string[];
    genres: string[];
    episodeList: EpisodeListItem[];
    recommendations?: AnimeListItem[];
}

/**
 * Anime search result
 */
export interface AnimeSearchResult {
    slug: string;
    title: string;
    thumbnail: string;
    type?: string;
    status?: string;
    rating?: number;
    genres?: string[];
}
