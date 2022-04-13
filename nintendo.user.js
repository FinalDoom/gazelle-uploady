// ==UserScript==
// @name         GazelleGames Nintendo Uploady
// @namespace    https://gazellegames.net/
// @version      0.5.5
// @match        https://gazellegames.net/upload.php*
// @match        https://gazellegames.net/torrents.php?action=editgroup*
// @match        https://www.nintendo.com/store/products/*/*
// @match        https://www.nintendo.co.uk/Games/*
// @match        https://store-jp.nintendo.com/list/software/*
// @description  Uploady for Nintendo sites
// @author       FinalDoom
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/master/lib/html2bbcode.js
// ==/UserScript==

(function (window, $, {HTML2BBCode}) {
  ('use strict');

  const japaneseTextRE = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/g;
  String.prototype.hasJapanese = function () {
    return japaneseTextRE.test(this);
  };

  const tagReplacements = [
    {regex: /テキストアドベンチャー/, replacement: 'visual.novel'},
    {regex: /キャラクターボイス/, replacement: 'japanese.voiced'},
    {regex: /ストラテジー/, replacement: 'strategy'},
    {regex: /ロールプレイング/, replacement: 'role.playing.game'},
    {
      regex:
        /(baseball|basketball|billiards|bowling|boxing|cricket|football|golf|hockey|skateboarding|snowboarding|skiing|soccer|surfing|tennis|track.and.field|wrestling)/,
      replacement: '$1, sports',
    },
    {regex: japaneseTextRE, replacement: ''},
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
  const ratingReplacements = [
    // Descending order because of regex overlap / consistency
    {regex: /ESRB AO/, replacement: '18+'},
    {regex: /ESRB M/, replacement: '16+'},
    {regex: /ESRB T/, replacement: '12+'},
    {regex: /ESRB E10\+/, replacement: '12+'},
    {regex: /ESRB E/, replacement: '7+'},
    {regex: /ESRB EC/, replacement: '3+'},
    {regex: /CERO Z/, replacement: '18+'},
    {regex: /CERO [CD]/, replacement: '16+'},
    {regex: /CERO B/, replacement: '12+'},
    {regex: /CERO A.*/, replacement: '3+'},
    {regex: /PEGI (\d+)/, replacement: '$1+'},
  ];

  const bbConverter = new HTML2BBCode();
  function html2bb(jqObj) {
    return bbConverter
      .feed(
        jqObj
          .html()
          .replace(/<h2\s+[^>]+>/g, '<h2>')
          .replace(/<\/(div|p)>/g, '</$1><br/>'),
      )
      .toString()
      .replace(/\[\/?h2]/g, '==')
      .replace(/\[\/?h3]/g, '===')
      .replace(/\[\/?h4]/g, '====')
      .replace(/\[li\](.*)\[\/li\]/g, '[*]$1')
      .replace(/\[\/?[uo]l\]/g, '')
      .replace(/^\n- /gm, '[*]');
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
      const languages = $('th:contains("対応言語")')
        .next()
        .text()
        .trim()
        .replace(/日本語/, 'Japanese');
      const description = html2bb(
        $('<div>').append(
          $('.productDetail--catchphrase__title, .productDetail--catchphrase__longDescription').clone(),
        ),
      );
      nintendo.description = `[*]Publisher: ${publisher}
[*]Languages: ${languages}
[*]Store page: [url=${window.location.toLocaleString()}]${window.location.toLocaleString()}[/url]

${description}

[spoiler=Original Japanese description]

${description}
[/spoiler]`;

      nintendo.tags = $('.productDetail--tag__label')
        .map((_, elem) => $(elem).text().trim())
        .toArray();
      nintendo.year = $('th:contains("配信日")').next().getYear();
      nintendo.rating = $('.productDetail--CERO__rating img').attr('alt');

      nintendo.cover = $('ul.slick-dots li:first-of-type() img').attr('src').split('?')[0];
      nintendo.screenshots = $('.slick-track li.slick-slide:not(.slick-cloned) img')
        .map((_, elem) => $(elem).attr('src').split('?')[0])
        .toArray();

      nintendo.alternate_titles = [];
      // #endregion Fetch wiki info JP
    } else {
      // #region Fetch wiki info UK, test NA
      nintendo.platform = $('.listwheader-container .info_system .game_info_title:contains("System")')
        .next()
        .text()
        .trim();
      nintendo.title = $('.gamepage-header-info h1').text().trim();
      const publisher = $('#gameDetails .game_info_title:contains("Publisher")').next().text().trim();
      const languages = $('.listwheader-container .info_system .game_info_title:contains("Languages")').next().text();
      const description = html2bb($('.content')); // Oddly simple
      nintendo.description = `[*]Publisher: ${publisher}
[*]Langauges: ${languages}
[*]Store page: [url=${window.location.toLocaleString()}]${window.location.toLocaleString()}[/url]

${description}`;

      nintendo.tags = $('#gameDetails .game_info_title:contains("Categories")').next().text().trim().split(', ');
      nintendo.year = $('.game_info_title:contains("Release date")').next().getYear();
      nintendo.rating = $('#gameDetails .game_info_title:contains("Age rating")')
        .next()
        .find('.age-rating__icon')
        .text()
        .trim();

      const videoInfo = _gItems.filter((o) => o.isVideo);
      if (videoInfo && videoInfo[videoInfo.length - 1]) {
        nintendo.trailer = videoInfo[videoInfo.length - 1].video_content_url;
      }
      nintendo.cover = $('.packshot-hires img').attr('src').split('?')[0];
      nintendo.screenshots = _gItems.filter((o) => !o.isVideo).map((i) => i.image_url.split('?')[0]);
      // #endregion Fetch wiki info UK
    }

    GM_setValue('nintendo', nintendo);
    saveLink.on('click.complete', () => window.close());
    saveLink.val('Close and return to GGn').css({backgroundColor: 'green'});
  }

  function add_validate_button() {
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
  const isNewGroup = () => window.location.pathname === '/upload.php';
  const isEditGroup = () =>
    window.location.pathname === '/torrents.php' && /action=editgroup/.test(window.location.search);

  function validateSearchedValues() {
    const nintendo = GM_getValue('nintendo', {});
    console.log(nintendo);
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

    if (isNewGroup()) {
      $(`#Rating option:contains('${nintendo.rating}')`).prop('selected', true);
      $('#aliases').val(
        Array.from(new Set(nintendo.alternate_titles))
          .filter((a) => !!a)
          .join(', '),
      );
      $('#title').val(nintendo.title);
      $('#tags').val(
        Array.from(new Set(nintendo.tags))
          .filter((t) => !!t)
          .join(', '),
      );
      $('#year').val(nintendo.year);
      $('#image').val(nintendo.cover);
      $('#album_desc').val(nintendo.description);
      $('#platform').val(nintendo.platform);

      if (!$('#tags').val().includes(',')) {
        $('#post').attr('style', 'border: 10px solid red');
      }
    } else {
      $("input[name='image']").val(nintendo.cover);
    }

    if (nintendo.hasOwnProperty('trailer')) $('#trailer').val(nintendo.trailer);
    const add_screen = $("a:contains('+')");
    const screenshotFields = $("[name='screens[]']").length;
    nintendo.screenshots.forEach(function (screenshot, index) {
      if (index >= 16) return; //The site doesn't accept more than 16 screenshots
      if (index >= screenshotFields) add_screen.click();
      $("[name='screens[]']").eq(index).val(screenshot); //Finally store the screenshot link in the right screen field.
    });

    GM_deleteValue('nintendo');
  }

  function add_search_button() {
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

        GM_setValue('nintendo', {});

        $(window).focus(() => {
          if (GM_getValue('nintendo', {}).hasOwnProperty('platform')) validateSearchedValues();
        });
      }),
    );
  }
  // #endregion

  if (window.location.hostname === 'gazellegames.net' && (isNewGroup() || isEditGroup())) {
    add_search_button();
  } else if (/.*\.nintendo\..*/.test(window.location.hostname)) {
    add_validate_button();
  }
})(unsafeWindow || window, jQuery || (unsafeWindow || window).jQuery, html2bbcode);
