function renderPage_(name, data) {
  const tpl = HtmlService.createTemplateFromFile(name);
  tpl.data = data || {};
  return tpl.evaluate()
    .setTitle((data && data.title) || 'QR보안점검표')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function jsonForHtmlScript_(value) {
  return JSON.stringify(value == null ? null : value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
