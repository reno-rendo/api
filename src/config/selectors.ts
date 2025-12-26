/**
 * CSS Selectors for Otakudesu.best scraping
 *
 * ⚠️ IMPORTANT: These selectors may change if the website updates its structure.
 * Regular monitoring and updates may be required.
 *
 * Last verified: December 2024
 */

export const SELECTORS = {
    /**
     * Homepage selectors
     */
    home: {
        /** Ongoing anime section */
        ongoing: {
            container: '.venz ul li',
            title: '.jdlflm',
            thumbnail: '.thumbz img',
            episode: '.epz',
            episodeDate: '.newnime',
            link: '.thumb a',
        },

        /** Complete anime section */
        complete: {
            container: '.venz ul li',
            title: '.jdlflm',
            thumbnail: '.thumbz img',
            episode: '.epz',
            link: '.thumb a',
        },
    },

    /**
     * Anime detail page selectors
     */
    anime: {
        /** Main title */
        title: '.jdlrx h1',

        /** Thumbnail/poster image */
        thumbnail: '.fotoanime img',

        /** Synopsis/description */
        synopsis: '.sinopc',

        /** Info table rows */
        infoTable: '.infozingle p',

        /** Specific info patterns */
        info: {
            japaneseTitle: 'span:contains("Japanese")',
            score: 'span:contains("Skor")',
            producer: 'span:contains("Produser")',
            type: 'span:contains("Tipe")',
            status: 'span:contains("Status")',
            totalEpisodes: 'span:contains("Total Episode")',
            duration: 'span:contains("Durasi")',
            releaseDate: 'span:contains("Tanggal Rilis")',
            studio: 'span:contains("Studio")',
            genres: 'span:contains("Genre") a',
        },

        /** Episode list */
        episodes: {
            container: '.episodelist ul li',
            link: 'a',
            title: 'a',
            date: '.zemark',
        },

        /** Related/recommended anime */
        related: {
            container: '._related .relat li',
            link: 'a',
            thumbnail: 'img',
            title: '.name',
        },
    },

    /**
     * Episode page selectors
     */
    episode: {
        /** Episode title */
        title: '.posttl',

        /** Video player iframe */
        player: '#pembed iframe',

        /** Mirror/server list */
        mirrors: {
            container: '.mirrorstream ul li',
            link: 'a',
            serverName: 'a',
        },

        /** Navigation */
        navigation: {
            container: '.flir',
            prev: 'a:contains("Previous")',
            next: 'a:contains("Next")',
        },

        /** Download links */
        download: {
            container: '.download ul li',
            quality: 'strong',
            links: 'a',
        },
    },

    /**
     * Search results selectors
     */
    search: {
        container: '.chivsrc li',
        thumbnail: 'img',
        title: 'h2 a',
        link: 'h2 a',
        genres: '.set',
        status: '.set',
    },

    /**
     * Genre list page selectors
     */
    genres: {
        container: '.genres li',
        link: 'a',
        name: 'a',
    },

    /**
     * Schedule page selectors
     */
    schedule: {
        /** Day section */
        dayContainer: '.kglist321',
        dayHeader: 'h2',

        /** Anime in schedule */
        anime: {
            container: 'ul li',
            link: 'a',
            title: 'a',
        },
    },

    /**
     * Batch download page selectors
     */
    batch: {
        /** Title */
        title: '.entry-title',

        /** Download sections by quality */
        download: {
            container: '.batchlink',
            quality: 'h4',
            links: 'ul li a',
            size: 'i',
        },
    },
} as const;

/**
 * URL patterns for Otakudesu
 */
export const URL_PATTERNS = {
    /** Homepage */
    home: '/',

    /** Ongoing anime list page */
    ongoing: '/ongoing-anime/',

    /** Complete anime list page */
    complete: '/complete-anime/',

    /** Anime detail page */
    anime: (slug: string): string => `/anime/${slug}/`,

    /** Episode page */
    episode: (slug: string): string => `/episode/${slug}/`,

    /** Search results */
    search: (query: string): string => `/?s=${encodeURIComponent(query)}&post_type=anime`,

    /** Genre list */
    genres: '/genre-list/',

    /** Specific genre page */
    genre: (slug: string, page = 1): string => `/genres/${slug}/page/${page}/`,

    /** Schedule */
    schedule: '/jadwal-rilis/',

    /** Batch download */
    batch: (slug: string): string => `/batch/${slug}/`,
} as const;
