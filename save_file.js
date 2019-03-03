var aes = require('./aes');
var axios = require('axios');
var unique_string = require('unique-string');

exports.save = async function (src, filesize) {

  function toNumbers(d) {
    var e = [];
    d.replace(/(..)/g, function (d) {
      e.push(parseInt(d, 16))
    });
    return e
  }

  function toHex() {
    for (var d = [], d = 1 == arguments.length && arguments[0].constructor == Array ? arguments[0] : arguments, e = "", f = 0; f < d.length; f++) e += (16 > d[f] ? "0" : "") + d[f].toString(16);
    return e.toLowerCase()
  }

  var init_req_xhr = await axios.get(`http://musicsy-cdn.epizy.com/`, {
    withCredentials: true,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0'
    }
  });

  var quot_hashes = init_req_xhr.data.match(/\"[\w-]{32}\"/g);
  var hashes = quot_hashes.map((h) => { return h.match(/[\w-]{32}/)[0] })

  var a = toNumbers(hashes[0]),
    b = toNumbers(hashes[1]),
    c = toNumbers(hashes[2]);

  var cookie = "__test=" + toHex(aes.slowAES.decrypt(c, 2, a, b)) + "; expires=Thu , 31-Dec-37 23:55:55 GMT; path=/;";

  var filename = unique_string();
  var ext = ".m4a";
  src = encodeURIComponent(src);

  var save_file_xhr = await axios.get(`http://musicsy-cdn.epizy.com/add.php?i=1&filename=${filename}&ext=${ext}&src=${src}`, {
    headers: {
      "Cookie": cookie
    }
  });

  // return `http://musicsy-cdn.epizy.com/add.php?i=1&filename=${filename}&ext=${ext}&src=${src}`;
  return filename;
}