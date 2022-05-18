// ==UserScript==
// @name         GazelleGames Giantbomb Uploady
// @namespace    https://gazellegames.net/
// @version      1.0.1
// @description  Uploady for giantbomb
// @author       FinalDoom
// @match        https://gazellegames.net/upload.php*
// @match        https://gazellegames.net/torrents.php?action=editgroup*
// @match        https://www.giantbomb.com/*
// @match        http://www.giantbomb.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/master/lib/html2bbcode.js
// @require      https://raw.githubusercontent.com/FinalDoom/gazelle-uploady/master/common.js
// ==/UserScript==

'use strict';

//
// #region Helper functions
//
$.fn.extend({
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
async function getGameInfo(resolve) {
  const giantbomb = new GameInfo();
  const gameId = window.location.pathname.split('/')[2];

  // #region Fetch wiki info
  giantbomb.giantbomb = window.location.toString();
  giantbomb.title = $('a.wiki-title').text().trim();
  giantbomb.description = $('section .wiki-item-display.js-toc-content').absoluteLinks().html();

  giantbomb.addTag(
    ...$.map($(`#wiki-${gameId}-genres a`), (elem) =>
      $(elem)
        .text()
        .trim()
        .toLowerCase()
        .replace(/[ -]/g, '.')
        .replace(/'em/, 'em')
        .replace(/,\./g, ', ')
        .replace(/,.,/g, ','),
    ),
  );
  giantbomb.addAlias($('.wiki-item-display .aliases').text());
  giantbomb.year = $(`#wiki-${gameId}-release_date`).text();
  // #endregion Fetch wiki info

  // #region Fetch images
  giantbomb.cover = $('.wiki-boxart img').attr('src');
  const galleryUrl = await $.ajax({
    url: window.location.pathname + 'images/',
  })
    .then((data) => {
      if (data.html) data = data.html;
      const galleryMarker = $(data).find('#galleryMarker');
      const galleryId = galleryMarker.attr('data-gallery-id');
      const objectId = galleryMarker.attr('data-object-id');
      return `/js/image-data.json?images=${galleryId}&start=0&count=16&object=${objectId}`;
    })
    .catch((error) => {
      console.error(error);
      throw 'Encountered an error getting images page. Check console';
    });
  await $.ajax({
    url: galleryUrl,
  })
    .then((data) => data.images.forEach(({original}) => giantbomb.addScreenshot(original)))
    .catch((error) => {
      console.error(error);
      throw 'Encountered an error getting images url json. Check console';
    });
  // #endregion Fetch images

  console.log('fetching', window.location.pathname + 'releases/');
  // #region Fetch release info
  await $.ajax({
    url: window.location.pathname + 'releases/',
  })
    .then((data) => {
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
            resolve(giantbomb);
            return;
          });
        window.alert('Please choose a platform from the highlighed options');
        return;
      }

      // Display TOC to choose appropriate specific release
      $('body').before(
        $('<div class="toc-overlay">')
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

        $(data)
          .find(`td[data-field='name']:not([data-id$='-${releaseId}'])`)
          .each(function () {
            giantbomb.addAlias($(this).text().trim().replace(/,/, ''));
          });

        const releaseBlock = $(data).find(`[name='toc-release-${releaseId}']`).next('.release');
        const releaseTitle = releaseBlock.find('[data-field="name"]').text().trim();
        if (releaseTitle && giantbomb.title !== releaseTitle) {
          giantbomb.title = releaseTitle;
        }
        giantbomb.rating = releaseBlock.find('[data-field="rating"]').text().trim().replace(/^$/, 'N/A');
        giantbomb.platform = releaseBlock.find('[data-field="platform"]').text().trim();
        giantbomb.year = releaseBlock.find('[data-field="releaseDate"]').getYear();

        // Prepend extra information to description
        giantbomb.extraInfo = {
          region: releaseBlock.find('[data-field="region"]').text().trim(),
          // TODO developers and publishers could have multiple entries, but I don't have an example
          developers: releaseBlock.find('[data-field="developers"]').absoluteLinks().html().trim(),
          publishers: releaseBlock.find('[data-field="publishers"]').absoluteLinks().html().trim(),
          singlePlayerFeatures: releaseBlock.find('[data-field="singlePlayerFeatures"]').text().trim(),
          multiPlayerFeatures: releaseBlock.find('[data-field="multiPlayerFeatures"]').text().trim(),
          notes: releaseBlock.find('[data-field="description"]').text().trim(),
        };
        resolve(giantbomb);
      });
    })
    .catch((error) => {
      console.error(error);
      throw 'Encountered an error getting releases. Check console';
    });
  // #endregion Fetch release info
}
//
// #endregion Giantbomb functions
//

(function () {
  ('use strict');
  Uploady.init(
    'Search Giantbomb',
    (title) => `https://www.giantbomb.com/search/?header=1&i=game&q=${title}`,
    getGameInfo,
  );
})();
