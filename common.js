if (!GM_getValue || !GM_setValue || !GM_deleteValue || !jQuery || jQuery !== $ || !html2bbcode) {
  throw 'Uploady must require jQuery and HTML2BBCode';

  // Add these lines to your script metadata

  // @match        https://gazellegames.net/upload.php*
  // @match        https://gazellegames.net/torrents.php?action=editgroup&*
  // @match        https://gazellegames.net/torrents.php?id=*
  // @match        https://gazellegames.net/upload.php?groupid=*
  // @match        https://gazellegames.net/torrents.php?action=edit&*
  // @match        your/sites/to/be/searched/here
  // @grant        GM_getValue
  // @grant        GM_setValue
  // @grant        GM_deleteValue
  // @require      https://code.jquery.com/jquery-3.6.0.min.js
  // @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/master/lib/html2bbcode.js
}

/** Helper that does what it says. Converts camelCase to Title Case */
const camelToTitleCase = (text) => {
  const result = text.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

$.fn.extend({
  /**
   * @returns jQuery object with all child links turned into absolute references
   */
  absoluteLinks: function () {
    this.each(function () {
      $(this)
        .find('a')
        .attr('href', (_, href) => new URL(href, window.location).href);
      return this;
    });
    return this;
  },
});

const bbConverter = new html2bbcode.HTML2BBCode();
/**
 * Helper to convert html/jQuery obj to bbcode. Primarily meant to be used in description
 * generation. As such, there are many replaces to facilitate generation of "pretty"
 * descriptions.
 *
 * @param {string | jQuery} html to be converted to bbcode
 * @returns bbcode representation of the argument
 */
function html2bb(html) {
  const cleanHtml = $('<div>').append(html);
  // Remove all attributes as they cause problems for HTML2BBCode sometimes
  cleanHtml.find('*').replaceWith(function () {
    return $('<' + this.nodeName + '>').append($(this).contents());
  });

  return (
    bbConverter
      .feed(
        cleanHtml
          .html()
          // Title headings often have nonsense symbols surrounding
          .replace(/\w+>([⦁•▶*+–-])([^<]+)\1<\/\w+/g, 'h2>$2</h2')
          // Attempt to make lists out of bulleted paragraphs
          .replace(/\w+>(?<!li)\s*[⦁•▶*+–-]/g, '<li>')
          // Put sections/paragraphs on their own lines
          .replace(/<\/(div|p)>/g, '</$1><br/>'),
      )
      .toString()
      .replace(/\[\/?h2]/g, '==')
      .replace(/\[\/?h3]/g, '===')
      .replace(/\[\/?h4]/g, '====')
      .replace(/\[li\](.*)\[\/li\]/g, '[*]$1')
      .replace(/\[\/?[uo]l\]/g, '')
      // Maybe unnecessary
      .replace(/^\n- /gm, '[*]')
      // Features to heading
      .replace(/^\s*(?:game\s+)?features?:?\s*$/gim, '==Features==')
      // Requested center formatting instead of headers
      .replace(/^==+/gm, '\n[align=center][b][u]')
      .replace(/==+$/gm, '[/u][/b][/align]\n')
      .replace(/(\[\*\].*)\n\n(?=\[\*\])/gm, '$1\n')
      .replace(/^\n+/, '')
  );
}
const VERSION = '1.0.4';
const {
  ExtraInfoCleanup,
  GameInfo,
  Gazelle,
  Language,
  LANGUAGES,
  Platform,
  PLATFORMS,
  Rating,
  RATINGS,
  Tag,
  TAGS,
  UploadyFactory,
} = (function () {
  const CSS_GAZELLE = `<style type="text/css">
.info-label--toggleable {
  cursor: pointer;
  text-decoration: underline;
}
.extra-info-container {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}
.extra-info__platform {
  border-bottom: 1px solid;
  padding-bottom: 0.25rem;
}
.extra-info__info-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.extra-info__info {
  display: flex;
  flex-direction: row;
  gap: 1rem;
  align-items: center;
  justify-items: center;
}
.extra-info__title {
  padding: 1px 0;
}
.extra-info__info--show-remove {
  color: red;
}
.extra-info__info-remove {
  color: red;
  display: none;
}
.extra-info__info--show-remove .extra-info__info-remove {
  display: inline;
}
.extra-info__info-remove span::after {
  content: '\\274c';
}
.extra-info__info-value {
  margin-left: 0;
}
.extra-info_info-value-input {
  width: 100%;
  pointer-events: none;
}
</style>`;
  const CSS_EXTERNAL = `<style type="text/css">
.uploady-button {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 50000;
  cursor: pointer;
  height: auto;
  width: auto;
  padding: 10px;
  background-color: lightblue;
}
.uploady-button--working {
  background-color: blue;
}
.uploady-button--done {
  background-color: green;
}
.uploady-button--error {
  background-color: red;
}
</style>`;

  /**
   * Base matching helper that allows defining a set of regex matchers that will return
   * consistent values (matcher keys) on match, or a list of matches if there are multiple.
   */
  class MatchHandler {
    #matchers = {};

    /**
     * Add a matcher to the internal list to be used in resolve()
     *
     * @param {string} type The matcher "value" that will be returned when regex matches
     * @param {RegExp} regex RegExp object that will be tested to find resolved values
     */
    addMatcher(type, regex) {
      if (!(regex instanceof RegExp)) regex = new RegExp(regex);
      // Prefix new, as defaults are less specific
      const joinedRegex = type in this.#matchers ? regex.source + '|' + this.#matchers[type].source : regex.source;
      this.#matchers[type] = new RegExp(joinedRegex, 'i');
    }
    /**
     * Bulk adds matchers. See addMatcher()
     *
     * @param {Array<Array<string,RegExp>>} matchers Array of matchers to bulk add
     */
    addMatchers(matchers) {
      for (const [language, regex] of matchers) {
        this.addMatcher(language, regex);
      }
    }
    /**
     * Resolve a string against the stored matchers to get a consistent value out.
     *
     * @param {string} language The value to test for matches
     * @returns An array of matched values
     */
    resolve(language) {
      return Object.entries(this.#matchers)
        .filter(([_, regex]) => regex.test(language))
        .map(([lang, _]) => lang);
    }
  }

  //
  // #region Languages handling
  //
  // prettier-ignore
  const BASE_LANGUAGES = [
    // Languages defined on Gazelle
    // console.log($('#language option').slice(2, -1).map(function(){return $(this).val();}).toArray())
    'English', 'German', 'French', 'Czech', 'Chinese', 'Italian', 'Japanese', 'Korean', 'Polish', 'Portuguese', 'Russian', 'Spanish',
    // Additional languages
    'Dutch', 'Portuguese',
  ];
  /**
   * Helper object that defines all languages available on GGN (plus some) for use in making matchers.
   * You can add your own matchers for site specifics like in LANGUAGES.addMatchers below.
   */
  class Language extends MatchHandler {}
  const LANGUAGES = new Language();
  Object.defineProperties(
    Language,
    Object.fromEntries(BASE_LANGUAGES.map((language) => [language.toLocaleUpperCase(), {value: language}])),
  );

  LANGUAGES.addMatchers([
    // Base language matches
    ...BASE_LANGUAGES.map((language) => [language, language]),

    // Japanese language definitions
    [Language.ENGLISH, /英語/],
    [Language.GERMAN, /ドイツ語/],
    [Language.FRENCH, /フランス語/],
    // [Languages.CZECH, ],
    [Language.CHINESE, /中国語 \(簡体字\)/],
    [Language.CHINESE, /中国語 \(繁体字\)/],
    [Language.ITALIAN, /イタリア語/],
    [Language.JAPANESE, /日本語/],
    [Language.KOREAN, /韓国語/],
    // [Languages.POLISH, ],
    [Language.RUSSIAN, /ロシア語/],
    // [Languages.SPANISH, ],
    [Language.DUTCH, /オランダ語/],
    [Language.PORTUGUESE, /ポルトガル語/],

    // Extra-qualified names for languages in English
    [Language.ENGLISH, /British English|American English/],
    [Language.FRENCH, /British French|Canadian French/],
  ]);
  //
  // #endregion Languages handling
  //

  //
  // #region Tag handling
  //
  // prettier-ignore
  const BASE_TAGS = [
    // Tags defined on upload page on gazelle
    // console.log($('#genre_tags option').slice(1).map(function(){return $(this).val()}).toArray())
    'action', 'adult', 'adventure', 'arcade', 'arrangement', 'beat.em.up', 'casual', 'childrens',
    'electronic', 'fantasy', 'fighting', 'first.person.shooter', 'horror', 'instrumental', 'mystery',
    'platform', 'point.and.click', 'puzzle', 'racing', 'real.time.strategy', 'role.playing.game',
    'science.fiction', 'shooter', 'simulation', 'sports', 'strategy', 'survival', 'tactics',
    'turn.based.strategy', 'visual.novel',
    // Other tags
    'board.game', 'japanese.voiced', 'minigames', 'music', 'rhythm', 'trivia',
  ];
  // prettier-ignore
  const SPORTS = [
    'baseball', 'basketball', 'billiards', 'bowling', 'boxing', 'cricket', 'football', 'golf',
    'hockey', 'skateboarding','snowboarding', 'skiing', 'soccer', 'surfing', 'tennis',
    'track.and.field', 'wrestling',
  ];
  /**
   * Helper object that defines all genre tags available on GGN for use in making matchers.
   * You can add your own matchers for site specifics like in TAGS.addMatchers below.
   */
  class Tag extends MatchHandler {}
  Object.defineProperties(
    Tag,
    Object.fromEntries(
      BASE_TAGS.concat(SPORTS).map((tag) => [tag.toLocaleUpperCase().replaceAll('.', '_'), {value: tag}]),
    ),
  );
  const TAGS = new Tag();

  TAGS.addMatchers([
    // Base tag matches
    ...BASE_TAGS.concat(SPORTS).map((tag) => [tag, tag]),

    // Japanese tag matches
    [Tag.ACTION, /アクション/],
    [Tag.ADVENTURE, /アドベンチャー/],
    [Tag.ARCADE, /最高スコアにチャレンジ/],
    [Tag.CASUAL, /つくれる・あそべる/],
    [Tag.JAPANESE_VOICED, /キャラクターボイス/],
    [Tag.MYSTERY, /なぞ解き/],
    [Tag.PUZZLE, /パズル/],
    [Tag.ROLE_PLAYING_GAME, /ロールプレイング/],
    [Tag.SHOOTER, /シューティング/],
    [Tag.SIMULATION, /シミュレーション/],
    [Tag.STRATEGY, /ストラテジー/],
    [Tag.VISUAL_NOVEL, /テキストアドベンチャー/],

    // Other tag matches
    [Tag.BEAT_EM_UP, /brawler/],
    [Tag.PUZZLE, /block-breaking/],
    [Tag.MINIGAMES, /minigame.collection/],
    [Tag.ROLE_PLAYING_GAME, /role-playing|rpg/],
    [Tag.SPORTS, SPORTS.join('|')],
    [Tag.TRACK_AND_FIELD, /track & field/],
    [Tag.TWIN_STICK_SHOOTER, /Dual-Joystick Shooter/],
  ]);
  //
  // #endregion Tag handling
  //

  //
  // #region Platform handling
  //
  // prettier-ignore
  const BASE_PLATFORMS = [
    // Platforms defined on upload page on gazelle
    // console.log($('#platform option').slice(1).map(function(){return $(this).val();}).toArray())
    'Mac', 'iOS', 'Apple Bandai Pippin', 'Apple II', 'Android', 'DOS', 'Windows', 'Xbox', 'Xbox 360',
    'Game Boy', 'Game Boy Advance', 'Game Boy Color', 'NES', 'Nintendo 64', 'Nintendo 3DS', 'New Nintendo 3DS',
    'Nintendo DS', 'Nintendo GameCube', 'Pokemon Mini', 'SNES', 'Switch', 'Virtual Boy', 'Wii', 'Wii U',
    'PlayStation 1', 'PlayStation 2', 'PlayStation 3', 'PlayStation 4', 'PlayStation Portable', 'PlayStation Vita',
    'Dreamcast', 'Game Gear', 'Master System', 'Mega Drive', 'Pico', 'Saturn', 'SG-1000',
    'Atari 2600', 'Atari 5200', 'Atari 7800', 'Atari Jaguar', 'Atari Lynx', 'Atari ST', 'Amstrad CPC',
    'Bandai WonderSwan', 'Bandai WonderSwan Color', 'Apple Bandai Pippin',
    'Commodore 64', 'Commodore 128', 'Commodore Amiga', 'Amiga CD32', 'Commodore Plus-4', 'Commodore VIC-20',
    'NEC PC-98', 'NEC PC-FX', 'NEC SuperGrafx', 'NEC TurboGrafx-16', 'ZX Spectrum', 'MSX', 'MSX 2',
    'Game.com', 'Gizmondo', 'V.Smile', 'CreatiVision', 'Board Game', 'Card Game', 'Miniature Wargames',
    'Pen and Paper RPG', '3DO', 'Casio Loopy', 'Casio PV-1000', 'Colecovision', 'Emerson Arcadia 2001',
    'Entex Adventure Vision', 'Epoch Super Casette Vision', 'Fairchild Channel F', 'Funtech Super Acan',
    'GamePark GP32', 'General Computer Vectrex', 'Interactive DVD', 'Linux', 'Hartung Game Master',
    'Magnavox-Phillips Odyssey', 'Mattel Intellivision', 'Memotech MTX', 'Miles Gordon Sam Coupe',
    'Nokia N-Gage', 'Oculus Quest', 'Ouya', 'Philips Videopac+', 'Philips CD-i', 'Phone/PDA',
    'RCA Studio II', 'Sharp X1', 'Sharp X68000', 'SNK Neo Geo', 'SNK Neo Geo Pocket', 'Taito Type X',
    'Tandy Color Computer', 'Tangerine Oric', 'Thomson MO5', 'Watara Supervision','Retro - Other',
  ];
  /**
   * Helper object that defines all console platforms available on GGN for use in making matchers.
   * You can add your own matchers for site specifics like in PLATFORMS.addMatchers below.
   */
  class Platform extends MatchHandler {}
  Object.defineProperties(
    Platform,
    Object.fromEntries(
      BASE_PLATFORMS.map((platform) => [platform.toLocaleUpperCase().replace(/[ -]+/g, '_'), {value: platform}]),
    ),
  );
  const PLATFORMS = new Platform();

  PLATFORMS.addMatchers([
    // Base platform matches
    ...BASE_PLATFORMS.map((platform) => [platform, platform]),

    // Other platform mathes
    [Platform.NES, /Nintendo Entertainment System/],
    [Platform.NINTENDO_GAMECUBE, /GameCube/],
    [Platform.SUPER_NES, /Super Nintendo Entertainment System/],
    [Platform.IOS, /iPhone|iPad|iPod/],
    [Platform.WINDOWS, /PC/],
    [Platform.NES, /Nintendo Entertainment System/],
    [Platform.PLAYSTATION_1, /PlayStation(?! 1| 2| 3| 4| P| N| V)/],
    [Platform.PLAYSTATION_2, /PS2/],
    [Platform.PLAYSTATION_3, /PS3/],
    [Platform.PLAYSTATION_4, /PS4/],
    [Platform.PLAYSTATION_PORTABLE, /PSP/],
    [Platform.PLAYSTATION_VITA, /Vita/],
    [Platform.MEGA_DRIVE, /Genesis/],
    [Platform.ATARI_JAGUAR, /Jaguar CD/],
    [Platform.BANDAI_WONDERSWAN, /Wonderswan/],
    [Platform.COMMODORE_AMIGA, /Amiga/],
    [Platform.COMMODORE_PLUS_4, /Commodore 16/],
    [Platform.MAGNAVOX_PHILLIPS_ODYSSEY, /Odyssey 2/],
    [Platform.MATTEL_INTELLIVISION, /Intellivision/],
    [Platform.NEC_PC_FX, /NEC PC-6001|NEC PC-8801|NEC PC-9801/],
    [Platform.NEC_TURBOGRAFX_16, /TurboGrafx-16/],
    [Platform.NOKIA_N_GAGE, /N-Gage/],
    [Platform.SNK_NEO_GEO, /Neo Geo(?! Pocket)/],
    [Platform.TANGERINE_ORIC, /Oric/],
  ]);
  //
  // #endregion Platform handling
  //

  //
  // #region Rating handling
  //
  class Rating extends MatchHandler {}
  Object.defineProperties(Rating, {
    PEGI3: {value: 1},
    PEGI7: {value: 3},
    PEGI12: {value: 5},
    PEGI16: {value: 7},
    PEGI18: {value: 9},
    N_A: {value: 13},
  });
  const RATINGS = new Rating();

  RATINGS.addMatchers([
    [Rating.N_A, /N\/A/],
    // Descending order because of regex overlap / consistency
    [Rating.PEGI18, /CERO.* Z/],
    [Rating.PEGI16, /CERO.* [CD]/],
    [Rating.PEGI12, /CERO.* B/],
    [Rating.PEGI3, /CERO.* A.*/],
    [Rating.PEGI18, /ESRB.* AO/],
    [Rating.PEGI16, /ESRB.* M/],
    [Rating.PEGI12, /ESRB.* T/],
    [Rating.PEGI12, /ESRB.* E10\+/],
    [Rating.PEGI7, /ESRB.* E(!10|C)/],
    [Rating.PEGI3, /ESRB.* EC/],
    // TODO more US ones
    [Rating.PEGI12, /Everyone 10\+/],
    [Rating.PEGI3, /Everyone 3\+/],
    [Rating.PEGI7, /Everyone(?! 3| 10)/],
    [Rating.PEGI16, /IARC.* 16.*/],
    [Rating.PEGI12, /IARC.* 12.*/],
    [Rating.PEGI7, /IARC.* 7.*/],
    [Rating.PEGI3, /IARC.* 3.*/],
    [Rating.PEGI18, /OFLC.* MA\s*15\+/],
    [Rating.PEGI16, /OFLC.* M(?:15\+)?/],
    [Rating.PEGI12, /OFLC.* G8\+/],
    [Rating.PEGI7, /OFLC.* PG/], // Needs verification
    [Rating.PEGI3, /OFLC.* G(?:eneral)?/],
    [Rating.PEGI18, /PEGI.* 18/],
    [Rating.PEGI16, /PEGI.* 16/],
    [Rating.PEGI12, /PEGI.* 12/],
    [Rating.PEGI7, /PEGI.* 7/],
    [Rating.PEGI3, /PEGI.* 3/],
  ]);
  //
  // #endregion Rating handling
  //

  /**
   * Utility class that holds and processes info about games + extra info.
   * Should be referenced when building info from other sites. See Uploady.
   */
  class GameInfo {
    #cover;
    #description;
    #giantbomb;
    #platform;
    #rating;
    #title;
    #trailer;
    #website;
    #wikipedia;
    #year;

    #aliases = new Set();
    #screenshots = new Set();
    #tags = new Set();

    #extraInfo = {};

    get aliases() {
      return Array.from(this.#aliases);
    }
    addAlias(...aliases) {
      for (const alias of aliases) {
        if (!!alias) this.#aliases.add(alias);
      }
    }

    get cover() {
      return this.#cover;
    }
    set cover(coverUrl) {
      if (!!coverUrl) this.#cover = coverUrl;
    }

    get description() {
      return '[align=center][b][u]About the game[/u][/b][/align]\n\n' + this.#description;
    }
    set description(html) {
      this.#description = html2bb(html);
    }

    get giantbomb() {
      return this.#giantbomb;
    }
    set giantbomb(giantbombUrl) {
      if (!!giantbombUrl) this.#giantbomb = giantbombUrl;
    }

    languageHandler = LANGUAGES;
    addLanguage(...languages) {
      if (!('language' in this.#extraInfo)) this.#extraInfo.languages = new Set();
      for (const language of languages) {
        if (!!language)
          this.languageHandler.resolve(language).forEach(this.#extraInfo.languages.add, this.#extraInfo.languages);
      }
    }

    platformHandler = PLATFORMS;
    get platform() {
      return this.#platform;
    }
    set platform(platform) {
      if (!!platform) {
        const resolved = this.platformHandler.resolve(platform);
        if (resolved.length) this.#platform = resolved[0];
      }
    }

    ratingHandler = RATINGS;
    get rating() {
      return this.#rating;
    }
    set rating(rating) {
      if (!!rating) {
        const resolved = this.ratingHandler.resolve(rating);
        if (resolved.length) this.#rating = resolved[0];
      }
    }

    get screenshots() {
      return Array.from(this.#screenshots);
    }
    addScreenshot(...screenshots) {
      for (const screenshot of screenshots) {
        if (!!screenshot) this.#screenshots.add(screenshot);
      }
    }

    tagHandler = TAGS;
    get tags() {
      return Array.from(this.#tags);
    }
    addTag(...tags) {
      for (const tag of tags) {
        if (!!tag) this.tagHandler.resolve(tag.replace(/ /g, '.')).forEach(this.#tags.add, this.#tags);
      }
    }

    get title() {
      return this.#title;
    }
    set title(title) {
      if (!title) return;
      this.addAlias(this.#title);
      this.#title = title;
    }

    get trailer() {
      return this.#trailer;
    }
    set trailer(trailerUrl) {
      if (!!trailerUrl) this.#trailer = trailerUrl;
    }

    get website() {
      return this.#website;
    }
    set website(websiteUrl) {
      if (!!websiteUrl) this.#website = websiteUrl;
    }

    get wikipedia() {
      return this.#wikipedia;
    }
    set wikipedia(wikipediaUrl) {
      if (!!wikipediaUrl) this.#wikipedia = wikipediaUrl;
    }

    get year() {
      return this.#year;
    }
    set year(dateStr) {
      if (/((?:19|20)\d\d)/.test(dateStr)) this.#year = dateStr.match(/((?:19|20)\d\d)/)[1];
    }

    get extraInfo() {
      return {...this.#extraInfo};
    }
    set extraInfo(info) {
      this.#extraInfo = {...this.#extraInfo, ...Object.fromEntries(Object.entries(info).filter(([_, value]) => value))};
      if ('languages' in info) {
        this.#extraInfo.languages = new Set(this.#extraInfo.languages);
      }
    }
    hasExtraInfo() {
      return !$.isEmptyObject(this.#extraInfo);
    }

    toJSON() {
      const extraInfo = this.extraInfo;
      if ('languages' in extraInfo) {
        extraInfo.languages = Array.from(this.extraInfo.languages).sort((a, b) =>
          a === Language.ENGLISH ? -1 : b === Language.ENGLISH ? 1 : 0,
        );
      }
      return {
        aliases: this.aliases,
        cover: this.cover,
        description: this.#description, // Don't get the about prefix
        platform: this.platform,
        rating: this.rating,
        screenshots: this.screenshots,
        tags: this.tags,
        title: this.title,
        trailer: this.trailer,
        website: this.website,
        wikipedia: this.wikipedia,
        year: this.year,
        extraInfo: extraInfo,
      };
    }

    static fromJSONString(str) {
      const info = new GameInfo();
      const obj = JSON.parse(str);
      Object.entries(obj).forEach(([key, value]) => {
        // Skip re-executing handlers
        switch (key) {
          case 'aliases':
            info.#aliases = new Set(value);
            break;
          case 'description':
            info.#description = value;
            break;
          case 'rating':
            info.#rating = value;
            break;
          case 'screenshots':
            info.#screenshots = new Set(value);
            break;
          case 'tags':
            info.#tags = new Set(value);
            break;
          default:
            info[key] = value;
        }
      });
      return info;
    }
  }

  class ExtraInfo {
    /** Keys that ExtraInfo contains for organization/matching/display but that should not be considered displayable info */
    static notDisplayedKeys = ['groupId', 'platform', 'title'];
    #element;
    #extraInfo;

    /**
     * @param {object} extraInfo Object defining key value pairs to display
     */
    constructor(extraInfo) {
      this.#extraInfo = Object.fromEntries(
        Object.entries(extraInfo).map(([key, value]) => [
          key, // Handle sets arrays etc and make comma separated string out of them
          typeof value === 'object' && Symbol.iterator in value ? Array.from(value).join(', ') : value,
        ]),
      );
    }

    /**
     * Makes a line item of info
     *
     * @param {[string, string]} param0 Key value pair of info item to display
     * @returns jQuery object with title/value display for adding to overall list
     */
    #infoElement([key, value]) {
      return $('<div class="extra-info__info">')
        .click(function () {
          $(this).toggleClass('extra-info__info--show-remove');
        })
        .append(
          $(`<dt class="extra-info__title">${camelToTitleCase(key)}</dt>`),
          $('<a class="extra-info__info-remove"><span></span></a>').click(() => this.removeInfo(key)),
        )
        .add(
          $('<dd class="extra-info__info-value">')
            .click(() => navigator.clipboard.writeText(value))
            .append($('<input disabled class="extra-info_info-value-input">').val(value)),
        );
    }

    /**
     * Builds and returns a panel to display this extra info
     *
     * @returns extra info panel
     */
    get element() {
      if (!this.#element) {
        this.#element = $('<div class="extra-info">').append(
          `<h3 class="extra-info__platform">${this.#extraInfo.platform}</h3>`,
          $('<dl class="extra-info__info-list">').append(
            ...Object.entries(this.#extraInfo)
              .filter(([key, _]) => !ExtraInfo.notDisplayedKeys.includes(key))
              .map((info) => this.#infoElement(info)),
          ),
          $('<a class="extra-info__info-add">')
            .text('+')
            .click(() => {
              const key = window.prompt('Enter extra info key (camelCase)', 'developer');
              if (!key) return;
              const value = window.prompt('Enter extra info value', 'xxx');
              if (!value) return;
              this.addInfo(key, value);
            }),
        );
      }
      return this.#element;
    }

    /**
     * @param {string} newPlatform Sets a new platform for this object and saves it. See addInfo();
     */
    set platform(newPlatform) {
      this.#element.find('.extra-info__platform').text(newPlatform);
      this.addInfo('platform', newPlatform);
    }

    /**
     * @param {string} newTitle Sets a new title on this object and saves it. See addInfo()
     */
    set title(newTitle) {
      if ('title' in this.#extraInfo) {
        this.addInfo('title', newTitle);
      }
    }

    /**
     * @param {Number} groupId Sets a groupId on this object, removes title, and saves it. See addInfo()
     */
    set groupId(id) {
      if ('title' in this.#extraInfo) {
        delete this.#extraInfo.title;
        this.addInfo('groupId', id);
      } else {
        throw 'groupId already set on this extra info';
      }
    }

    /**
     * Set a new (or replace an) info key/value pair and save the object.
     *
     * @param {string} key camelCase info name
     * @param {string} value info value to display
     */
    addInfo(key, value) {
      this.removeFromStorage();
      this.#extraInfo[key] = value;
      if (!ExtraInfo.notDisplayedKeys.includes(key))
        this.#element.find('.extra-info__info-list').append(this.#infoElement([key, value]));
      this.addToStorage();
    }
    /**
     * Remove a key/value pair and save the object.
     *
     * @param {string} key info key to remove from this object
     */
    removeInfo(key) {
      this.removeFromStorage();
      delete this.#extraInfo[key];
      if (Object.keys(this.#extraInfo).every((key) => ExtraInfo.notDisplayedKeys.includes(key))) {
        this.#element.remove();
        ExtraInfoPanel.infoRemoved();
      } else if (this.#element) {
        const dt = this.#element.find(`.extra-info__title:contains("${camelToTitleCase(key)}")`).parent();
        dt.add(dt.next('dd')).remove();
        this.addToStorage();
      }
    }

    /**
     * Handles removing this object from localStorage, either to delete, or to re-save
     */
    removeFromStorage() {
      const all = ExtraInfo.allInfo;
      const index = all.findIndex(
        ({title, groupId}) => (title && this.#extraInfo.title === title) || this.#extraInfo.groupId === groupId,
      );
      if (~index) {
        all.splice(index, 1);
        ExtraInfo.allInfo = all;
      }
    }
    /**
     * Handles saving this object to localStorage
     */
    addToStorage() {
      const all = ExtraInfo.allInfo;
      all.push(this.#extraInfo);
      ExtraInfo.allInfo = all;
    }

    /**
     * Gets an array of all info objectgs as plain JS objects. Does not cast them to this type.
     */
    static get allInfo() {
      return JSON.parse(window.localStorage.uploadyExtraInfo || '[]');
    }
    /**
     * Saves the array of all info to localStorage
     */
    static set allInfo(all) {
      window.localStorage.uploadyExtraInfo = JSON.stringify(all);
    }

    /**
     * Helper to display a selection of matching info, by their groupId
     *
     * @param {Array<string>} ids array of groupId strings to match for display
     */
    static showExtraInfoForIds(ids) {
      if (ids) {
        ExtraInfo.allInfo
          .filter(({groupId}) => ids.includes(groupId))
          .forEach((info) => ExtraInfoPanel.showExtraInfo(new ExtraInfo(info)));
      }
    }
  }

  /**
   * Encompasses UI logic for showing groups of ExtraInfo on game/upload pages
   */
  class ExtraInfoPanel {
    static #instance;
    #containerElement;

    static get instance() {
      if (!ExtraInfoPanel.#instance) {
        const panel = new ExtraInfoPanel();
        panel.#show();
        ExtraInfoPanel.#instance = panel;
      }
      return ExtraInfoPanel.#instance;
    }

    /**
     * Display new info on this panel
     *
     * @param {ExtraInfo} info Info to display in this panel
     */
    static showExtraInfo(info) {
      ExtraInfoPanel.instance.#containerElement.show().append(info.element);
    }

    /**
     * Call when an ExtraInfo is removed to see if this panel should be hidden (no more info)
     */
    static infoRemoved() {
      if (!ExtraInfoPanel.instance.#containerElement.find('.extra-info').length)
        ExtraInfoPanel.instance.#containerElement.hide();
    }

    /**
     * UI logic for displaying this panel. Much of the CSS is copied from existing elements, but not all.
     */
    #show() {
      const content = $('#content').wrap($('<div>').css({position: 'relative'}));
      content.before(
        (this.#containerElement = $('<div class="extra-info-container">').css({
          // Copy from #Content as we want to mimic it
          margin: content.css('margin'),
          marginLeft: '10px',
          marginRight: `calc(50% + (${content.css('width')} / 2) + ${content.css('padding-left')} + ${content.css(
            'border-left-width',
          )} + 10px)`,
          top: content.css('top'),
          padding: content.css('padding'),
          borderRadius: content.css('border-radius'),
          boxShadow: content.css('box-shadow'),
          background: content.css('background'),
        })),
      );
    }
  }

  /**
   * Main utility class for building an uploady item. Use init() to build Uploady buttons.
   */
  class Uploady {
    #info;
    #extraInfo;
    #key;

    /**
     * Initialize a new uploady button that, when clicked, opens a search page to be parsed.
     * Parsing logic is passed in via getGameInfo, and the resulting info will be used to populate the upload page.
     *
     * Should not be used directly. Instantiate via UploadyFactory.
     *
     * @param {string} searchButtonName The name displayed for the uploady button
     * @param {Function<string, string>} urlBuilder Takes a game name and returns a search URL
     * @param {Function<GameInfo>} getGameInfo Builds a GameInfo object from a game page (main logic)
     */
    constructor(searchButtonName, urlBuilder, getGameInfo) {
      this.#key = crypto.randomUUID();

      if (window.location.hostname === 'gazellegames.net') {
        const uploady = this;
        const titleFieldSelector = 'input[name="title"], input[name="name"]';
        $(titleFieldSelector).after(
          $('<input type="button" />')
            .val(searchButtonName)
            .click(() => {
              const title = $(titleFieldSelector).val();
              if (!title) return;
              const titleURIComponent = encodeURIComponent(title);
              const searchUrl = urlBuilder(titleURIComponent);

              GM_setValue('uploady-key', uploady.#key);
              window.open(searchUrl, '_blank', 'popup=0,rel=noreferrer');
              $(window).on(`focus.uploady${uploady.#key}`, () => {
                if (GM_getValue(uploady.#key)) {
                  $(window).off(`focus.uploady${uploady.#key}`);
                  uploady.#info = GameInfo.fromJSONString(GM_getValue(uploady.#key));
                  uploady.#updateInfo();
                  uploady.#showExtraInfo();
                  GM_deleteValue(uploady.#key);
                }
              });
            }),
        );
      } else if (new URL(urlBuilder('test')).hostname === window.location.hostname) {
        const uploadyKey = GM_getValue('uploady-key', window.sessionStorage.uploadyKey);
        if (!uploadyKey) {
          console.log('No uploady key found');
          return;
        } else {
          window.sessionStorage.uploadyKey = uploadyKey;
        }
        $('body').prepend(
          $('<input type="button" class="uploady-button" value="Save link for GGn"/>').on(
            'click.getinfo',
            async function () {
              $(this).off('click.getinfo').val('Working...').addClass('uploady-button--working');
              try {
                const info = await new Promise((resolve) => getGameInfo(resolve));
                GM_setValue(window.sessionStorage.uploadyKey, JSON.stringify(info));
                $(this)
                  .on('click.complete', () => window.close())
                  .val('Close and return to GGn')
                  .addClass('uploady-button--done');
              } catch (error) {
                console.log('Uploady error:', error);
                $(this).val(error).addClass('uploady-button--error');
              }
            },
          ),
        );
      }
    }

    /**
     * Helper function to fill fields on gazelle and assign error class if value is required and missing
     *
     * @param {string} selector querySelector for the input field in question
     * @param {string} value value to assign to the field
     * @param {bool} allowEmpty true to skip the error check and not mark field error when no value
     */
    static fillField(selector, value, required = true) {
      if (value) $(selector).val(value).focus().blur();
      else if (required) $(selector).addClass('error');
    }

    /**
     * GameInfo -> upload form fields mapping logic
     */
    #updateInfo() {
      console.log('Setting info from:', this.#info);

      // Ordered close to on target page rather than alpha
      Uploady.fillField('#platform', this.#info.platform);
      Uploady.fillField('#title', this.#info.title);
      Uploady.fillField('#year', this.#info.year);
      Uploady.fillField('#Rating', this.#info.rating);
      Uploady.fillField('#gameswebsiteuri', this.#info.website, false);
      Uploady.fillField('#giantbomburi', this.#info.giantbomb, false);
      Uploady.fillField('#wikipediauri', this.#info.wikipedia, false);
      Uploady.fillField('#image', this.#info.cover);
      Uploady.fillField('#trailer', this.#info.trailer, false);
      Uploady.fillField('#album_desc', this.#info.description);

      if ($('#tags').length) {
        const existingTags = $('#tags')
          .val()
          .split(', ')
          .filter((t) => !!t);
        if (existingTags.length) this.#info.addTag(...existingTags);
        Uploady.fillField('#tags', this.#info.tags.join(', '));
        if (!this.#info.tags || this.#info.tags.length < 2) $('#tags').addClass('error');

        const existingAliases = $('#aliases')
          .val()
          .split(',')
          .filter((a) => !!a);
        if (existingAliases.length) this.#info.addAlias(...existingAliases);
        if (this.#info.aliases) $('#aliases').val(this.#info.aliases.join(', ')).blur();
      } else {
        Uploady.fillField('input[name="image"]', this.#info.cover);
      }

      const addScreenshot = $('a:contains("+")');
      const screenshotFields = $('[name="screens[]"]').length;
      this.#info.screenshots.forEach(function (screenshot, index) {
        if (index >= 16) return; //The site doesn't accept more than 16 screenshots
        if (index >= screenshotFields) addScreenshot.click();
        $('[name="screens[]"]').eq(index).val(screenshot); //Finally store the screenshot link in the right screen field.
      });
      if (this.#info.screenshots.length < 4) {
        for (let i = this.#info.screenshots.length - 1; i < 4 - this.#info.screenshots.length; ++i) {
          $('[name="screens[]"]').eq(i).addClass('error');
        }
      }
    }

    /**
     * Handles showing newly fetched ExtraInfo panel and writing it to storage.
     */
    #showExtraInfo() {
      if (this.#info.hasExtraInfo()) {
        if (this.#extraInfo) {
          this.#extraInfo.removeFromStorage();
          this.#extraInfo.element.remove();
        }
        this.#extraInfo = new ExtraInfo({
          title: this.#info.title,
          platform: this.#info.platform,
          ...this.#info.extraInfo,
        });
        this.#extraInfo.addToStorage();
        ExtraInfoPanel.showExtraInfo(this.#extraInfo);

        const extraInfo = this.#extraInfo;
        $('#title').on('change.extrainfo', function () {
          extraInfo.title = $(this).val();
        });
        $('#platform').on('change.extrainfo', function () {
          extraInfo.platform = $(this).val();
        });
      }
    }
  }

  /**
   * Factory for initializing Uploady buttons that also handles extra info display/resolution
   */
  class UploadyFactory {
    constructor() {
      this.#initOnce();
    }

    /**
     * Initialize a new uploady button that, when clicked, opens a search page to be parsed.
     * Parsing logic is passed in via getGameInfo, and the resulting info will be used to populate the upload page.
     *
     * @param {string} searchButtonName The name displayed for the uploady button
     * @param {Function<string, string>} urlBuilder Takes a game name and returns a search URL
     * @param {Function<GameInfo>} getGameInfo Builds a GameInfo object from a game page (main logic)
     * @returns new Uploady button object
     */
    build(searchButtonName, urlBuilder, getGameInfo) {
      return new Uploady(searchButtonName, urlBuilder, getGameInfo);
    }

    /**
     * Hides the details of a game info section and makes the header toggle showing the data
     *
     * @param {jQuery} trElement row element for the game info section to hide/set toggleable
     */
    #makeInfoToggleable(trElement) {
      const label = trElement.find('td').eq(0);
      const info = trElement.find('td').eq(1);
      label.addClass('info-label--toggleable').click(() => info.toggle());
      info.hide();
    }

    /**
     * One-time initialization for modifying search form, CSS, etc. with state in DOM
     */
    #initOnce() {
      if (!Array.from(document.body.classList).includes('has-uploady')) {
        document.body.classList.add('has-uploady');
        if (window.location.hostname === 'gazellegames.net') {
          $('head').append(CSS_GAZELLE);

          // Just change for new uploads
          if (Gazelle.isNewGroup()) {
            $('#empty_group').prop('checked', true).change();

            this.#makeInfoToggleable($('#reviews_table').parent().parent());
            this.#makeInfoToggleable($('#steamid').parent().parent());
          }
          if (Gazelle.isNewGroup() || Gazelle.isUploadRelease()) {
            $('#dnu_header').parent().hide();
          }

          ExtraInfo.showExtraInfoForIds(Gazelle.groupIds());
          if (Gazelle.isViewGroup()) {
            // Also show info for titles matching current page and set their groupId
            const groupTitle = Gazelle.titleFromGroup();
            ExtraInfo.allInfo
              .filter(({title}) => title && title === groupTitle)
              .forEach((info) => {
                const eInfo = new ExtraInfo(info);
                eInfo.groupId = new URLSearchParams(window.location.search).get('id');
                ExtraInfoPanel.showExtraInfo(eInfo);
              });
          }
        } else {
          $('head').append(CSS_EXTERNAL);
        }
      }
    }
  }
  //
  // #endregion Uploady
  //

  /**
   * Helpers for getting info about gazelle pages
   */
  class Gazelle {
    /**
     * @returns true if the current page is a new group page (brand new or new platform)
     */
    static isNewGroup() {
      return (
        window.location.pathname === '/upload.php' &&
        (!new URLSearchParams(window.location.search).has('groupid') ||
          new URLSearchParams(window.location.search).get('action') === 'copy')
      );
    }
    /**
     * @returns true if the current page is a group page
     */
    static isViewGroup() {
      return (
        window.location.pathname === '/torrents.php' &&
        !new URLSearchParams(window.location.search).has('action') &&
        new URLSearchParams(window.location.search).has('id')
      );
    }

    /**
     * @returns true if the current page is an edit group (description) page
     */
    static isEditGroup() {
      return (
        window.location.pathname === '/torrents.php' &&
        new URLSearchParams(window.location.search).get('action') === 'editgroup'
      );
    }
    /**
     * @returns true if the current page is an edit release page
     */
    static isEditRelease() {
      return (
        window.location.pathname === '/torrents.php' &&
        new URLSearchParams(window.location.search).get('action') === 'edit'
      );
    }
    /**
     * @returns true if the current page is a release upload page
     */
    static isUploadRelease() {
      return window.location.pathname === '/upload.php' && new URLSearchParams(window.location.search).has('groupid');
    }

    /**
     * @returns a string representing the title of the currently displayed group (Edit etc) page
     */
    static titleFromGroup() {
      return (
        (Gazelle.isNewGroup() && $('#title').val()) ||
        (Gazelle.isViewGroup() && /^[^-]+- (.*) \(.*\) \[[^]+\]$/.exec($('#display_name').text())[1]) ||
        // Edit release page
        (Gazelle.isEditRelease() &&
          Object.keys(ExtraInfo.allInfo).find((title) => $('#release_title').val().startsWith(title))) ||
        // Edit group page
        (Gazelle.isEditGroup() && $('#content > div > h2 > a').text()) ||
        // Upload release page
        (Gazelle.isUploadRelease() && $('#torrent_properties .colhead a:nth-of-type(2)').text())
      );
    }
    /**
     * @returns an Array containing the current page's relevent group ids
     */
    static groupIds() {
      return (
        (Gazelle.isViewGroup() && [
          new URLSearchParams(window.location.search).get('id'),
          ...$('#grouplinks a')
            .map(function () {
              return new URLSearchParams($(this).attr('href').split('?')[1]).get('id');
            })
            .toArray(),
        ]) ||
        (Gazelle.isEditGroup() && [new URLSearchParams(window.location.search).get('groupid')]) ||
        ((Gazelle.isEditRelease() || Gazelle.isUploadRelease()) && [$('input[name="groupid"]').val()])
      );
    }
  }

  /**
   * Helpers for parsing and cleaning up ExtraInfo. Should be generally unnecessary except for development.
   */
  class ExtraInfoCleanup {
    /** @returns List of publishers ordered by count */
    static publishers() {
      return Object.entries(
        ExtraInfo.allInfo().reduce((counts, {publisher}) => {
          if (!(publisher in counts)) counts[publisher] = 0;
          counts[publisher]++;
          return counts;
        }, {}),
      )
        .sort(([_, a], [__, b]) => b - a)
        .map(([a, _]) => a)
        .filter((x) => x && x !== 'undefined');
    }

    /**
     * @param {string} publisher publisher to query for
     * @returns List of links to games or title searches associated with passed publisher
     */
    static publisherGames(publisher) {
      return ExtraInfo.allInfo()
        .filter(
          ([{extraInfo}]) =>
            extraInfo.publisher && extraInfo.publisher.toLocaleLowerCase().includes(publisher.toLocaleLowerCase()),
        )
        .map(
          ({title, groupId}) =>
            (groupId && `https://gazellegames.net/torrents.php?id=${groupId}`) ||
            `https://gazellegames.net/torrents.php?order_by=relevance&searchstr=${title}`,
        );
    }

    /**
     * @returns all the stored ExtraInfo that has a title set (therefore not groupId)
     */
    static extraInfoWithoutId() {
      return ExtraInfo.allInfo().filter(({title}) => title);
    }
  }

  return {
    ExtraInfoCleanup: ExtraInfoCleanup,
    GameInfo: GameInfo,
    Gazelle: Gazelle,
    Language: Language,
    LANGUAGES: LANGUAGES,
    Platform: Platform,
    PLATFORMS: PLATFORMS,
    Rating: Rating,
    RATINGS: RATINGS,
    Tag: Tag,
    TAGS: TAGS,
    UploadyFactory: UploadyFactory,
  };
})();
