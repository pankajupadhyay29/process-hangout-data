'use strict';

const NEW_LINE = '\r\n';

var _ = require('lodash');
var fs = require('graceful-fs');
var path = require('path');

var rasa_nlu_data = {
  regex_features: [],
  entity_synonyms: [],
  common_examples: [],
}

var stories=[];
var intent = 'printer';
var folderPath = './conversation/printer/';
console.log("Started");
readFiles(folderPath, processFile, console.log);

var allCommunication = [];

function processFile(filename, content, index, total) {
  var conversation = _.split(content, NEW_LINE);
  var story = [`## story_${intent}_${index}`]
  _.forEach(conversation, (value) => {
    var text = value.substring(value.indexOf('):') + 2);
    if(
      _.includes(_.lowerCase(value), 'ithelpdesk') 
      || _.includes(_.lowerCase(value), 'it-helpdesk') 
      || _.includes(_.lowerCase(value), 'it helpdesk')
    ) {
      story.push(`   - ${text}`)
    }
    else{
      story.push(`* _${text}`)
      if(!_.includes(allCommunication, _.lowerCase(text))) {
        allCommunication.push(_.lowerCase(text));
        rasa_nlu_data.common_examples.push({text, intent, entities:[] })        
      }
    }    
  });
  stories.push(story.join(NEW_LINE))
  if(index == total - 1) {
    fs.writeFile(`./${intent}_nlu.json`, JSON.stringify({rasa_nlu_data}));
    fs.writeFile(`./${intent}_stroies.md`, stories.join(`${NEW_LINE}${NEW_LINE}`));
    console.log("Done!!!!")
  }
}


function readFiles(dirname, onFileContent, onError) {
  fs.readdir(dirname, function(err, filenames) {
    if (err) {
      onError(err);
      return;
    }
    const totalFiles = filenames.length;
    filenames.forEach(function(filename, index) {
      fs.readFile(dirname + filename, 'utf-8', function(err, content) {
        if (err) {
          onError(err);
          return;
        }
        onFileContent(filename, content, index, totalFiles);
      });
    });
  });
}
