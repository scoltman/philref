var cheerio = require('cheerio');
var fs      = require('fs')
var request = require('request');

var baseURL = "http://philpapers.org/asearch.pl?direction=citations&format=json"

function scrapePage(ID){

  var url = "http://philpapers.org/rec/"+ID;

  request(url, function(error, response, html){
      if(!error){
          var $ = cheerio.load(html);

          var title;
          var json = { title : ""};

          console.log($('title').text());
      }
  });

}

function getAllCitations(ID){
  var citeIDs = [];
  function getCitations(ID, offset){
    var url = baseURL+"&start="+offset+"&eId="+ID;
    request(url, function(error, response, json){
        if(!error){
            var data = JSON.parse(json);
            for (var i = 0; i< data.content.length; i++) {
              citeIDs.push(data.content[i].id);
            }
            if(data.content.length === 50){
              getCitations(ID, offset+50);
            } else {
              console.log(citeIDs.length);
            }
        }
    });
  }
  getCitations(ID, 0);
}

getAllCitations('LEWC-2');
