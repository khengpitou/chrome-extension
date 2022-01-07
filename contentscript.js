chrome.runtime.onMessage.addListener(function(sender, message, sendResponse) {
    if (message == 'sp-monitor-is-enabled') {
        sendResponse(sp_monitor_is_enabled());
    } else {
        console.log('Invalid message received');
    }
});

async function sp_get_global(name) {
    return new Promise((res, rej) => {
        data = {}; data[name] = null;

        chrome.storage.local.get(data, function(items) {
            if (chrome.runtime.lastError) {
                rej('Failed to get key: ' + name);
            }
            else {
                res(JSON.parse(items[name]));
            }
        });
    });
}

async function sp_set_global(name, value) {
    return new Promise((res, rej) => {
        data = {}; data[name] = JSON.stringify(value);

        chrome.storage.local.set(data, function() {
            if (chrome.runtime.lastError) {
                rej('Failed to set key: ' + name);
            }
            else {
                res();
            }
        });
    })
}

function sp_monitor_is_enabled() {
    let html = document.getElementsByTagName('html')[0];

    if (!html.hasAttribute('data-sp-monitor')) {
        return false;
    }

    return html.getAttribute('data-sp-monitor') == 'on';
}

function sp_monitor_set_enabled(enabled) {
    let html = document.getElementsByTagName('html')[0];
    html.setAttribute('data-sp-monitor', enabled ? 'on' : 'off');
}

// Wait for a precsribed number of milliseconds inside an async function.
//
// This function has to be called with: await sp_timeout(N);
async function sp_timeout(N) {
    await new Promise(function(resolve, reject) {
        setTimeout(resolve, N);
    });
}

async function sp_google_meet_get_participants() {
    let participants = {};

    // Start by opening the sidebar, otherwise the users won't be 
    // automatically loaded. 
    await sp_google_meet_open_sidebar();

    // In order to get the complete list of participants, we need
    // to scroll the list to the bottom.
    let se = document.querySelectorAll('[role="list"]');
    if (se.length == 0) {
        return [];
    }
    else {
        // If a user raises the hand we may have multiple user lists; in this way, 
        // we shoule be fetching the right one. 
        se = se[se.length - 1];
    }

    se.scrollTo(0, 0);

    // Wait for the scrolling to happen
    await sp_timeout(500);

    let scrollStep = se.offsetHeight;
    let scrollUnits = 0;

    while (scrollUnits <= se.scrollHeight) {
        // This works for Google Meets. We need to scroll down to get them all. The ID
        // is needed to make sure we do not count someone twice.
        Array.from(se.querySelectorAll('[role="listitem"]')).forEach(function(div) {
            var pid = div.getAttribute('data-participant-id');
            var labels = div.getElementsByClassName('ZjFb7c');
            if (labels.length > 0) {
                var name = labels[0].innerHTML;

                participants[pid] = {
                    'name': name,
                    'id': pid
                };
            }
        });

        se.scrollBy(0, scrollStep);
        scrollUnits += scrollStep;

        // Wait for the scrolling to happen
        await sp_timeout(500);
    }

    return participants;
}

async function sp_google_meet_open_sidebar() {
    // For Google Meet, we may try to open the sidebar if we manage
    let sidebar_btns = document.getElementsByClassName(
        'uArJ5e UQuaGc kCyAyd QU4Gid foXzLb IeuGXd');
        
    if (sidebar_btns.length > 0) {
        sidebar_btns[0].click();
    }

    await sp_timeout(500);
}

async function sp_microsoft_teams_get_participants_v2() {
    var sp_teams_listener = null;

    // We only return a Promise that will be resolved then the
    // code in the page is actually executed
    let participants = await new Promise(function(resolve, reject) {
        let s = document.createElement('script');
        sp_teams_listener = function(d) {
            resolve(d.detail.participants);
        }

        document.addEventListener('sp_microsoft_teams_get_call', sp_teams_listener);

        // Inject the code into the page
        s.src = chrome.extension.getURL('get-call.js');
        (document.head || document.documentElement).appendChild(s);

        s.onload = function() {
            s.parentNode.removeChild(s);
        }
    });

    if (sp_teams_listener != null) {
        document.removeEventListener(
            'sp_microsoft_teams_get_call',
            sp_teams_listener
        );
    }

    return participants;
}

function sp_trigger_participants_download(participants, detailed) {
    let participants_list = "";

    for (var id in participants) {
        let line = participants[id]['name'];

        // The extra data is only shown in the case the user requests the 
        // detailed version of the list -- as of now this only loaded for
        // Microsoft Teams, and not supported in Google Meet.
        if (participants[id].hasOwnProperty('profile') && detailed) {
            let profile = participants[id].profile;
            if (profile.isAnonymousUser) {
                line += " (Anonymous user)";
            }

            if (profile.hasOwnProperty('jobTitle')) {
                line += " - " + profile.jobTitle;
            }

            if (profile.hasOwnProperty('department')) {
                line += " - " + profile.department;
            }

            if (profile.hasOwnProperty('email')) {
                line += " - " + profile.email;
            }
        }

        participants_list = participants_list + line + '\n';
    }

    if (participants_list == "") {
        alert('No participants found!\nPlease check that the sidebar containing the list of participants is open.');
    } else {
        sp_trigger_download(participants_list, false);
    }
}

function sp_trigger_download(content, monitor) {
    chrome.runtime.sendMessage({
            action: 'download',
            message: content,
            monitor: monitor
        },
        function(response) {
            if (chrome.runtime.lastError) {
                console.log('ERROR: ' + chrome.runtime.lastError);
            } else {
                if (response.status != 'completed') {
                    console.log('Download failed');
                }
            }
        }
    );
}

async function sp_get_participants() {
    let participants = null;

    participants = await sp_microsoft_teams_get_participants_v2();

    // In this case, we try to get participants from Google Meets
    if (Object.keys(participants).length == 0) {
        participants = await sp_google_meet_get_participants();
    }

    return participants;
}

async function sp_download_list() {
    let participants = await sp_get_participants();
    sp_trigger_participants_download(participants, false);
}

async function sp_download_list_detailed() {
    let participants = await sp_get_participants();
    sp_trigger_participants_download(participants, true);
}