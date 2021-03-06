const cities = require('./cities.json');
const journals = require('./journals.json');

var Busboy = require('busboy');
var iconv = require('iconv-lite');

var parser = {};


parser.upload = function (req, cb) {
	let busboy = new Busboy({ headers: req.headers });
	let chunks = [];
	let error = null;
	let form = {};
	busboy.on('field', function (fieldname, value) {
		form[fieldname] = value;
	});

	busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {

		file.on('data', function(chunk) {
			chunks.push(chunk);

		});
		file.on('end', function() {
		    cb(null, iconv.decode(Buffer.concat(chunks), "ISO-8859-2"), form)
        })
        file.on('error', cb)
	});
	busboy.on('finish', function () {

	})

	req.pipe(busboy)
}

parser.parse = function (rawText, done) {
    try {
	    const exp1 = new RegExp(/<BR> [0-9]{0,6}\. <BR>/);
	    const exp2 = new RegExp(/<span class="label">/);

	    let recordObjectsArray = [];
	    let queryName = rawText.split('id="querylabel">Zapytanie: </span>')[1].split('<BR><FONT')[0];
	    if(queryName.indexOf('</FONT>') !== -1) { // more than one name in query
		    queryName = queryName.split('/FONT>')[1].split(' <FONT')[0]
	    }
	    const rawTextArray = rawText.split(exp1);
	    rawTextArray.forEach((record, index) => {
		    if(index === 0) return;

		    let recordObject = {
			    authorsExpertusFormat: [],
			    languages: [],
			    polishkeywords: [],
			    englishkeywords: [],
			    authors: [],
			    invalid: {}
		    };

		    let pageCountTowardsSumConditions = {
			    typFormalny : false,
			    typMerytoryczny : false,
			    czyWycinek : false
		    }

		    const recordArray = record.split(exp2);

		    const redundantSufix = '</UL></span>';

		    recordArray.forEach( (line) => {
			    const splitLine = line.substr(0, line.length - 4).split(': </span>');
			    recordObject.points = 0;
			    switch (splitLine[0]) {
				    case 'Aut.':
					    splitLine[1].split(',').forEach((name) => {
						    name = name.trim();
						    recordObject.authorsExpertusFormat.push(name);
						    recordObject.authors.push(name);
					    });
					    break;

				    case 'Tytuł':
					    recordObject.title = splitLine[1];
					    break;

				    case 'Tytuł równoległy':
					    recordObject.titleVariant = splitLine[1];
					    break;

				    case 'Opis wydawn.':
					    recordObject.potentialCity = splitLine[1].split(':').length !== 1 ?
						    splitLine[1].split(':')[0].trim() :
						    null;
					    ['.', ',', '\'', '', ':', ';', ']', '[', '(', ')'].forEach(function (ignoredChar) {
						    splitLine[1] = splitLine[1].split(ignoredChar).join('')
					    });

					    if(cities[recordObject.potentialCity]) {
						    recordObject.latLng = cities[recordObject.potentialCity]
					    }

					    recordObject.year = Number.parseInt(splitLine[1].trim().substr(splitLine.length - 6));
					    break;

				    case 'Typ formalny publikacji':
					    let publicationType = splitLine[1];

					    if(publicationType === '008') pageCountTowardsSumConditions.typFormalny = true;
					    if(publicationType === '002') recordObject.ministerialArticle = true;

					    break;

				    case 'Typ merytoryczny publikacji':
					    if(['KNP','PAP','PSP'].indexOf(splitLine[1].substr(0, 3)) !== -1)  {
						    recordObject.publicationType = 'book';
						    pageCountTowardsSumConditions.typMerytoryczny = true;
					    }
					    else if('ECP' === splitLine[1].substr(0,3) || 'EZ' === splitLine[1].substr(0,2)) {
						    recordObject.publicationType = 'edit'
					    }
					    else recordObject.publicationType = 'article';
					    break;

				    case 'Język':
					    recordObject.languages.push(splitLine[1]);
					    break;

				    case 'Polskie słowa kluczowe':
					    splitLine[1].split('<LI>').forEach((elem, index) => {
						    if(index == 0) return;
						    elem = elem.split(redundantSufix).join('');
						    elem = elem.split('<!-- 10.txt begin -->')[0];
						    recordObject.polishkeywords.push(elem.trim());
					    });
					    break;

				    case 'Angielskie słowa kluczowe':
					    splitLine[1].split('<LI>').forEach((elem, index) => {
						    if(index == 0) return;
						    elem = elem.split(redundantSufix).join('');
						    elem = elem.split('<!-- 10.txt begin -->')[0];
						    recordObject.englishkeywords.push(elem.trim());
					    });
					    break;


				    case 'Opis fiz.':
					    const pageRange = splitLine[1].match(/[0-9]{1,5}-[0-9]{1,5}/);
					    if(pageRange != null) {
						    const pageArray = pageRange[0].split('-');
						    recordObject.pageRange = pageRange[0];
						    recordObject.pageAmount = Number.parseInt(pageArray[1]) - Number.parseInt(pageArray[0]) + 1;
						    pageCountTowardsSumConditions.czyWycinek = true;
					    }
					    else if(line.match(/[0-9]{1,5}/) != null) {
						    recordObject.pageRange = '0-' + splitLine[1].match(/[0-9]{1,5}/)[0].trim();
						    recordObject.pageAmount = Number.parseInt(splitLine[1].match(/[0-9]{1,5}/)[0].trim());
					    }
					    else  {
						    console.error(new Error('Failed RegExp parse at pageRange of line: ' + splitLine[1]).message);
						    recordObject.invalid["300"] = 'Could not infer page range from description';
						    recordObject.unparsedPageAmount = line.substr(4);
					    }
					    break;


				    case 'Punktacja ministerstwa':
					    const styleTrimmed = splitLine[1].split('<span class="field">')[1].split('</span>')[0];
					    recordObject.points = Number.parseFloat(styleTrimmed);
					    break;
				    case 'Punktacja': //expertus, in its infinite wisdom, may generate inconsistent labels
					    const styleTrimmed2 = splitLine[1].split('<span class="field">')[1].split('</span>')[0];
					    recordObject.points = Number.parseFloat(styleTrimmed2);
					    break;
				    case 'Pełny tytuł czasop.':
					    recordObject.journalTitle = splitLine[1].split('<BR>')[0].split("<!--")[0];
					    recordObject.compJournalTitle = recordObject.journalTitle.toLowerCase();
					    [' ', '.', ',', '\'', '', ':', ';'].forEach(function (ignoredChar) {
						    recordObject.compJournalTitle = recordObject.compJournalTitle.split(ignoredChar).join('')
					    })
					    if(journals[recordObject.compJournalTitle]) {
						    let city = journals[recordObject.compJournalTitle].city;
						    if(city) {
							    recordObject.city = city;
							    let latLng = cities[city];
							    recordObject.latLng = latLng;
						    }
					    }


					    break;

			    }


		    });

		    let countPages = (
			    (recordObject.authors.length === 1 && (pageCountTowardsSumConditions.typFormalny || pageCountTowardsSumConditions.typMerytoryczny) )
			    || pageCountTowardsSumConditions.czyWycinek);
		    if(!countPages) recordObject.pageAmount = 0;

		    recordObjectsArray.push(recordObject);

	    });
	    done(null, recordObjectsArray, queryName);
    } catch(err) {
        done(err, null, null)
    }

}

module.exports = parser;
