const cities = require('./cities.json');
const journals = require('./journals.json');
var parser = {};

parser.parse = function (rawText, done) {

    const exp1 = new RegExp(/<BR> [0-9]{0,3}\. <BR>/);
    const exp2 = new RegExp(/<span class="label">/);

    let recordObjectsArray = [];
    //TODO: handle 2 name query with OR in the middle
    let queryName = rawText.split('id="querylabel">Zapytanie: </span>')[1].split('<BR><FONT')[0];
    if(queryName.indexOf('</FONT>') !== -1) {
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
                        if(publicationType == '008') pageCountTowardsSumConditions.typFormalny = true;

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
                        //console.log(elem);
                        recordObject.polishkeywords.push(elem.trim());
                    });
                    break;

                case 'Angielskie słowa kluczowe':
                    splitLine[1].split('<LI>').forEach((elem, index) => {
                        if(index == 0) return;
                        elem = elem.split(redundantSufix).join('');
                        elem = elem.split('<!-- 10.txt begin -->')[0];
                        //console.log(elem);
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
                        console.log(new Error('Failed RegExp parse at pageRange of line: ' + splitLine[1]).message);
                        recordObject.invalid["300"] = 'Could not infer page range from description';
                        recordObject.unparsedPageAmount = line.substr(4);
                    }
                    break;

                case 'Punktacja ministerstwa':
                    const styleTrimmed = splitLine[1].split('<span class="field">')[1].split('</span>')[0];
                    recordObject.points = Number.parseFloat(styleTrimmed);
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

}

module.exports = parser;
