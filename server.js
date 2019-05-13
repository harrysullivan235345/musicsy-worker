//  OpenShift sample Node application
var express = require('express'),
    app = express(),
    morgan = require('morgan'),
    // youtube_dl = require('youtube-dl'),
    os = require('os'),
    axios = require('axios'),
    fs = require('fs');


var sleep = require('sleep-promise');

var ytdl = require('ytdl-core');
var axios = require('axios');

const mongoose = require('mongoose');

var save_file = require('./save_file');

Object.assign = require('object-assign')
var ceil = Math.ceil;
Object.defineProperty(Array.prototype, 'chunk', {
    value: function(n) {
        return Array.from(Array(ceil(this.length / n)), (_, i) => this.slice(i * n, i * n + n));
    }
});


app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))
app.use(express.static('public'))
app.use(express.json());
app.use(express.urlencoded({
    extended: false
}));

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip = process.env.IP || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null) {
    var mongoHost, mongoPort, mongoDatabase, mongoPassword, mongoUser;
    // If using plane old env vars via service discovery
    if (process.env.DATABASE_SERVICE_NAME) {
        var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase();
        mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'];
        mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'];
        mongoDatabase = process.env[mongoServiceName + '_DATABASE'];
        mongoPassword = process.env[mongoServiceName + '_PASSWORD'];
        mongoUser = process.env[mongoServiceName + '_USER'];

        // If using env vars from secret from service binding  
    } else if (process.env.database_name) {
        mongoDatabase = process.env.database_name;
        mongoPassword = process.env.password;
        mongoUser = process.env.username;
        var mongoUriParts = process.env.uri && process.env.uri.split("//");
        if (mongoUriParts.length == 2) {
            mongoUriParts = mongoUriParts[1].split(":");
            if (mongoUriParts && mongoUriParts.length == 2) {
                mongoHost = mongoUriParts[0];
                mongoPort = mongoUriParts[1];
            }
        }
    }

    if (mongoHost && mongoPort && mongoDatabase) {
        mongoURLLabel = mongoURL = 'mongodb://';
        if (mongoUser && mongoPassword) {
            mongoURL += mongoUser + ':' + mongoPassword + '@';
        }
        // Provide UI label that excludes user id and pw
        mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
        mongoURL += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    }
}

mongoose.connect("mongodb://musicsy-system:CabfongAgEijIk5@ds133252.mlab.com:33252/musicsy", {
    useNewUrlParser: true
}, () => {
    console.log('Connected to mongodb');
});

function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
    if (mongoURL == null) return;

    var mongodb = require('mongodb');
    if (mongodb == null) return;

    mongodb.connect(mongoURL, function(err, conn) {
        if (err) {
            callback(err);
            return;
        }

        db = conn;
        dbDetails.databaseName = db.databaseName;
        dbDetails.url = mongoURLLabel;
        dbDetails.type = 'MongoDB';

        console.log('Connected to MongoDB at: %s', mongoURL);
    });
};

const extendTimeoutMiddleware = (req, res, next) => {
    const space = ' ';
    let isFinished = false;
    let isDataSent = false;

    // Only extend the timeout for API requests
    if (!req.url.includes('/api')) {
        next();
        return;
    }

    res.once('finish', () => {
        isFinished = true;
    });

    res.once('end', () => {
        isFinished = true;
    });

    res.once('close', () => {
        isFinished = true;
    });

    res.on('data', (data) => {
        // Look for something other than our blank space to indicate that real
        // data is now being sent back to the client.
        if (data !== space) {
            isDataSent = true;
        }
    });

    const waitAndSend = () => {
        setTimeout(() => {
            // If the response hasn't finished and hasn't sent any data back....
            if (!isFinished && !isDataSent) {
                // Need to write the status code/headers if they haven't been sent yet.
                if (!res.headersSent) {
                    res.writeHead(202);
                }

                res.write(space);

                // Wait another 15 seconds
                waitAndSend();
            }
        }, 15000);
    };

    waitAndSend();
    next();
};

app.use(extendTimeoutMiddleware);

app.get('/', function(req, res) {
    // try to initialize the db on every request if it's not already
    // initialized.
    if (!db) {
        initDb(function(err) {});
    }
    if (db) {
        var col = db.collection('counts');
        // Create a document with request IP and current time of request
        col.insert({
            ip: req.ip,
            date: Date.now()
        });
        col.count(function(err, count) {
            if (err) {
                console.log('Error running count. Message:\n' + err);
            }
            res.render('index.html', {
                pageCountMessage: count,
                dbInfo: dbDetails
            });
        });
    } else {
        res.render('index.html', {
            pageCountMessage: null
        });
    }
});

app.get('/pagecount', function(req, res) {
    // try to initialize the db on every request if it's not already
    // initialized.
    if (!db) {
        initDb(function(err) {});
    }
    if (db) {
        db.collection('counts').count(function(err, count) {
            res.send('{ pageCount: ' + count + '}');
        });
    } else {
        res.send('{ pageCount: -1 }');
    }
});

app.post('/url_to_src', async (req, res) => {
    var get_src = new Promise(function(resolve, reject) {
        youtube_dl.getInfo(req.body.url, [], function(err, info) {
            if (err) reject(err);
            var formats = info.formats;
            var m4as = formats.filter((format) => {
                return format.ext === "m4a"
            })
            resolve(m4as[0]);
        });
    });
    var obj = await get_src;
    res.json({
        src: obj.url,
        filesize: obj.filesize
    });
})

const Schema = mongoose.Schema;

const trackSchema = new Schema({
    thumbnail: String,
    track_name: String,
    artist: String,
    date_added: String,
    tags: Array,
    duration: Number,
    is_explicit: Boolean,
    yt_id: String,
    clean_yt_id: String,
    src: String,
    clean_src: String,
});

const Track = mongoose.model('track', trackSchema);

app.post('/save_file', async (req, res) => {
    res.json({
        status: 'processing'
    });
    var filename = await save_file.save(req.body.src);

    var get_track = Track.findById(req.body.track_id);
    var track = await get_track.exec();

    track.src = `http://musicsy-cdn.epizy.com/data/${filename}.m4a`;
    var updated_track = await track.save();
})

app.get('/memory_usage', (req, res) => {
    res.json(process.memoryUsage());
});

app.get('/update_srcs', async (req, res) => {
    var _d = new Date();
    res.json(`hi at ${_d.toString()}`);

    async function get_src(lyrics_url) {
        var get_url_promise = new Promise((resolve, reject) => {
            ytdl.getInfo(lyrics_url, function(err, info) {
                if (!info) {
                    resolve(null);
                    return null;
                }

                var filtered = info.formats.filter((version) => {
                    return version.container === 'm4a';
                })

                if (filtered.length > 0) {
                    resolve(filtered[0].url);
                } else {
                    resolve(info.formats[0].url);
                }
            })
        })
        var src = await get_url_promise;
        return src;
    }

    async function update_srcs_in_db(data) {
        var update = data.map(async function(track) {
            return await Track.findByIdAndUpdate(track._id, {
                src: track.src,
                clean_src: track.clean_src,
            });
        });
        return await Promise.all(update);
    }

    var promise = new Promise(function(resolve, reject) {
        Track.find({}, function(err, docs) {
            // console.log(docs);
            resolve(docs);
        })
    });

    var tracks = await promise;

    var chunked = tracks.chunk(2);

    for (var i = 0; i < chunked.length; i++) {
        var data = chunked[i].map(async (track) => {
            var src = await get_src(`https://www.youtube.com/watch?v=${track.yt_id}`);
            await sleep(420)
            var clean_src = await get_src(`https://www.youtube.com/watch?v=${track.clean_yt_id}`);

            if (src === null || clean_src === null) {
                var xhr = await axios.post('https://musicsy.herokuapp.com/api/track/add', {
                    track_name: track.track_name,
                    artist: track.artist,
                    tags: track.tags,
                    thumbnail: track.thumbnail,
                    is_explicit: track.is_explicit
                })

                var track_id = xhr.data.track._id;
                var newly_added_track = await Track.findById(track_id);
                var newly_added_track_src = newly_added_track.src;
                var newly_added_track_clean_src = newly_added_track.clean_src;
                var newly_added_track_yt_id = newly_added_track.yt_id;
                var newly_added_track_clean_yt_id = newly_added_track.clean_yt_id;

                var this_track = await Track.findById(track._id);
                this_track.src = newly_added_track_src;
                this_track.clean_src = newly_added_track_clean_src;
                this_track.yt_id = newly_added_track_yt_id;
                this_track.clean_yt_id = newly_added_track_clean_yt_id;
                await this_track.save();
                await Track.findByIdAndRemove(newly_added_track._id);
                return null;
            }

            return {
                src: src,
                clean_src: clean_src,
                id: track._id
            }
        })

        data = await Promise.all(data);
        data = data.filter(d => d !== null);

        var done = await update_srcs_in_db(data);
        await sleep(290)
    }


    // return { src: src, yt_id: yt_id };
})

// app.post('/save_file', async (req, res) => {
//   axios({
//     method:'get',
//     url: req.body.src,
//     responseType:'stream'
//   })
//     .then(function (response) {
//       var filename = `${String(Math.random()).slice(3,8)}.m4a`;
//       response.data.pipe(fs.createWriteStream(`./public/${filename}`).on('finish', () => {
//         console.log('heyr');
//       }));
//         res.json({ filename: filename });
//     });
// })

// error handling
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something bad happened!');
});

initDb(function(err) {
    console.log('Error connecting to Mongo. Message:\n' + err);
});

var server = app.listen(port, ip);
server.timeout = 30000000
console.log('Server running on http://%s:%s', ip, port);

module.exports = app;