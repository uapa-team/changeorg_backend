const settings = require('./config/conf.json');

const bodyParser = require('body-parser');
const jwt = require('jwt-simple');
const moment = require('moment');
const LdapAuth = require('ldapauth-fork');
const Promise = require('promise');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite3');
const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars');

app = require('express')();

//  app.use(bodyParser.urlencoded({extended: false}));

app.use(bodyParser.json());
app.use(require('cors')());

const gmailTransport = nodemailer.createTransport('SMTP', settings.mailer);
// gmailTransport.use('compile', hbs({
//   viewPath: 'views/email',
//   extName: '.hbs',
// }));

ldapSetts = settings.ldap;
ldapSetts.tlsOptions = {
  tlsOptions: {
    ca: [fs.readFileSync('./cert.pem')],
  },
};

let auth = new LdapAuth(ldapSetts);


app.set('views', __dirname + '/views');
app.set('view engine', 'haml');
app.engine('.haml', require('hamljs').renderFile);
app.set('jwtTokenSecret', settings.jwt.secret);

const authenticate = (username, password) => {
  return new Promise((resolve, reject) => {
    auth.authenticate(username, password, (err, user) => {
      if (err) {
        reject(err);
      } else if (!user) {
        reject(new Error('Not correct user'));
      } else {
        resolve(user);
      }
    });
  });
};

app.post('/login', (req, res) => {
  //onsole.log(req.body.username)
  //console.log(req.body.password)
  if (req.body.username && req.body.password) {
    if (/^[a-zA-Z]/.test(req.body.username)) {
      authenticate(req.body.username, req.body.password)
          .then((user) => {
            const expires = parseInt(moment().add(2, 'days').format('X'));
            const token = jwt.encode({
              exp: expires,
              user_name: user.uid,
              full_name: user.cn,
              mail: user.mail,
            }, app.get('jwtTokenSecret'));
            db.get(
                'SELECT count(user) as count FROM professors WHERE user ' +
                'like "' + user.uid + '"',
                (err, row) => {
                  if (row.count===0) {
                    res.status(401)
                        .send({error: 'Unauthorized, not proffesor.'});
                  } else {
                    res.json({token: token, full_name: user.cn});
                  }
                });
          })
          .catch((err) => {
            if (err.name === 'InvalidCredentialsError'||
              (typeof err === 'string' && err.match(/no such user/i))) {
              res.status(401).send({error: 'Wrong user or password'});
            } else {
              res.status(500).send({error: 'Unexpected Error'});
              auth = new LdapAuth(settings.ldap);
            }
          });
    } else {
      res.status(400).send({error: 'Bad username supplied'});
    }
  } else {
    res.status(400).send({error: 'No username or password supplied'});
  }
});

app.post('/sponsor', (req, res) => {
  const token = req.headers.token;  if (token) {
    try {
      const decoded = jwt.decode(token, app.get('jwtTokenSecret'));
      if (decoded.exp <= parseInt(moment().format('X'))) {
        res.status(400).send({error: 'Access token has expired'});
      } else {
        db.run('UPDATE request SET Apadrinado = 1 WHERE request_id like ?',
            [req.body.request_id],
            (error, rows) => { });
        db.get('SELECT * FROM request WHERE request_id = ?',
            [req.body.request_id],
            (err, row) => {
              db.run('INSERT INTO sponsor VALUES(?,?)',
                  [decoded.user_name, row.Correo],
                  (error, rows) => {
                    const HelperOptions = {
                      from: '"Uapapp" <uapapp_fibog@unal.edu.co>',
                      to: 'uapapp_fibog@unal.edu.co',
                      subject: 'Hellow world!',
                      html: '<p> Hollo </p>',
                    };
                    gmailTransport.sendMail(HelperOptions, (error, info) => {
                      if (error) {
                        console.log(error);
                        res.json(error);
                      }
                      res.json(info);
                    });
                  });
            });
      }
    } catch (err) {
      res.status(500).send({error: 'Access token could not be decoded'});
    }
  } else {
    res.status(400).send({error: 'Access token is missing'});
  }
});

app.get('/prequest', (req, res) => {
  const token = req.headers.token;
   if (token) {
    try {
      const decoded = jwt.decode(token, app.get('jwtTokenSecret'));
      if (decoded.exp <= parseInt(moment().format('X'))) {
        res.status(400).send({error: 'Access token has expired'});
      } else {
        const query = 'SELECT request_id, Programa, Fecha, PBM, Procedencia, ' +
          'Apoyo, Descripcion FROM request where Apadrinado = 0';
        db.all(query, (error, rows) => {
          res.json({rows});
        });
      }
    } catch (err) {
      res.status(500).send({error: 'Access token could not be decoded'});
    }
  } else {
    res.status(400).send({error: 'Access token is missing'});
  }
});

app.post('/request', (req, res) => {

  
  const query = 'INSERT INTO request VALUES (?, ?, ?, ?, ?, ?, ?, ' +
    '?, ?, ?, ?, ?, ?, ?)';
  db.run(query, [
    undefined,
    req.body.Nombre,
    req.body.Correo,
    req.body.Fecha,
    req.body.Programa,
    req.body.Tipo_Documento,
    req.body.Documento,
    req.body.PBM,
    req.body.Procedencia,
    req.body.Celular,
    req.body.Direccion,
    req.body.Apoyo,
    req.body.Descripcion,
    0,
  ],
  
  (err) => {
    console.log(err);
    
  });
  res.status(200).send({status: 'I tried all my best'});
  res.status(400).send({status: 'wrong format or some atributes missing'});
  
    
});

const port = (process.env.PORT || 3000);
app.listen(port, function() {
  console.log('Listening on port: ' + port);
  if (typeof settings.ldap.reconnect === 'undefined' ||
    settings.ldap.reconnect === null || settings.ldap.reconnect === false) {
    console.warn('WARN: This service may become unresponsive ' +
      'when ldap reconnect is not configured.');
  }
});
