'use strict';

var _ = require('lodash');
var fs = require('graceful-fs');
var path = require('path');
var twemoji = require('twemoji');
var StringBuilder = require('stringbuilder');

var data = require('./Hangouts/Hangouts.json');

var categories = {
    password: { name: 'password', tags: ['login', 'signin'] },
    software: { name: 'software', tags: ['install', ''] },
    vpn: { name: 'vpn', tags: ['cisco', 'anyconnect'] },
    vm: { name: 'vm', tags: ['vcenter', 'virtual machine'] },
    network: { name: 'network', tags: ['internet', 'access'] },
    VLAN: { name: 'VLAN', tags: ['Project LAN'] },
    deiver: { name: 'deiver' },
    mcafee: { name: 'mcafee' },
    phone: { name: 'phone' },
    machine_slow: { name: 'machine slow', tags: ['slowness', 'hang'] },
    printer: { name: 'printer' },
    hardware: { name: 'hardware' },
    website: { name: 'website' },
    os: { name: 'os', tags: ['operating system', 'linux', 'windows'] },
}

console.log("Processing started");
fs.writeFile("./output/pocessed_output.json", JSON.stringify(processData()), function(err) {
    if (err) {
        return console.log(err);
    }

    console.log("JSON is processed!");
});

function getAllParticipants() {
    var all_participants = {}
    for (var key in data['conversation_state']) {
        var conversation = data['conversation_state'][key]['conversation_state']['conversation'];
        // Get all participants
        for (var person_key in conversation['participant_data']) {
            var person = conversation['participant_data'][person_key];
            var gaia_id = person['id']['gaia_id'];
            if (!person['fallback_name'] || person['fallback_name'] == null) {
                continue;
            }
            if (!all_participants[gaia_id])
                all_participants[gaia_id] = person['fallback_name'];
        }
    }

    return all_participants;
}

function processData() {
    var all_participants = getAllParticipants();

    var Conversations = {}

    for (var key in data['conversation_state']) {
        var conversation_state = data['conversation_state'][key];
        var id = conversation_state['conversation_id']['id'];
        var conversation = conversation_state['conversation_state']['conversation'];
        // Find participants
        var participants = [],
            participants_obj = {};
        for (var person_key in conversation['participant_data']) {
            var person = conversation['participant_data'][person_key];
            var gaia_id = person['id']['gaia_id'];
            var name = "Unknown";
            if (person['fallback_name']) {
                name = person['fallback_name'];
            } else {
                name = all_participants[gaia_id];
            }
            participants.push(name);
            participants_obj[gaia_id] = name;
        }
        var participants_string = participants.join(", ");
        // Add to list
        //$(".convo-list").append("<a href=\"javascript:void(0);\" onclick=\"switchConvo('" + id + "')\" class=\"list-group-item\">" + participants_string + "</a>");
        // Parse events
        var events = [];
        for (var event_key in conversation_state['conversation_state']['event']) {
            var convo_event = conversation_state['conversation_state']['event'][event_key];
            var timestamp = convo_event['timestamp'];
            var msgtime = formatTimestamp(timestamp);
            var sender = convo_event['sender_id']['gaia_id'];
            var message = "";
            if (convo_event['chat_message']) {
                // Get message
                for (var msg_key in convo_event['chat_message']['message_content']['segment']) {
                    var segment = convo_event['chat_message']['message_content']['segment'][msg_key];
                    if (segment['type'] == 'LINE_BREAK') message += "\n";
                    if (!segment['text']) continue;
                    message += twemoji.parse(segment['text']);
                }
                // Check for images on event
                if (convo_event['chat_message']['message_content']['attachment']) {
                    for (var attach_key in convo_event['chat_message']['message_content']['attachment']) {
                        var attachment = convo_event['chat_message']['message_content']['attachment'][attach_key];
                        //console.log(attachment);
                        if (attachment['embed_item']['type'][0] == "PLUS_PHOTO") {
                            message += "\n<a target='blank' href='" + attachment['embed_item']['embeds.PlusPhoto.plus_photo']['url'] + "'><img class='thumb' src='" + attachment['embed_item']['embeds.PlusPhoto.plus_photo']['thumbnail']['image_url'] + "' /></a>";
                        }
                    }
                }
                var obj = { msgtime: msgtime, sender: participants_obj[sender], message: message, timestamp: timestamp };
                events.push(obj);
            }
        }
        // Sort events by timestamp
        events.sort(function(a, b) {
            var keyA = a.timestamp,
                keyB = b.timestamp;
            if (keyA < keyB) return -1;
            if (keyA > keyB) return 1;
            return 0;
        });

        var sb = new StringBuilder({ newline: '\r\n' });

        if (events.length) {
            var previousTime = _.head(events).timestamp; //events[0].timestamp;
            _.forEach(events, (event) => {
                var currentTime = parseInt(event.timestamp);

                if ((currentTime - previousTime) >= 60 * 60 * 1000 * 1000) {
                    //sb.appendLine(_.repeat('*', 80));                    
                    writeToFile(`./conversation/${participants_string}_${(new Date()).valueOf()}.txt`, _.cloneDeep(sb));
                    sb = new StringBuilder({ newline: '\r\n' });
                }

                previousTime = currentTime;
                sb.appendLine(`${event.sender}(${event.timestamp} # ${event.msgtime}): ${event.message}`);
            });

            writeToFile(`./conversation/${participants_string}_${(new Date()).valueOf()}.txt`, sb);
            // Add events
            Conversations[id] = events;
        } else {
            console.log(`Processed conversation ${participants_string}`);
        }
    }

    return Conversations;
}

function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function writeToFile(filePath, stringBuiderData) {
    ensureDirectoryExistence(filePath);
    stringBuiderData.toString((err, str) => {
        if (!str.length) {
            console.log(filePath);
            return;
        }
        if (_.toLower(str).indexOf('ajaykumar.singh@globallogic.com') > 0) {
            console.log(str);
        }
        //var stream = fs.createWriteStream(filePath, 'utf-8');

        //stringBuiderData.pipe(stream);
        //stringBuiderData.flush();
        fs.appendFile(filePath, str, (err) => {
            if (err) {
                console.log(err)
            }
        });

        var category = getCategories(str);
        var catPath = filePath.replace('conversation', `conversation/${category}`);
        ensureDirectoryExistence(catPath);
        fs.appendFile(catPath, str, (err) => {
            if (err) {
                console.log(err)
            }
        });
    });
}

function getCategories(str) {
    return (_.find(categories, (value) => {
        return _.find(_.concat((value.tags || []), [value.name]), (val) => {
            return _.toLower(str).indexOf(_.toLower(val)) > 0
        })
    }) || { name: 'others' }).name;
}

function formatTimestamp(timestamp) {
    var d = new Date(timestamp / 1000);
    var formattedDate = d.getFullYear() + "-" +
        zeroPad(d.getMonth() + 1) + "-" +
        zeroPad(d.getDate());
    var hours = zeroPad(d.getHours());
    var minutes = zeroPad(d.getMinutes());
    var formattedTime = hours + ":" + minutes;
    return formattedDate + " " + formattedTime;
}

function zeroPad(string) {
    return (string < 10) ? "0" + string : string;
}
