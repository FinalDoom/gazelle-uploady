const window = unsafeWindow;

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
        if (
          $('#image, input[name="screens[]"]')
            .not('.error')
            .filter((_, element) => element.value.split('/')[2] !== 'ptpimg.me').length
        ) {
          alert('Please attempt to submit all screenshots through PTPImg buttons first.');
          return;
        }
        window.open('https://postimages.org/web', '_blank', 'popup=0,rel=noreferrer');
        $(window).on('focus.postimage', () => {
          const postimage = GM_getValue('postimage', {});
          const postimageProxied = GM_getValue('postimage-proxied', {});
          if (postimageProxied.hasOwnProperty('giantbomb')) {
            $(window).off('focus.postimage');
            const unproxied = postimage.giantbomb || {};
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
        data: {img: url.split('?')[0]},
        success: (_, __, xhr) => imageOnLoad(xhr.responseText, element),
        error: (element) => proxyThroughPostImg(element),
      });
    };
  }
}
//
// #endregion
//
