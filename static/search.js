
var KEY = 'AIzaSyDzvGIlo_6GmdRasOTnN17hJ9rS3hx_3OA';
var CX = '009070735501129361962:wadxjqrcyas';
var NEGCX = '015533284649053097143:pqe10xnvwd8';

var LABELS = [{
    label: '_cse_wadxhqrcyas',
    name: 'Variant Search'
}, {
    label: '_cse_exclude_wadxhqrcyas',
    name: 'Eliminate',
    exclude_from_left: true
}, {
    label: 'google',
    name: 'Google',
    exclude_from_add: true
}];

// The state of the page and the four UI components
var params = {};
var modes = null;
var query = null;
var results = null;
var resultNum = null;

function parseLocation() {
    var params = {};
    if (!location.search)
        return params;

    var vars = location.search.slice(1).split('&');
    for (var i=0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        var name = decodeURIComponent(pair[0]);
        var value = decodeURIComponent(pair[1]).replace(/\+/g, ' ');
        params[name] = value;
    }
    return params;
}

function startNum(params) {
    if (params.start) {
	if (typeof(params.start) == 'string') {
	    return parseInt(params.start);
	} else {
	    return params.start;
	}
    } else {
	return 1;
    }
}

function title(params) {
    if (!params.q) return 'Stanford Medical Search';
    return params.q + ' - Stanford Medical Search';
}

function update(delta, replace) {
    var pageturn = false;
    if (replace)
        params = delta;
    else
        for (k in delta) {
	    if (k == 'start') pageturn = true;
	    params[k] = delta[k];
	}
    query.update(params);
    modes.update(params);
    if (!pageturn) resultNum.update(params);
    results.update(params);
    document.title = title(params);
}

function pushHistory(params) {
    var url = location.pathname + '?' + $.param(params);
    history.pushState(params, title(params), url);
}

var ui = {};
ui.modes = function(root) {
    var selected = null;
    var labelToAnchor = {};
    root.html($.map(LABELS, function(x) {
	if (!x.exclude_from_left) {
            var a = $('<a>')
		.text(x.name)
		.on('click', function(e) {
                    update({mode: x.label});
                    pushHistory(params);
		});
            labelToAnchor[x.label] = a;
            return $('<li>').append(a);
	}
    }));

    var el = {};
    el.update = function(params) {
        var mode = params.mode ? params.mode : 'web';
        var a = labelToAnchor[mode];
        if (selected) selected.removeClass('selected');
        a.addClass('selected');
        selected = a;
    };

    return el;
};


ui.resultNum = function(root) {
    root.empty();
    var startnum = startNum(params);
    if (startnum > 1) {
	var prev = $('<a>')
            .text('Prev')
            .on('click', function(e) {
		var startnum = startNum(params);
		update({start: startnum - 10})
		pushHistory(params);
	    });
	root.append(prev);
	root.append($('<span>')
		    .text(" | "));
    }
    var next = $('<a>')
        .text('Next')
        .on('click', function(e) {
	    var startnum = startNum(params);
	    update({start: startnum + 10})
	    pushHistory(params);
	});

    root.append(next);

    var el = {};
    el.update = function(params) {
	params.start = 0;
    };
    return el;
};
    
ui.query = function(root) {
    var text = root.find('#query-text');

    var el = {};
    el.update = function(params) {
        if (!('q' in params)) return;
        text.val(params.q);
    };

    root.find('form').on('submit', function(e) {
        update({q: text.val()});
        pushHistory(params);
        return false;
    });

    return el;
};

ui.results = {};
ui.results.web = function(root) {
    var el = {};

    var popupScreen = $('<div>').addClass('popup-screen')
        .on('click', hidePopup)
        .hide();
    var popup = $('<div>').addClass('popup')
        .hide();

    $(document.body)
        .append(popupScreen)
        .append(popup);

    function showPopup(data) {
        popupScreen.show();

        popup.empty()
            .append($('<h1>').text('Add label'))
            .append($('<div>').addClass('result')
                    .append($('<h3>')
                            .append($('<a>').attr('href', data.link)
                                    .html(data.htmlTitle)))
                    .append($('<cite>').html(data.formattedUrl))
                    .append($('<p>')
                            .html(data.htmlSnippet.replace(/<br>/g, ''))))

        var labels = LABELS.filter(function(x) { return !x.exclude_from_add; });
        var existingLabels = {};
        var labelsDisplay = $('<div>').addClass('label-display');

        if (data.labels) {
            $.each(data.labels, function(i, e) {
                existingLabels[e.name] = true;
            });
        }

        var form = $('<form>').addClass('add-label')
            .append($('<input>')
                    .attr('type', 'hidden')
                    .attr('name', 'url')
                    .attr('value', data.link))
            .append($('<div>').addClass('group mode')
                    .append($('<label>')
                            .append($('<input>')
                                    .attr('type', 'radio')
                                    .attr('name', 'mode')
                                    .attr('value', 'site'))
                            .append('Label entire site'))
                    .append($('<label>')
                            .append($('<input>')
                                    .attr('checked', 'true')
                                    .attr('type', 'radio')
                                    .attr('name', 'mode')
                                    .attr('value', 'page'))
                            .append('Label this page')))
            .append($('<div>').addClass('group labels')
                    .append($.map(labels, function(l) {
                        return $('<label>')
                            .append($('<input>')
                                    .attr('type', 'checkbox')
                                    .attr('name', 'label')
                                    .attr('value', l.label)
                                    .attr('checked', existingLabels[l.label]))
                            .append($('<span>').text(l.name));
                    })))

        var saving = false;
        popup.append(form)
            .append($('<div>').addClass('button-bar')
                    .append($('<button>').text('Save')
                            .on('click', function() {
                                if (saving) return;
                                saving = true;

                                var labelParams = [];
                                var selectedLabels = {};
                                $.each(form.serializeArray(), function(i, e) {
                                    if (e.name == 'label') {
                                        selectedLabels[e.value] = true;
                                    } else {
                                        labelParams.push(e);
                                    }

                                });

                                $.each(labels, function(i, l) {
                                    if (!selectedLabels[l.label] && existingLabels[l.label])
                                        labelParams.push({
                                            name: 'remove',
                                            value: l.label
                                        });

                                    if (selectedLabels[l.label] && !existingLabels[l.label])
                                        labelParams.push({
                                            name: 'add',
                                            value: l.label
                                        });
                                });

                                var button = $(this);
                                button.text('Saving...');
                                $.ajax({
                                    url: '/api/label',
                                    method: 'POST',
                                    data: labelParams,
                                    success: function() {
                                        el.update(params);
                                    },
                                    error: function() {
                                        alert('Saving label failed');
                                        button.text('Save');
                                        saving = false;
                                    }
                                });
                            }))
                    .append($('<button>').text('Cancel')
                            .on('click', hidePopup)))
            .show();
    }

    function hidePopup() {
        popup.hide();
        popupScreen.hide();
    }
    // So that we can hide the popup on update.
    el.hidePopup = hidePopup;

    function labels(data) {
        var div = $('<div>').addClass('labels');
        if (data.labels && data.labels.length) {
            $.each(data.labels, function(i, e) {
                if (i != 0) div.append(' - ');
                div.append($('<a>')
                           .text(e.displayName)
                           .on('click', function() {
                               update({mode: e.name});
                               pushHistory(params);
                           }));
            });
            div.append(' - ');
        }
        div.append($('<a>').text('Add label').on('click', function() {
            showPopup(data);
        }));
        return div;
    }

    function result(data) {
        return $('<li>').addClass('result')
            .append($('<h3>')
                    .append($('<a>').attr('href', data.link)
                            .html(data.htmlTitle)))
            .append($('<cite>').html(data.formattedUrl))
            .append($('<p>').html(data.htmlSnippet.replace(/<br>/g, '')))
            .append(labels(data));
    }

    function spelling(data) {
        var q = data.correctedQuery.replace(/more:\w+/, '');

        return $('<p>').addClass('spelling')
            .append('Did you mean ')
            .append($('<a>').text(q)
                    .on('click', function(e) {
                        update({q: q});
                        pushHistory(params);
                        return false;
                    }))
            .append('?');
    }

    function noResults(data) {
        return $('<p>')
            .append('No results for ')
            .append($('<b>').text(data.request[0].searchTerms));
    }

    el.update = function(params) {
        var query = params.q;
	var startnum = 1;
	if (params.start) startnum = params.start;
        if (params.mode && params.mode != 'web')
            query += ' more:' + params.mode;

        $.ajax({
            url: 'https://www.googleapis.com/customsearch/v1',
            dataType: 'jsonp',
            data: {
                key: KEY,
		start: startnum,
                cx: (params.mode == 'new' ? NEGCX : CX),
                q: query
            },
            success: function(data) {
                root.empty();

                if (data.spelling)
                    root.append(spelling(data.spelling));

                if (data.items) {
                    root.append($('<ol>').addClass('web')
                                .html($.map(data.items, result)));
                } else {
                    root.append(noResults(data.queries));
                }

                // This handles the case when search results are refreshed due
                // to the user adding a label with the popup. This should
                // probably be handled more explicitly.
                hidePopup();
            }
        });
    };

    return el;

};

ui.results.images = function(root) {
    var el = {};

    function noResults(data) {
        return $('<p>')
            .append('No results for ')
            .append($('<b>').text(data.request[0].searchTerms));
    }

    function result(data) {
        var cite = data.image.width + ' &times; ' + data.image.height + ' - ' +
            data.displayLink;
        return $('<li>')
            .append($('<a>')
                    .attr('href', data.image.contextLink)
                    .append($('<img>')
                            .attr('src', data.image.thumbnailLink))
                    .append($('<cite>').html(cite)));
    }

    function spelling(data) {
        var q = data.correctedQuery;


        return $('<p>').addClass('spelling')
            .append('Did you mean ')
            .append($('<a>').text(q)
                    .on('click', function(e) {
                        update({q: q});
                        pushHistory(params);
                        return false;
                    }))
            .append('?');
    }

    el.update = function(params) {
        $.ajax({
            url: 'https://www.googleapis.com/customsearch/v1',
            dataType: 'jsonp',
            data: {
                key: KEY,
                cx: CX,
                q: params.q,
                searchType: 'image',
                imgSize: 'medium'
            },
            success: function(data) {
                root.empty();

                if (data.spelling)
                    root.append(spelling(data.spelling));

                if (data.items) {
                    root.append($('<ol>').addClass('images')
                                .html($.map(data.items, result)));
                } else {
                    root.append(noResults(data.queries));
                }
            }
        });
    };

    return el;
};

ui.results.all = function(root) {
    var el = {};

    var web = ui.results.web(root);
    var images = ui.results.images(root);

    el.update = function(params) {
        // TODO(mwytock): Better way to handle this
        web.hidePopup();
        log(params);

        // Special UI for images
        if (params.mode == 'images')
            images.update(params);
        else
            web.update(params);
    };

    function log(params) {
        $.ajax({
            url: '/api/log',
            method: 'POST',
            data: params
        });
    }

    return el;
};

$(document).ready(function() {
    modes = ui.modes($('#modes'));
    query = ui.query($('#query'));
    results = ui.results.all($('#results'));
    resultNum = ui.resultNum($('#resultNum'));
});

window.addEventListener('popstate', function(e) {
    update(e.state ? e.state : parseLocation(), true);
});
