// ==UserScript==
// @name         GazelleGames Giantbomb Uploady
// @namespace    https://gazellegames.net/
// @version      0.1.0
// @match        https://gazellegames.net/upload.php*
// @match        https://gazellegames.net/torrents.php?action=editgroup*
// @match        https://www.giantbomb.com/*
// @match        http://www.giantbomb.com/*
// @match        https://postimages.org/web
// @match        https://postimg.cc/gallery/*/*
// @match        https://postimg.cc/*/*
// @description  Uploady for giantbomb
// @author       FinalDoom
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/master/lib/html2bbcode.js
// ==/UserScript==

(function (window, $, {HTML2BBCode}) {
  ('use strict');

  //
  // #region Modifiable replacements
  //
  const tagReplacements = [
    {regex: /[ ]/g, replacement: '.'},
    {regex: /action-adventure/, replacement: 'action, adventure'},
    {regex: /snowboarding\/skiing/, replacement: 'snowboarding, skiing'},
    {regex: /track & field/, replacement: 'track.and.field'},
    {
      regex:
        /(baseball|basketball|billiards|bowling|boxing|cricket|football|golf|hockey|skateboarding|snowboarding|skiing|soccer|surfing|tennis|track.and.field|wrestling)/,
      replacement: '$1, sports',
    },
    {regex: /block-breaking/, replacement: 'puzzle'},
    {regex: /brawler/, replacement: 'beat.em.up'},
    {regex: /driving\//, replacement: ''},
    {regex: /Dual-Joystick Shooter/, replacement: 'twin.stick.shooter, shooter'},
    {regex: /role-playing/, replacement: 'role.playing.game'},
    {regex: /-/g, replacement: '.'},
    {regex: /minigame.collection/, replacement: 'minigames'},
    {regex: /moba/, replacement: ''},
    {regex: /music\/rhythm/, replacement: 'music, rhythm'},
    {regex: /'em/, replacement: 'em'},
    {regex: /trivia\/board/, replacement: 'trivia, board'},
    {regex: /,\./g, replacement: ', '},
    {regex: /,.,/g, replacement: ','},
  ];
  const platformReplacements = [
    {regex: /iPhone|iPad|iPod/, replacement: 'iOS'},
    {regex: /PC|Windows Phone/, replacement: 'Windows'},
    {regex: /Xbox 360 Games Store/, replacement: 'Xbox 360'},
    {regex: /Nintendo Entertainment System/, replacement: 'NES'},
    {regex: /Nintendo 64DD/, replacement: 'Nintendo 64'},
    {regex: /GameCube/, replacement: 'Nintendo GameCube'},
    {regex: /Super Nintendo Entertainment System/, replacement: 'Super NES'},
    {regex: /Wii Shop/, replacement: 'Wii'},
    {regex: /PlayStation/, replacement: 'PlayStation 1'},
    {regex: /PlayStation Network (PS3)/, replacement: 'PlayStation 3'},
    {regex: /PlayStation Network (PSP)/, replacement: 'PlayStation Portable'},
    {regex: /PlayStation Network (Vita)/, replacement: 'PlayStation Vita'},
    {regex: /Sega Master System/, replacement: 'Master System'},
    {regex: /Genesis/, replacement: 'Mega Drive'},
    {regex: /Jaguar CD/, replacement: 'Atari Jaguar'},
    {regex: /Wonderswan/, replacement: 'Bandai WonderSwan'},
    {regex: /ColecoVision/, replacement: 'Colecovision'},
    {regex: /Amiga/, replacement: 'Commodore Amiga'},
    {regex: /Commodore 16/, replacement: 'Commodore Plus-4'},
    {regex: /Odyssey 2/, replacement: 'Magnavox-Phillips Odyssey'},
    {regex: /Intellivision/, replacement: 'Mattel Intellivision'},
    {regex: /NEC PC-6001|NEC PC-8801|NEC PC-9801/, replacement: 'NEC PC-FX'},
    {regex: /TurboGrafx-16/, replacement: 'NEC TurboGrafx-16'},
    {regex: /N-Gage/, replacement: 'Nokia N-Gage'},
    {regex: /Neo Geo/, replacement: 'SNK Neo Geo'},
    {regex: /Oric/, replacement: 'Tangerine Oric'},
  ];
  const ratingReplacements = [
    // Descending order because of regex overlap / consistency
    {regex: /OFLC: MA\s*15\+/, replacement: '18+'},
    {regex: /OFLC: M(?:15\+)?/, replacement: '16+'},
    {regex: /OFLC: G8\+/, replacement: '12+'},
    {regex: /OFLC: PG/, replacement: '7+'}, // Needs verification
    {regex: /OFLC: G(?:eneral)?/, replacement: '3+'},
    {regex: /ESRB: AO/, replacement: '18+'},
    {regex: /ESRB: M/, replacement: '16+'},
    {regex: /ESRB: T/, replacement: '12+'},
    {regex: /ESRB: E10\+/, replacement: '12+'},
    {regex: /ESRB: E/, replacement: '7+'},
    {regex: /ESRB: EC/, replacement: '3+'},
    {regex: /Cero: Z/, replacement: '18+'},
    {regex: /Cero: [CD]/, replacement: '16+'},
    {regex: /Cero: B/, replacement: '12+'},
    {regex: /Cero: A.*/, replacement: '3+'},
    {regex: /PEGI: (\d+\+)/, replacement: '$1'},
  ];
  //
  // #endregion Modifiable replacements
  //

  //
  // #region Postimage proxy
  //
  function proxyThroughPostImg(element) {
    const postimage = GM_getValue('postimage', {});
    const giantbomb = postimage.hasOwnProperty('giantbomb') ? postimage.giantbomb : {};
    giantbomb[element.id] = {url: element.value};
    postimage.giantbomb = giantbomb;
    GM_setValue('postimage', postimage);
    if (!$('#postimage_proxy').length) {
      let postimageButton;
      $('#image_block span:last-of-type() input[type="button"]').after(
        (postimageButton = $(
          '<input type="button" id="postimage_proxy" value="Proxy via PostImage" title="Open a postimage.org page and automatically proxy all non-ptpimg images">',
        ).click(() => {
          window.open('https://postimages.org/web', '_blank', 'popup=0,rel=noreferrer');
          $(window).on('focus.postimage', () => {
            const postimage = GM_getValue('postimage', {});
            const postimageProxied = GM_getValue('postimage-proxied', {});
            if (postimageProxied.hasOwnProperty('giantbomb')) {
              $(window).off('focus.postimage');
              const unproxied = postimage.giantbomb;
              const proxied = postimageProxied.giantbomb;
              Object.entries(proxied).forEach(([id, img]) => {
                $(`#${id}`).val(img.url);
                delete unproxied[id];
              });
              if ($.isEmptyObject(unproxied)) delete postimage.giantbomb;
              else postimage.giantbomb = unproxied;
              if ($.isEmptyObject(postimage)) {
                GM_deleteValue('postimage');
                postimageButton.remove();
              } else {
                GM_setValue('postimage', postimage);
                // Add errors to relevant images
                Object.keys(unproxied).forEach((id) =>
                  $(`#${id}`)
                    .addClass('error')
                    .after($(`<label class="error" for="${id}">PostImage failed. Check URL.</label>`)),
                );
              }
              if ($.isEmptyObject(proxied)) delete postimageProxied.giantbomb;
              else postimageProxied.giantbomb = proxied;
              if ($.isEmptyObject(postimageProxied)) GM_deleteValue('postimage-proxied');
              else GM_setValue('postimage-proxied', postimageProxied);
            }
          });
        })),
      );
    }
  }

  function executePostimages() {
    const postimage = GM_getValue('postimage', {});
    if ($.isEmptyObject(postimage) || !postimage.hasOwnProperty('giantbomb')) return;
    const giantbomb = postimage.giantbomb;
    if ($.isEmptyObject(giantbomb)) return;
    let overlay;
    $('body').before(
      $('<div id="postimages-overlay">')
        .css({
          background: 'rgba(0,0,0,.8)',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignContent: 'center',
          zIndex: 5000,
          color: 'white',
        })
        .append(
          (overlay = $('<span>').css({
            width: '400px',
            maxHeight: '100%',
            margin: 'auto',
            overflowY: 'auto',
            textSize: '80px',
          })),
        ),
    );
    if ($('#uploadControls2').length) {
      overlay.text('Uploading images for GGn...');
      $('#optsize').val(0).change(); // 'Do not resize my image'
      $('#expire').val(1).change(); // 'Remove after 1 day'
      $('#links')
        .focus()
        .val(
          Object.values(giantbomb)
            .map((img) => img.url)
            .join('\n'),
        )
        .blur();
      window.upload();
      overlay.text('Watching for errors...');
      window.setTimeout(function postimageErrorCheck() {
        if (!$('.progress:visible').length && $('.queue-item.error').length) {
          $('.queue-item.error .filename').each(function () {
            Object.values(giantbomb).find((obj) => obj.url === $(this).text().trim()).error = true;
          });
          postimage.giantbomb = giantbomb;
          GM_setValue('postimage', giantbomb);
          if (Object.values(giantbomb).every((img) => img.error)) {
            overlay.text('All image URLs errored. Please check your URLs. Click to close overlay.');
            $('#postimages-overlay')
              .click(function () {
                $(this).remove();
              })
              .css({color: 'red'});
          } else {
            $('#proceedbtn').click();
          }
        } else {
          window.setTimeout(postimageErrorCheck, 30);
        }
      }, 30);
    } else {
      overlay.text('Grabbing proxied links...');
      const proxied = GM_getValue('postimage-proxied', {});
      if (!$('#embed_box').length) {
        // #region single link
        const link = $('#code_direct').val().trim();
        const id = Object.entries(giantbomb).find(([_, img]) => !img.error)[0];
        GM_setValue('postimage-proxied', {...GM_getValue('postimage-proxied', {}), giantbomb: {[id]: {url: link}}});
        // #endregion single link
      } else {
        // #region multple links
        $('#embed_box').val('code_direct').change(); // 'Direct link'
        $('#embed_layout').val('1').change(); // '1 Column'
        const links = $('#code_box').val().trim().split('\n');
        proxied.giantbomb = Object.fromEntries(
          Object.entries(giantbomb)
            .filter(([_, img]) => !img.error)
            .map(([id, img], i) => [id, {...img, url: links[i]}]),
        );
        // #endregion multiple links
        GM_setValue('postimage-proxied', proxied);
      }
      overlay.text('Closing and returning to GGn...');
      window.setTimeout(window.close, 500);
    }
  }
  //
  // #endregion postimage proxy
  //

  //
  // #region Patch ptpimg upload buttons
  //
  function patchPtpimgButtons() {
    console.log('Patching PTPImg buttons for PostImage fallback');
    if (window.imageUpload.toString().indexOf('$.ajax(') === -1) {
      window.imageOnLoad = (response, element) => {
        if (/^FAiL$|^http:\/\/i.imgur.com\/?error.jpg$|^https:\/\/ptpimg.me\/.$|^Error: /.test(response)) {
          $(element)
            .addClass('error')
            .after($(`<label class="error" for="${element.id}">Err. PTPImg all, then click PostImage.</label>`));
          proxyThroughPostImg(element);
        } else element.value = response;
      };
      window.imageUpload = (url, element) => {
        $.ajax({
          method: 'GET',
          url: 'imgup.php',
          data: {img: url},
          success: (_, __, xhr) => imageOnLoad(xhr.responseText, element),
          error: (element) => proxyThroughPostImg(element),
        });
      };
    }
  }
  //
  // #endregion
  //

  //
  // #region Helper functions
  //
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
      .replace(/\[\/?[uo]l\]/g, '');
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
  //
  // #endregion Helper functions
  //

  //
  // #region Giantbomb functions
  //
  function fetchComplete(giantbomb) {
    GM_setValue('giantbomb', giantbomb);
    const ggnButton = $('#save_link');
    ggnButton.off('click.validate');
    ggnButton.on('click.complete', () => window.close());
    ggnButton.val('Close and return to GGn').css({backgroundColor: 'green'});
  }

  function getGameInfo() {
    const saveLink = $('#save_link');
    const imagesUrl = window.location.pathname + 'images/';
    const releasesUrl = window.location.pathname + 'releases/';
    const gameId = window.location.pathname.split('/')[2];
    const giantbomb = GM_getValue('giantbomb', {});

    saveLink.val('Working...').css({backgroundColor: 'blue'});

    // #region Fetch wiki info
    giantbomb.giantbomb = window.location.toString();
    giantbomb.title = $('a.wiki-title').text().trim();
    giantbomb.description = html2bb($('section .wiki-item-display.js-toc-content').absoluteLinks());

    giantbomb.tags = $.map($(`#wiki-${gameId}-genres a`), (elem) => $(elem).text().trim().toLowerCase());
    giantbomb.alternate_titles = [$('.wiki-item-display .aliases').text()];
    giantbomb.year = $(`#wiki-${gameId}-release_date`).getYear();
    // #endregion Fetch wiki info

    // #region Fetch images
    giantbomb.cover = $('.wiki-boxart img').attr('src');
    $.ajax({
      url: imagesUrl,
      success: (data) => {
        if (data.html) data = data.html;
        const galleryMarker = $(data).find('#galleryMarker');
        const galleryId = galleryMarker.attr('data-gallery-id');
        const objectId = galleryMarker.attr('data-object-id');
        $.ajax({
          url: `/js/image-data.json?images=${galleryId}&start=0&count=16&object=${objectId}`,
          success: (data) => {
            giantbomb.screenshots = data.images.map(({original}) => original);
            GM_setValue('giantbomb', giantbomb);
            // #endregion Fetch images

            // #region Fetch release info
            $.ajax({
              url: releasesUrl,
              success: (data) => {
                // Here pull the TOC and display it for selection
                const TOC = $(data).find('.aside-toc').parent();
                if (!TOC.length) {
                  // If there is no TOC fall back to below for just selecting platform, nothing else
                  $(`#wiki-${gameId}-platforms`)
                    .css({border: '2px solid yellow'})
                    .children('a')
                    .click(function (event) {
                      event.preventDefault();
                      giantbomb.platform = $(this).text();
                      $(this).css({border: ''});
                      fetchComplete(giantbomb);
                    });
                  window.alert('Please choose a platform from the highlighed options');
                  return;
                }

                // Display TOC to choose appropriate specific release
                $('body').before(
                  $('<div #toc-overlay>')
                    .css({
                      background: 'rgba(0,0,0,.8)',
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      height: '100%',
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignContent: 'center',
                      zIndex: 5000,
                    })
                    .append(TOC.css({width: '443px', maxHeight: '100%', margin: 'auto', overflowY: 'auto'})),
                );
                TOC.find('h3').text('Please choose a release').css({color: 'yellow'});
                TOC.find('a').click(function (event) {
                  event.preventDefault();
                  if ($(this).attr('href').startsWith('#toc-release-platform')) return;
                  // UI response stuff
                  TOC.prepend(saveLink.css({width: '', height: '', left: '', top: '', position: ''}).remove())
                    .find('h3')
                    .css({color: ''});

                  const releaseId = $(this)
                    .attr('href')
                    .replace(/#toc-release-(\d+)/, '$1');

                  const alternateReleases = $.map(
                    $(data).find(`td[data-field='name']:not([data-id$='-${releaseId}'])`),
                    (elem) => $(elem).text().trim().replace(/,/, ''),
                  );
                  if (alternateReleases && giantbomb.alternate_titles) {
                    giantbomb.alternate_titles = giantbomb.alternate_titles.concat(alternateReleases);
                  }

                  const releaseBlock = $(data).find(`[name='toc-release-${releaseId}']`).next('.release');
                  const releaseTitle = releaseBlock.find('[data-field="name"]').text().trim();
                  if (releaseTitle && giantbomb.title !== releaseTitle) {
                    // Add title to alternate titles and use platform title instead
                    if (giantbomb.alternate_titles) {
                      giantbomb.alternate_titles.push(giantbomb.title);
                    } else {
                      giantbomb.alternate_titles = [giantbomb.title];
                    }
                    giantbomb.title = releaseTitle;
                  }
                  giantbomb.rating = releaseBlock.find('[data-field="rating"]').text().trim().replace(/^$/, 'N/A');
                  giantbomb.platform = releaseBlock.find('[data-field="platform"]').text().trim();
                  giantbomb.year = releaseBlock.find('[data-field="releaseDate"]').getYear();

                  // Prepend extra information to description
                  const region = releaseBlock.find('[data-field="region"]').text().trim();
                  // TODO developers and publishers could have multiple entries, but I don't have an example
                  const developers = releaseBlock.find('[data-field="developers"]').absoluteLinks().html().trim();
                  const publishers = releaseBlock.find('[data-field="publishers"]').absoluteLinks().html().trim();
                  const singlePlayerFeatures = releaseBlock.find('[data-field="singlePlayerFeatures"]').text().trim();
                  const multiPlayerFeatures = releaseBlock.find('[data-field="multiPlayerFeatures"]').text().trim();
                  const notes = releaseBlock.find('[data-field="description"]').text().trim();

                  var releaseInfo = $('<div>').append(
                    $('<ul>').append(
                      Object.entries({
                        Region: region,
                        Developers: developers,
                        Publishers: publishers,
                        'Single Player Features': singlePlayerFeatures,
                        'Multi-player Features': multiPlayerFeatures,
                        'Release Notes': notes,
                      })
                        .filter(([_, value]) => value && value.toUpperCase() !== 'N/A')
                        .map(([key, value]) => $('<li>').append(`${key}: ${value}`)),
                    ),
                    '<br/>',
                  );
                  giantbomb.description = html2bb(releaseInfo) + giantbomb.description;

                  fetchComplete(giantbomb);
                });
              },
              error: (error) => {
                const ggnButton = $('input#save_link');
                ggnButton.val('Encountered an error getting releases. Check console').css({backgroundColor: 'red'});
                console.error(error);
              },
            });
          },
          error: (error) => {
            const ggnButton = $('input#save_link');
            ggnButton.val('Encountered an error getting images url json. Check console').css({backgroundColor: 'red'});
            console.error(error);
          },
        });
      },
      error: (error) => {
        const ggnButton = $('input#save_link');
        ggnButton.val('Encountered an error getting images page. Check console').css({backgroundColor: 'red'});
        console.error(error);
      },
    });
    // #endregion Fetch release info
  }

  function addGiantbombSaveButton() {
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
  //
  // #endregion Giantbomb functions
  //

  //
  // #region Gazelle stuff
  //
  const isNewGroup = () => window.location.pathname === '/upload.php';
  const isEditGroup = () =>
    window.location.pathname === '/torrents.php' && /action=editgroup/.test(window.location.search);
  const isWikiPage = () => window.location.pathname === $('.sub-nav li').eq(0).find('a').attr('href');

  function validateSearchedValues() {
    patchPtpimgButtons();
    const giantbomb = GM_getValue('giantbomb', {});
    if (giantbomb.hasOwnProperty('tags'))
      tagReplacements.forEach(
        ({regex, replacement}) =>
          (giantbomb.tags = giantbomb.tags.flatMap((tag) => tag.replace(regex, replacement).toLowerCase().split(', '))),
      );
    if (giantbomb.hasOwnProperty('platform'))
      platformReplacements.forEach(
        ({regex, replacement}) => (giantbomb.platform = giantbomb.platform.replace(regex, replacement)),
      );
    if (giantbomb.hasOwnProperty('rating'))
      ratingReplacements.forEach(
        ({regex, replacement}) => (giantbomb.rating = giantbomb.rating.replace(regex, replacement)),
      );

    if (isNewGroup()) {
      $('#giantbomburi').val(giantbomb.giantbomb);
      $(`#Rating option:contains('${giantbomb.rating}')`).prop('selected', true);
      $('#aliases').val(
        Array.from(new Set(giantbomb.alternate_titles))
          .filter((a) => !!a)
          .join(', '),
      );
      $('#title').val(giantbomb.title);
      $('#tags').val(
        Array.from(new Set(giantbomb.tags))
          .filter((t) => !!t)
          .join(', '),
      );
      $('#year').val(giantbomb.year);
      $('#image').val(giantbomb.cover);
      $('#album_desc').val(giantbomb.description);
      $('#platform').val(giantbomb.platform);

      if (!$('#tags').val().includes(',')) {
        $('#post').attr('style', 'border: 10px solid red');
      }
    } else {
      $("input[name='image']").val(giantbomb.cover);
    }

    const add_screen = $("a:contains('+')");
    const screenshotFields = $("[name='screens[]']").length;
    giantbomb.screenshots.forEach(function (screenshot, index) {
      if (index >= 16) return; //The site doesn't accept more than 16 screenshots
      if (index >= screenshotFields) add_screen.click();
      $("[name='screens[]']").eq(index).val(screenshot); //Finally store the screenshot link in the right screen field.
    });

    GM_deleteValue('giantbomb');
  }

  function addGazelleSearchButton() {
    $('#dnu_header').parent().attr('style', 'display:none');
    $('#steamid').parent().parent().css({display: 'none'});
    $('#reviews_table').parent().parent().css({display: 'none'});
    $('#empty_group').prop('checked', true).change();

    const titleFieldSelector = `input[name='${isNewGroup() ? 'title' : 'name'}']`;
    $(titleFieldSelector).after(
      $('<input id="giantbomb_uploady_search" type="button" value="Search Giantbomb"/>').click(function () {
        var title = encodeURIComponent($(titleFieldSelector).val());
        if (!title) return;

        window.open(`https://www.giantbomb.com/search/?header=1&i=game&q=${title}`, '_blank', 'popup=0,rel=noreferrer');

        GM_setValue('giantbomb', {});

        $(window).on('focus.giantbomb', () => {
          if (GM_getValue('giantbomb', {}).hasOwnProperty('platform')) {
            validateSearchedValues();
            $(window).off('focus.giantbomb');
          }
        });
      }),
    );
  }
  //
  // #endregion
  //

  if (window.location.hostname === 'gazellegames.net' && (isNewGroup() || isEditGroup())) {
    addGazelleSearchButton();
  } else if (window.location.hostname === 'www.giantbomb.com' && isWikiPage()) {
    addGiantbombSaveButton();
  } else if (['postimages.org', 'postimg.cc'].includes(window.location.hostname)) {
    executePostimages();
  }
})(unsafeWindow || window, jQuery || (unsafeWindow || window).jQuery, html2bbcode);
