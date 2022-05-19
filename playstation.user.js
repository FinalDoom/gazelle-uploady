// ==UserScript==
// @name         GazelleGames Playstation Uploady
// @namespace    https://gazellegames.net/
// @version      0.0.1
// @description  Uploady for Playstation sites
// @author       FinalDoom
// @match        https://gazellegames.net/upload.php*
// @match        https://gazellegames.net/torrents.php?action=editgroup&*
// @match        https://gazellegames.net/torrents.php?id=*
// @match        https://gazellegames.net/upload.php?groupid=*
// @match        https://gazellegames.net/torrents.php?action=edit&*
// @match        https://store.playstation.com/*/product/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://raw.githubusercontent.com/tengattack/html2bbcode.js/master/lib/html2bbcode.js
// @require      https://raw.githubusercontent.com/FinalDoom/gazelle-uploady/master/common.js
// ==/UserScript==

'use strict';

function getGameInfo() {
  const playstation = new GameInfo();

  playstation.platform = $('.pdp-info [data-qa$="#platform-value"]').text();
  playstation.title = $('.pdp-game-title [data-qa$="title#name"]').text().trim();
  playstation.addLanguage(...$('.pdp-info [data-qa$="#subtitles-value"').text().trim().split(/,\s+/));
  playstation.description = $('.pdp-overview [data-qa$="#description"]').parent().html();

  playstation.addTag(
    ...$('.pdp-info [data-qa$="#genre-value"] span')
      .map((_, elem) => $(elem).text().trim())
      .toArray(),
  );
  playstation.year = $('.pdp-info [data-qa$="#releaseDate-value"').text();
  playstation.rating = $('.pdp-content-rating img').first().attr('alt');

  playstation.cover = $('.pdp-background-image [data-qa$="#heroImage"] img').first().attr('src').split('?')[0];

  playstation.extraInfo = {
    voiceLanguages: $('.pdp-info [data-qa$="#voice-value"]').text().trim(),
    publisher: $('.pdp-info [data-qa$="#publisher"]').text().trim(),
    storeLink: window.location.toLocaleString(),
  };

  return playstation;
}

(function () {
  ('use strict');

  new UploadyFactory().build(
    'Search PlayStation',
    (title) => `https://store.playstation.com/en-us/search/${title}`,
    (resolve) => resolve(getGameInfo()),
  );
})();
