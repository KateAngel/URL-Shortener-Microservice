require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

let bodyParser = require('body-parser');
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
const dns = require('dns');

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

const uri = process.env.MONGO_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const connection = mongoose.connection;
connection.once("open", () => {
  console.log('Connected Database Successfully')
});

let urlSchema = new Schema({
  original_url: {type: String},
  short_url: {type: Number}
});

let Url = mongoose.model('Url', urlSchema);

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint

// find one by orginal url
const findOneByOriginalUrl = (url, done) => {
  Url
    .findOne({ original_url: url })
    .then((data) =>{
      done(null, data);
    })
    .catch((err) => {console.log({err, 'error':'original'}); return done(err);});
}

const findOneByShortUrl = (shortUrl, done) => {
  Url
    .findOne({ short_url: shortUrl })
    .then((data) => {
      done(null, data);
    })
    .catch((err) => {console.log({err, 'error':'short'}); return done(err);});
}

const createAndSaveUrl = (url, done) => {
  Url
    .estimatedDocumentCount()
    .then((dataLength) => {
      let newShortUrl;
      if (dataLength == 0) {
        newShortUrl = 0;
      } else {
        newShortUrl = dataLength;
      };
      new Url({original_url: url, short_url: newShortUrl})
          .save()
          .then((data) => {
            done(null, {original_url: data.original_url, short_url: data.short_url});
          })
          .catch((err) => {console.log({err, 'error':'save'}); return done(err);});
    })
    .catch((err) => {console.log({err, 'error':'count'}); return done(err);});
}

const checkValidUrl = (url, done) => {
    dns.lookup(url.replace(/^http(s):\/\//g, ''), (err, address, family) => {
      if(err) return done(err);
      done(null, address);
    });
  }

app.post('/api/shorturl', (req, res) => {
  let input = req.body.url.replace(/\/$/g, '');
  if (input === null || input === '') { 
    return res.json({ error: 'invalid url' }); 
  }
  if ( /^(http(s):\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g.test(input) ) {
    checkValidUrl(input.match(/^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/igm)[0], (err, address) => {
      if(err) {
        console.log({err, 'error':'checkValidUrl'});
        return res.json(err);}
      findOneByOriginalUrl(input, (err, data) => {
        if (err) {
          console.log({err, 'error':'findOneByOriginalUrl'});
          return res.json(err);
        }
        // if url exists alredy
        if (data) {
          res.json({original_url: data.original_url, short_url: data.short_url});
        } else {
          createAndSaveUrl(input, (err, doc) => {
            if (err) {
              console.log({err, 'error':'createAndSaveUrl'});
              return res.json(err); 
            };
            res.json(doc);
          });
        }
      })
    });
  } else {
    return res.json({ error: 'invalid url' });
  }
});

app.get('/api/shorturl/:shortUrl', (req, res) => {
  findOneByShortUrl(req.params.shortUrl, (err, doc) => {
    if (err) {
    console.log({err, 'error':'findOneByShort'});
    return res.json(err);
    }
    if (doc == null)
      res.json({error: 'invalid short URL'});
    else
      res.redirect(doc.original_url);
  });
});


var listener = app.listen(process.env.PORT || 3000, function() {
  console.log('Listening on port http://localhost:' + listener.address().port);
});
