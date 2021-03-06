
$(document).ready(function () {

	var DetailedDescriptions = {
		collab: jsStrings.vis_details.collab,
		works: jsStrings.vis_details.works,
		bubbles: jsStrings.vis_details.bubbles,
		"google-map": jsStrings.vis_details["google-map"],
		wordcloud: jsStrings.vis_details.wordcloud,
		"research-map": jsStrings.vis_details["research-map"],
		general: jsStrings.vis_details.general
	};

	DisplayDetails = function(visName) {
		$('#details-host').text(DetailedDescriptions[visName])
	}

	document.querySelectorAll('.card-image').forEach(function (c) {
		c.addEventListener('mouseout', function (event) {
			DisplayDetails('general');
		})
	})

	DisplayDetails('general')

	$('.dropdown-trigger').dropdown();

	console.log($('.dropdown-trigger').dropdown)

});

var inputFocused = false;
var wasChangedControlValue = 0;

function SetInputFocused() {
	inputFocused = true;
}
function SetInputBlurred() {
	inputFocused = false;
}

function InputChanged() {
	wasChangedControlValue++;
	var thisId = wasChangedControlValue;
	setTimeout(function () {
		if (wasChangedControlValue == thisId) {
			QueryForSuggestions()
			wasChangedControlValue = 0;
		}
	}, 1500)
}


function ComputeStatistics(data) {

	var stats = {
	"works-amount-display": '-',
	"coworkers-amount-display": '-',
	"ministerial-points-amount-display": '-',
	"mean-ministerial-points-amount-display": '-',
	"max-shared-works-amount-display": '-'
	}

	console.log(data);
	if(!data || !data.length) return;

	stats["works-amount-display"] = data.length;

	var beginYear = data[0].year, endYear = data[0].year;

	data.forEach(function (work) {
		if(work.year < beginYear) beginYear = work.year;
		if(work.year > endYear) endYear = work.year;
	})

	// stats["mean-works-amount-display"] = (data.length / (endYear - beginYear + 1)).toFixed(1);

	var authorMap = {}, mostShared = {amount: -1, name: "-"}, mostSharedNotSelf = {amount: -1, name: "-"};

	data.forEach(function (work) {
		work.authors.forEach(function (author) {
			authorMap[author] = authorMap[author] ? authorMap[author]++ : 1;
		})
	});

	stats["coworkers-amount-display"] = Object.keys(authorMap).length;

	stats["ministerial-points-amount-display"] = data.map(d => d.points).reduce((a, b) => a + b);

	var firstWithPoints = data.find(d => d.points > 0);

	stats["mean-ministerial-points-amount-display"] = firstWithPoints ?
		(stats["ministerial-points-amount-display"] / (endYear - firstWithPoints.year + 1)).toFixed(2) :
		'-';


	for(var name in authorMap)
		if(authorMap.hasOwnProperty(name)) {
			if(authorMap[name] > mostShared.amount) {
				mostShared.amount = authorMap[name];
				mostShared.name = name;
			}
		}

	for(var secondName in authorMap)
		if(authorMap.hasOwnProperty(secondName)) {
			if(authorMap[secondName] > mostSharedNotSelf.amount && secondName !== mostShared.name) {
				mostSharedNotSelf.amount = authorMap[name];
				mostSharedNotSelf.name = name;
			}
		}


	stats["max-shared-works-amount-display"] = mostSharedNotSelf.name;


	for (var title in stats)
		if(stats.hasOwnProperty(title)) {
			$('#' + title).text(stats[title]);
		}

	return stats;
}


$.post("collabData", {}, ComputeStatistics)

var DisplayDetails;
