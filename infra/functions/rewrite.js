// CloudFront viewer-request function (cloudfront-js-2.0).
// /remotes/* and /config/* are served as-is; other files come from the shell build under /shell;
// everything else is an SPA route and gets the shell's index.html.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/remotes/') === 0 || uri.indexOf('/config/') === 0) {
    return request;
  }
  var last = uri.substring(uri.lastIndexOf('/') + 1);
  if (last.indexOf('.') > 0) {
    request.uri = '/shell' + uri;
    return request;
  }
  request.uri = '/shell/index.html';
  return request;
}
