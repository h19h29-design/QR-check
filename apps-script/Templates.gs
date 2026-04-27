function renderPage_(name, data) {
  const tpl = HtmlService.createTemplateFromFile(name);
  tpl.data = data || {};
  return tpl.evaluate()
    .setTitle((data && data.title) || 'QR보안점검표')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

