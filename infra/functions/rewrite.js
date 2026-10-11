// CloudFront viewer-request function (cloudfront-js-2.0).
// /remotes/* and /config/* are served as-is. Static files from the shell build (by extension) come from
// /shell; everything else is an SPA route and gets the shell's index.html. Routes may contain dots
// (firmware versions, device names), so only known static extensions count as files.
var STATIC = /\.(js|mjs|css|map|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|txt|json|webmanifest)$/;

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/remotes/') === 0 || uri.indexOf('/config/') === 0) {
    return request;
  }
  if (STATIC.test(uri)) {
    request.uri = '/shell' + uri;
    return request;
  }
  request.uri = '/shell/index.html';
  return request;
}
