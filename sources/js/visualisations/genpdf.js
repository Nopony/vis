require('buffer')

document.querySelector('#genPdfBtn').addEventListener('click', function (ev) {
	console.log('generating pdf...')
	genPdfDocArgs(jsStrings.vis_titles[visname],
		jsStrings.pdf_caption,
		jsStrings.pdf_caption_title,
		jsStrings.for,
		authorName,
		'landscape')})



function genPdfDocArgs(title, made_with, visualiser_name, made_for, author_name, orientation) {
	var $svg = document.querySelector('#svg-port')
		, doc = new PDFDocument({
		layout: orientation || 'landscape',
	})
		, stream = doc.pipe(blobStream());

	var loadFont = function (name, type, url, ff) {
		var callback = registerFont;
		var request = new XMLHttpRequest();
		request.onreadystatechange = function () {
			if (request.readyState == 4 && request.status == 200) {
				if (type == 'woff') {
					registerFont(request.responseText, name, type, url, ff);
				} else if (type == 'ttf') {
					registerFont(request.response, name, type, url, ff);
				}
			}
		};
		request.open('GET', url, true);
		if (type == 'woff') {
			request.overrideMimeType('text/plain; charset=x-user-defined');
		} else {
			request.responseType = "arraybuffer";
		}
		request.send(null);
	};
	var registerFont = function (responseText, name, type, url, ff) {
		if (type == 'woff') {
			var buf = _base64ToArrayBuffer(btoa(WORF.Converter.woffToSfnt(responseText)));
		} else {
			var buf = responseText;
		}
		doc.registerFont(name, buf);

		doc.font('Open Sans').fontSize(25)
			.text(title, 50, 40);
		doc.font('Open Sans').fontSize(12)
			.text(made_with, {
				continued: true
			})
			.text(visualiser_name, {
				continued: true,
				link: 'http://visualizeme.umk.pl'
			})
			.text(made_for + authorName);

		var scale = doc.page.width / $svg.width.baseVal.value;
		var width = $svg.width.baseVal.value;
		var height = $svg.height.baseVal.value;
		console.log(scale);
		$svg.setAttribute('transform', 'scale(' + scale + ')');

		SVGtoPDF(doc, $svg, 50, 100, {width: width, height: height});

		loadImg()


	};

	function loadImg() {
		var xhr = new XMLHttpRequest()
		xhr.responseType = 'arraybuffer'
		xhr.onload = function() {
			var buf = new Buffer(xhr.response)
			doc.image(buf, doc.page.width - 130, 100,{width: 100})

			var xhrLicense = new XMLHttpRequest()
			xhrLicense.responseType = 'arraybuffer'
			xhrLicense.onload= function () {
				var licenseBuf = new Buffer(xhrLicense.response)
				doc.image(licenseBuf, 50, doc.page.height - 100,{width: 150});
				doc.font('Open Sans').fontSize(12)
					.text(' by UMK (2018)', 220, doc.page.height - 100)
				doc.end();
			}
			xhrLicense.open('GET', '/images/license.png', true)
			stream.on('finish', function () {
				console.log(stream.toBlobURL('application/pdf'));
				window.location = stream.toBlobURL('application/pdf');
			});
			xhrLicense.send();
		}
		xhr.open('GET', '/images/logo.png', true)

		xhr.send()

	}





	loadFont('Open Sans', 'ttf', '/fonts/open-sans.regular.ttf', 'Open Sans')
}
