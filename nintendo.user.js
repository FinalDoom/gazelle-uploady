// ==UserScript==
// @name         GazelleGames Nintendo Uploady
// @namespace    https://gazellegames.net/
// @version      0.6.1
// @description  Uploady for Nintendo sites
// @author       FinalDoom
// @match        https://gazellegames.net/upload.php*
// @match        https://gazellegames.net/torrents.php?action=editgroup&*
// @match        https://gazellegames.net/torrents.php?id=*
// @match        https://gazellegames.net/upload.php?groupid=*
// @match        https://gazellegames.net/torrents.php?action=edit&*
// @match        https://www.nintendo.com/store/products/*/*
// @match        https://www.nintendo.co.uk/Games/*
// @match        https://store-jp.nintendo.com/list/software/*
// @match        https://postimages.org/web
// @match        https://postimg.cc/gallery/*/*
// @match        https://postimg.cc/*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/master/lib/html2bbcode.js
// @require      https://raw.githubusercontent.com/FinalDoom/gazelle-uploady/master/common.js
// ==/UserScript==

// Fix nintendo.com (US etc) https://www.nintendo.com/store/products/camper-van-simulator-switch/?sid=92e801ea40956c2c90f59c494e7de6e4__ga

(function (window, $, {HTML2BBCode}, patchPtpimgButtons, executePostimages) {
  ('use strict');

  const japaneseTextRE = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g;
  String.prototype.hasJapanese = function () {
    return japaneseTextRE.test(this);
  };

  const languageReplacements = [
    {regex: /日本語/, replacement: 'Japanese'},
    {regex: /英語/, replacement: 'English'},
    {regex: /中国語 (簡体字)/, replacement: 'Chinese'},
    {regex: /中国語 (繁体字)/, replacement: 'Chinese'},
    {regex: /フランス語/, replacement: 'French'},
    {regex: /ドイツ語/, replacement: 'German'},
    {regex: /イタリア語/, replacement: 'Italian'},
    {regex: /スペイン語/, replacement: 'Spanish'},
    {regex: /韓国語/, replacement: 'Korean'},
    {regex: /ポルトガル語/, replacement: 'Portuguese'},
    {regex: /ロシア語/, replacement: 'Russian'},
    {regex: /オランダ語/, replacement: 'Dutch'},
  ];
  const tagReplacements = [
    {regex: / /g, replacement: '.'},
    {regex: /アクション/, replacement: 'action'},
    {regex: /アドベンチャー/, replacement: 'adventure'},
    {regex: /最高スコアにチャレンジ/, replacement: 'arcade'},
    {regex: /つくれる・あそべる/, replacement: 'casual'},
    {regex: /キャラクターボイス/, replacement: 'japanese.voiced'},
    {regex: /なぞ解き/, replacement: 'mystery'},
    {regex: /パズル/, replacement: 'puzzle'},
    {regex: /ロールプレイング/, replacement: 'role.playing.game'},
    {regex: /シューティング/, replacement: 'shooter'},
    {regex: /シミュレーション/, replacement: 'simulation'},
    {regex: /ストラテジー/, replacement: 'strategy'},
    {regex: /テキストアドベンチャー/, replacement: 'visual.novel'},
    {regex: /rpg/, replacement: 'role.playing.game'},
    {
      regex:
        /(baseball|basketball|billiards|bowling|boxing|cricket|football|golf|hockey|skateboarding|snowboarding|skiing|soccer|surfing|tennis|track.and.field|wrestling)/,
      replacement: '$1, sports',
    },
    {regex: japaneseTextRE, replacement: ''},
    {regex: /other/, replacement: ''},
    {regex: /,\./g, replacement: ', '},
    {regex: /,.,/g, replacement: ','},
  ];
  const platformReplacements = [
    {regex: /Nintendo Entertainment System/, replacement: 'NES'},
    {regex: /Nintendo 64DD/, replacement: 'Nintendo 64'},
    {regex: /GameCube/, replacement: 'Nintendo GameCube'},
    {regex: /Super Nintendo Entertainment System/, replacement: 'Super NES'},
    {regex: /Wii Shop/, replacement: 'Wii'},
    {regex: /Nintendo Switch/, replacement: 'Switch'},
  ];
  const PEGI3 = 1;
  const PEGI7 = 3;
  const PEGI12 = 5;
  const PEGI16 = 7;
  const PEGI18 = 9;
  const ratingReplacements = [
    // Descending order because of regex overlap / consistency
    {regex: /ESRB AO/, replacement: PEGI18},
    {regex: /ESRB M/, replacement: PEGI16},
    {regex: /ESRB T/, replacement: PEGI12},
    {regex: /ESRB E10\+/, replacement: PEGI12},
    {regex: /ESRB E/, replacement: PEGI7},
    {regex: /ESRB EC/, replacement: PEGI3},
    // TODO more
    {regex: /Everyone 10\+/, replacement: PEGI12},
    {regex: /CERO Z/, replacement: PEGI18},
    {regex: /CERO [CD]/, replacement: PEGI16},
    {regex: /CERO B/, replacement: PEGI12},
    {regex: /CERO A.*/, replacement: PEGI3},
    {regex: /IARC.* 16.*/, replacement: PEGI16},
    {regex: /IARC.* 12.*/, replacement: PEGI12},
    {regex: /IARC.* 7.*/, replacement: PEGI7},
    {regex: /PEGI 18/, replacement: PEGI18},
    {regex: /PEGI 16/, replacement: PEGI16},
    {regex: /PEGI 12/, replacement: PEGI12},
    {regex: /PEGI 7/, replacement: PEGI7},
    {regex: /PEGI 3/, replacement: PEGI3},
  ];

  const siteKey = 'nintendo';
  const bbConverter = new HTML2BBCode();
  window.bbc = bbConverter;
  function html2bb(jqObj) {
    return (
      bbConverter
        .feed(
          '<h2>About the game</h2>' +
            jqObj
              .html()
              // Title headings often have nonsense
              .replace(/\w+>•([^<]+)•<\/\w+/g, 'h2>$1</h2')
              // Attempt to make lists out of bulleted paragraphs
              .replace(/\w+>\s*[⦁•▶*+–-]/g, '<li>')
              .replace(/<h(\d)\s+[^>]+>/g, '<h$1>')
              .replace(/<\/(div|p)>/g, '</$1><br/>'),
        )
        .toString()
        .replace(/\[\/?h2]/g, '==')
        .replace(/\[\/?h3]/g, '===')
        .replace(/\[\/?h4]/g, '====')
        .replace(/\[li\](.*)\[\/li\]/g, '[*]$1')
        .replace(/\[\/?[uo]l\]/g, '')
        .replace(/^\n- /gm, '[*]')
        // Features to heading
        .replace(/^\s*(?:game\s+)?features?:?\s*$/gim, '==Features==')
        // Requested formatting instead of headers
        .replace(/^==+/gm, '\n[align=center][b][u]')
        .replace(/==+$/gm, '[/u][/b][/align]\n')
        .replace(/(\[\*\].*)\n\n(?=\[\*\])/gm, '$1\n')
        .replace(/^\n+/, '')
    );
  }

  $.fn.extend({
    getYear: function () {
      var year = [];
      this.each(function () {
        year.push(
          $(this)
            .text()
            .trim()
            .replace(/.*((?:19|20)\d\d).*/, '$1'),
        );
      });
      return year.length === 1 ? year[0] : year.join(', ');
    },
  });

  function getGameInfo() {
    const saveLink = $('#save_link');
    saveLink.val('Working...').css({backgroundColor: 'blue'});
    saveLink.off('click.validate');
    const nintendo = GM_getValue('nintendo', {});

    if (window.location.hostname === 'store-jp.nintendo.com') {
      // #region Fetch wiki info JP
      nintendo.platform = $('th:contains("対応ハード")').next().text().trim();
      nintendo.title = $('.productDetail--headline__title').text().trim();
      const publisher = $('th:contains("メーカー")').next().text().trim();
      let languages = $('th:contains("対応言語")').next().text().trim();
      languageReplacements.forEach(({regex, replacement}) => (languages = languages.replace(regex, replacement)));
      if (/English(, )?/.test(languages))
        languages = ('English, ' + languages.replace(/(?:American )?English(, )?/g, '')).replace(/, $/, '');
      const description = html2bb(
        $('<div>').append(
          $('.productDetail--catchphrase__title, .productDetail--catchphrase__longDescription').clone(),
        ),
      );
      nintendo.description = `${description}

[spoiler=Original Japanese description]

${description}
[/spoiler]`;

      nintendo.tags = $('.productDetail--tag__label')
        .map((_, elem) => $(elem).text().trim())
        .toArray();
      nintendo.year = $('th:contains("配信日")').next().getYear();
      nintendo.rating = $('.productDetail--CERO__rating img, .productDetail--IARC__rating img').first().attr('alt');

      nintendo.cover = $('ul.slick-dots li:first-of-type() img').attr('src').split('?')[0];
      nintendo.screenshots = $('.slick-track li.slick-slide:not(.slick-cloned) img')
        .map((_, elem) => $(elem).attr('src').split('?')[0])
        .toArray();

      nintendo.alternateTitles = [];

      nintendo.extraInfo = {
        publisher: publisher,
        languages: Array.from(new Set(languages.split(/,\s*/))).join(', '),
        storeLink: window.location.toLocaleString(),
      };
      // #endregion Fetch wiki info JP
    } else if (window.location.hostname === 'www.nintendo.com') {
      // #region Fetch wiki info US
      nintendo.platform = $('[class^=Herostyles__HeroSection] [class^=PlatformLabelstyles__StyledPlatform] span')
        .text()
        .trim();
      nintendo.title = $('[class^=Breadcrumbsstyles__StyledNav] li:last-of-type').text().trim();
      const publisher = $(
        '[class^=ProductInfostyles__InfoRow]:contains("Publisher") [class^=ProductInfostyles__InfoDescr]',
      )
        .text()
        .trim();
      let languages = $(
        '[class^=ProductInfostyles__InfoRow]:contains("Supported languages") [class^=ProductInfostyles__InfoDescr]',
      )
        .text()
        .trim();
      if (/English(, )?/.test(languages))
        languages = ('English, ' + languages.replace(/(?:American )?English(, )?/g, '')).replace(/, $/, '');
      const description = html2bb($('[class^=ReadMorestyles__ReadMore] [class^=RichTextstyles__Html]'));
      nintendo.description = description;
      console.log('html', $('[class^=ReadMorestyles__ReadMore] [class^=RichTextstyles__Html]').html());
      console.log('description', description);
      console.log('nintendo', nintendo);

      nintendo.tags = $(
        '[class^=ProductInfostyles__InfoRow]:contains("Genre") [class^=ProductInfostyles__InfoDescr] div',
      )
        .map(function () {
          return $(this).text();
        })
        .toArray()
        .filter((lang) => lang !== 'Other');
      nintendo.year = $(
        '[class^=ProductInfostyles__InfoRow]:contains("Release date") [class^=ProductInfostyles__InfoDescr]',
      ).getYear();
      nintendo.rating = $(
        '[class^=ProductInfostyles__InfoRow]:contains("ESRB rating") [class^=ProductInfostyles__InfoDescr]',
      )
        .text()
        .trim();

      const imageBiggerer = /(c_scale)[^\/]+/;
      const images = $('[class*=MediaGallerystyles__ModalCarousel] .slider-slide img');
      nintendo.cover = images.first().attr('src').replace(imageBiggerer, '$1') + '.jpg';
      nintendo.screenshots = images
        .slice(1)
        .map(function () {
          return $(this).attr('src').replace(imageBiggerer, '$1') + '.jpg'; // JPG for ptpimg
        })
        .toArray();

      nintendo.extraInfo = {
        publisher: publisher,
        languages: Array.from(new Set(languages.split(/,\s*/))).join(', '),
        storeLink: window.location.toLocaleString(),
      };
      // #endregion Fetch wiki info US
    } else {
      // #region Fetch wiki info UK, test NA
      nintendo.platform = $('.listwheader-container .info_system .game_info_title:contains("System")')
        .next()
        .text()
        .trim();
      nintendo.title = $('.gamepage-header-info h1').text().trim();
      const publisher = $('#gameDetails .game_info_title:contains("Publisher")').next().text().trim();
      let languages = $('.listwheader-container .info_system .game_info_title:contains("Languages")').next().text();
      if (/English(, )?/.test(languages))
        languages = ('English, ' + languages.replace(/(?:American )?English(, )?/g, '')).replace(/, $/, '');
      const description = html2bb($('.content')); // Oddly simple
      nintendo.description = description;
      console.log('html', $('.content').html());
      console.log('description', description);
      console.log('nintendo', nintendo);

      nintendo.tags = $('#gameDetails .game_info_title:contains("Categories")').next().text().trim().split(', ');
      nintendo.year = $('.game_info_title:contains("Release date")').next().getYear();
      nintendo.rating = $('#gameDetails .game_info_title:contains("Age rating")')
        .next()
        .find('.age-rating__icon')
        .text()
        .trim();

      nintendo.cover = $('.packshot-hires img').attr('src').split('?')[0];
      if (window._gItems) {
        const videoInfo = window._gItems.filter((o) => o.isVideo);
        if (videoInfo && videoInfo[videoInfo.length - 1]) {
          nintendo.trailer = videoInfo[videoInfo.length - 1].video_content_url;
        }
        nintendo.screenshots = window._gItems.filter((o) => !o.isVideo).map((i) => i.image_url.split('?')[0]);
      } else {
        nintendo.screenshots = [];
      }

      nintendo.extraInfo = {
        publisher: publisher,
        languages: Array.from(new Set(languages.split(/,\s*/))).join(', '),
        storeLink: window.location.toLocaleString(),
      };
      // #endregion Fetch wiki info UK
    }

    GM_setValue(siteKey, nintendo);
    saveLink.on('click.complete', () => window.close());
    saveLink.val('Close and return to GGn').css({backgroundColor: 'green'});
  }

  function addSaveToGgnButton() {
    if (typeof console != 'undefined' && typeof console.log != 'undefined') console.log('Adding button to window');
    $('body').prepend(
      $('<input type="button" id="save_link" value="Save link for GGn"/>')
        .css({
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 50000,
          cursor: 'pointer',
          height: 'auto',
          width: 'auto',
          padding: '10px',
          backgroundColor: 'lightblue',
        })
        .on('click.validate', getGameInfo),
    );
  }

  // #region Gazelle stuff
  const isNewGroup = () =>
    window.location.pathname === '/upload.php' &&
    (!new URLSearchParams(window.location.search).has('groupid') ||
      new URLSearchParams(window.location.search).get('action') === 'copy');
  const isEditGroup = () =>
    window.location.pathname === '/torrents.php' &&
    new URLSearchParams(window.location.search).get('action') === 'editgroup';
  const isViewGroup = () =>
    window.location.pathname === '/torrents.php' &&
    !new URLSearchParams(window.location.search).has('action') &&
    new URLSearchParams(window.location.search).has('id');
  const isUploadRelease = () =>
    window.location.pathname === '/upload.php' && new URLSearchParams(window.location.search).has('groupid');
  const isEditRelease = () =>
    window.location.pathname === '/torrents.php' &&
    new URLSearchParams(window.location.search).get('action') === 'edit';
  // TODO make this a generic "get title"
  const titleFromGroup = () =>
    (isNewGroup() && $('#title').val()) ||
    (isViewGroup() && /^[^-]+- (.*) \(.*\) \[[^]+\]$/.exec($('#display_name').text())[1]) ||
    // Edit release page
    (isEditRelease() && Object.keys(getAllInfo()).find((title) => $('#release_title').val().startsWith(title))) ||
    // Edit group page
    (isEditGroup() && $('#content > div > h2 > a').text()) ||
    // Upload release page
    (isUploadRelease() && $('#torrent_properties .colhead a:nth-of-type(2)').text());

  function getExtraInfo(source, title) {
    console.log('getinfo', title);
    const allInfo = getAllInfo();
    const info = (title in allInfo && allInfo[title]) || {};
    const sourcedInfo = (source in info && info[source]) || {};
    console.log('get info', sourcedInfo);
    return sourcedInfo;
  }

  function getAllInfo() {
    return JSON.parse(window.localStorage.uploadyExtraInfo || '{}');
  }

  function setExtraInfo(source, title, info) {
    // TODO this doesn't work well with japanese titles.. at all?
    // If info only has source and id left, no more info, remove it
    if (Object.keys(info).every((key) => key === 'groupId')) {
      const allInfo = getAllInfo();
      const storedInfo = allInfo[title];
      delete storedInfo[source];
      if (!Object.keys(storedInfo).length) {
        // No more info for this title, remove it
        delete allInfo[title];
      }
      window.localStorage.uploadyExtraInfo = JSON.stringify(allInfo);
    } else {
      window.localStorage.uploadyExtraInfo = JSON.stringify({
        ...JSON.parse(window.localStorage.uploadyExtraInfo || '{}'),
        ...{[title]: {[source]: info}},
      });
    }
  }

  function setExtraInfoGroupId(source = 'nintendo') {
    const info = getExtraInfo(source, titleFromGroup());
    if (info && !$.isEmptyObject(info) && !('groupId' in info)) {
      setExtraInfo(source, titleFromGroup(), {
        ...info,
        groupId: new URLSearchParams(window.location.search).get('id'),
      });
    }
  }

  const camelToTitleCase = (text) => {
    const result = text.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  function showExtraGroupInfo(inf) {
    // TODO show grouping by 'nintendo' also pull Platform instead of Nintendo
    console.log('title', titleFromGroup());
    const info = inf || getExtraInfo('nintendo', titleFromGroup());
    if (!Object.keys(info).length) return;
    const content = $('#content').wrap($('<div>').css({position: 'relative'}));
    let div;
    content.before(
      (div = $('<div id="extraGroupInfo">').css({
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
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
    div.append(
      $('<dl>')
        .css({display: 'flex', flexDirection: 'column', gap: '0.5rem'})
        .append(
          ...Object.entries(info)
            .filter(([key, _]) => key !== 'groupId')
            .map(([key, value]) => {
              const term = $('<div>')
                .css({display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center', justifyItems: 'center'})
                .append($(`<dt>${camelToTitleCase(key)}</dt>`).css({padding: '1px 0'}));
              const remove = $('<a>')
                .html('&#10060;')
                .css({display: 'none', color: 'red'})
                .click(() => {
                  delete info[key];
                  setExtraInfo('nintendo', titleFromGroup(), info);
                  $('#extraGroupInfo').remove();
                  showExtraGroupInfo();
                });
              return term
                .click(() => {
                  const wasVisible = remove.is(':visible');
                  remove.toggle();
                  term.css({color: !wasVisible ? 'red' : ''});
                })
                .append(remove)
                .add(
                  $('<dd>')
                    .css({marginLeft: 0})
                    .click(function () {
                      console.log('clicked', $(this).find('input').val());
                      navigator.clipboard.writeText($(this).find('input').val());
                    })
                    .append($('<input disabled>').val(value).css({width: '100%', pointerEvents: 'none'})),
                );
            }),
        ),
      $('<a>')
        .text('+')
        .click(() => {
          const key = window.prompt('Enter extra info key (camelCase)', 'developer');
          if (!key) return;
          const value = window.prompt('Enter extra info value', 'xxx');
          if (!value) return;
          setExtraInfo('nintendo', titleFromGroup(), {...info, [key]: value});
          $('#extraGroupInfo').remove();
          showExtraGroupInfo();
        }), // TODO make this show even when the rest doesn't
    );
  }

  function validateSearchedValues() {
    patchPtpimgButtons(window, siteKey);
    const nintendo = GM_getValue(siteKey, {});
    console.log('nintendo', nintendo);
    if (nintendo.hasOwnProperty('tags'))
      tagReplacements.forEach(
        ({regex, replacement}) =>
          (nintendo.tags = nintendo.tags.flatMap((tag) => tag.replace(regex, replacement).toLowerCase().split(', '))),
      );
    if (nintendo.hasOwnProperty('platform'))
      platformReplacements.forEach(
        ({regex, replacement}) => (nintendo.platform = nintendo.platform.replace(regex, replacement)),
      );
    if (nintendo.hasOwnProperty('rating'))
      ratingReplacements.forEach(
        ({regex, replacement}) => (nintendo.rating = nintendo.rating.replace(regex, replacement)),
      );
    console.log('nintendo', nintendo);

    if (isNewGroup()) {
      if (nintendo.rating) $('#Rating').val(nintendo.rating);
      if (nintendo.alternateTitles)
        $('#aliases').val(
          Array.from(new Set(nintendo.alternateTitles))
            .filter((a) => !!a)
            .join(', '),
        );
      if (nintendo.title) $('#title').val(nintendo.title); // TODO fix selecting multiple languages, ratings, etc breaking things. use .first() or something
      if (nintendo.tags)
        $('#tags').val(
          Array.from(new Set(nintendo.tags))
            .filter((t) => !!t)
            .join(', '),
        );
      if (nintendo.year) $('#year').val(nintendo.year);
      if (nintendo.cover) $('#image').val(nintendo.cover);
      if (nintendo.description) $('#album_desc').val(nintendo.description);
      if (nintendo.platform) $('#platform').val(nintendo.platform);

      if (!$('#tags').val().includes(',')) {
        $('#post').attr('style', 'border: 10px solid red');
      }
    } else {
      if (nintendo.cover) $("input[name='image']").val(nintendo.cover);
    }

    if (nintendo.trailer) $('#trailer').val(nintendo.trailer);
    const addScreenshot = $("a:contains('+')");
    const screenshotFields = $("[name='screens[]']").length;
    nintendo.screenshots.forEach(function (screenshot, index) {
      if (index >= 16) return; //The site doesn't accept more than 16 screenshots
      if (index >= screenshotFields) addScreenshot.click();
      $("[name='screens[]']").eq(index).val(screenshot); //Finally store the screenshot link in the right screen field.
    });

    // Extra info handling
    setExtraInfo('nintendo', nintendo.title, nintendo.extraInfo);
    $('#title')
      .on('focusin.extrainfo', function () {
        console.debug('Saving value ' + $(this).val());
        $(this).data('val', $(this).val());
      })
      .on('change.extrainfo', function () {
        var prev = $(this).data('val');
        var current = $(this).val();
        console.debug('Prev value ' + prev);
        console.debug('New value ' + current);
        setExtraInfo('nintendo', prev, {});
        setExtraInfo('nintendo', current, nintendo.extraInfo);
      });
    showExtraGroupInfo(nintendo.extraInfo);

    GM_deleteValue(siteKey);
    $(window).off('focus.nintendo');
  }

  function addSearchButton() {
    $('#dnu_header').parent().css({display: 'none'});
    $('#steamid').parent().parent().css({display: 'none'});
    $('#reviews_table').parent().parent().css({display: 'none'});
    $('#empty_group').prop('checked', true).change();

    const titleFieldSelector = `input[name='${isNewGroup() ? 'title' : 'name'}']`;
    $(titleFieldSelector).after(
      $('<input id="nintendo_uploady_search" type="button" value="Search Nintendo"/>').click(function () {
        const title = $(titleFieldSelector).val();
        if (!title) return;
        const titleURIComponent = encodeURIComponent(title);

        let nintendoUrl;
        if (title.hasJapanese()) {
          nintendoUrl = `https://store-jp.nintendo.com/search/?q=${titleURIComponent}`;
        } else {
          nintendoUrl = `https://www.nintendo.co.uk/Search/Search-299117.html?q=${titleURIComponent}`;
        }
        window.open(nintendoUrl, '_blank', 'popup=0,rel=noreferrer');

        GM_setValue(siteKey, {});

        $(window).on('focus.nintendo', () => {
          if (GM_getValue(siteKey, {}).hasOwnProperty('platform')) validateSearchedValues();
        });
      }),
    );
  }
  // #endregion

  if (window.location.hostname === 'gazellegames.net') {
    // console.log(titleFromGroup(), isNewGroup(), isEditGroup(), isViewGroup(), isUploadRelease(), isEditRelease());
    if (isNewGroup() || isEditGroup()) {
      addSearchButton();
      if (isEditGroup()) {
        showExtraGroupInfo();
      }
    } else if (isViewGroup()) {
      setExtraInfoGroupId();
      showExtraGroupInfo();
    } else if (isUploadRelease() || isEditRelease()) {
      showExtraGroupInfo();
    }
  } else if (/.*\.nintendo\..*/.test(window.location.hostname)) {
    addSaveToGgnButton();
  } else if (['postimages.org', 'postimg.cc'].includes(window.location.hostname)) {
    executePostimages(window, siteKey);
  }
  window.publishers = function () {
    return Object.entries(
      Object.values(JSON.parse(window.localStorage.uploadyExtraInfo))
        .map(({nintendo}) => nintendo)
        .map(({publisher}) => publisher)
        .reduce((counts, p) => {
          if (!(p in counts)) counts[p] = 0;
          counts[p]++;
          return counts;
        }, {}),
    )
      .sort(([_, a], [__, b]) => b - a)
      .map(([a, _]) => a)
      .filter((x) => x && x !== 'undefined');
  };
  window.publisherGames = function (pub) {
    return Object.entries(JSON.parse(window.localStorage.uploadyExtraInfo))
      .filter(
        ([_, x]) => x.nintendo.publisher && x.nintendo.publisher.toLocaleLowerCase().includes(pub.toLocaleLowerCase()),
      )
      .map(([x, _]) => x);
  };
})(
  unsafeWindow || window,
  jQuery || (unsafeWindow || window).jQuery,
  html2bbcode,
  patchPtpimgButtons,
  executePostimages,
);
